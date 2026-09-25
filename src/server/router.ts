/** コントラクトの実装。すべて implement(contract) 経由で型チェックされる。 */

import { implement } from '@orpc/server'

import { contract } from '../contract'
import {
  APP_NAME,
  APP_VERSION,
  IRODORI_EMOJI,
  OPENAI_MODELS,
  OPENAI_VOICES,
  PROVIDER_PRESETS,
} from './constants'
import { liveManager } from './live/sessions'
import { serverDefaults } from './settings'
import { UpstreamError, buildUpstreamHeaders, joinUrl, originOf, streamSynthesize, synthesize } from './tts'

const os = implement(contract)

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('base URL が空です')
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function errorMessageOf(payload: Record<string, unknown> | null, fallback: string): string {
  const error = payload?.error as { message?: string } | undefined
  return error?.message ?? fallback
}

async function probe(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; payload: Record<string, unknown> | null; text: string; error?: string }> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    const text = await response.text()
    let payload: Record<string, unknown> | null = null
    try {
      const parsed = JSON.parse(text) as unknown
      payload = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      payload = null
    }
    return { status: response.status, payload, text }
  } catch (error) {
    return { status: 0, payload: null, text: '', error: error instanceof Error ? error.message : String(error) }
  }
}

export const router = {
  system: {
    info: os.system.info.handler(async () => {
      const live = await liveManager.status()
      return {
        name: APP_NAME,
        version: APP_VERSION,
        runtime: { node: process.version, platform: process.platform },
        codex: {
          bin: live.codexUserAgent ? 'codex app-server' : 'codex',
          available: live.codexAvailable,
          userAgent: live.codexUserAgent,
          authMode: live.authMode ?? live.authMode,
          error: live.lastError,
        },
        defaults: {
          baseUrl: serverDefaults.baseUrl,
          model: serverDefaults.model,
          voice: serverDefaults.voice,
          hasServerApiKey: Boolean(serverDefaults.apiKey),
        },
        presets: PROVIDER_PRESETS,
        openaiVoices: [...OPENAI_VOICES],
        openaiModels: [...OPENAI_MODELS],
        irodoriEmoji: IRODORI_EMOJI.map((item) => ({ ...item })),
      }
    }),

    liveStatus: os.system.liveStatus.handler(async () => liveManager.status()),
  },

  upstream: {
    health: os.upstream.health.handler(async ({ input }) => {
      const base = normalizeBaseUrl(input.baseUrl)
      const headers = buildUpstreamHeaders(input.apiKey ?? serverDefaults.apiKey)
      const checks: Array<{ url: string; status?: number; error?: string }> = []
      let reachable = false
      let authenticated = false
      let kind: 'openai' | 'irodori' | 'custom' | 'unknown' = 'unknown'
      let detail: unknown = undefined

      const healthUrl = joinUrl(originOf(base), 'health')
      const health = await probe(healthUrl, headers, 12_000)
      if (health.status > 0 && health.status < 400) {
        reachable = true
        authenticated = true
        kind = health.payload?.status === 'ok' ? 'irodori' : 'custom'
        detail = health.payload
      } else {
        checks.push({ url: healthUrl, status: health.status, error: health.error })
      }

      const modelsUrl = joinUrl(base, 'models')
      const models = await probe(modelsUrl, headers, 12_000)
      if (models.status > 0) {
        reachable = true
        authenticated = authenticated || models.status < 400
        if (kind === 'unknown') kind = base.includes('api.openai.com') ? 'openai' : 'custom'
        if (models.status >= 400) {
          detail = models.payload ?? { raw: models.text.slice(0, 500) }
        } else if (!detail) {
          const list = Array.isArray(models.payload?.data) ? (models.payload?.data as unknown[]) : []
          detail = { modelCount: list.length }
        }
      }
      checks.push({ url: modelsUrl, status: models.status, error: models.error })

      return { ok: true as const, reachable, authenticated, kind, upstream: base, detail, checks }
    }),

    models: os.upstream.models.handler(async ({ input }) => {
      const base = normalizeBaseUrl(input.baseUrl)
      const result = await probe(joinUrl(base, 'models'), buildUpstreamHeaders(input.apiKey ?? serverDefaults.apiKey), 20_000)
      if (result.status === 0) {
        return { ok: false, status: 502, upstream: base, models: [], error: result.error ?? '接続できません' }
      }
      if (result.status >= 400) {
        return {
          ok: false,
          status: result.status,
          upstream: base,
          models: [],
          error: errorMessageOf(result.payload, result.text.slice(0, 300) || `HTTP ${result.status}`),
        }
      }
      const list = Array.isArray(result.payload?.data) ? (result.payload?.data as Array<Record<string, unknown>>) : []
      return {
        ok: true,
        status: result.status,
        upstream: base,
        models: list
          .filter((item) => typeof item?.id === 'string')
          .map((item) => ({ id: item.id as string, ownedBy: (item.owned_by as string | undefined) ?? null })),
      }
    }),

    voices: os.upstream.voices.handler(async ({ input }) => {
      const base = normalizeBaseUrl(input.baseUrl)
      const result = await probe(
        joinUrl(base, 'audio/voices'),
        buildUpstreamHeaders(input.apiKey ?? serverDefaults.apiKey),
        20_000,
      )
      if (result.status === 404 || result.status === 405) {
        return {
          ok: true,
          supported: false,
          status: result.status,
          upstream: base,
          voices: [],
          note: 'この upstream は /v1/audio/voices を提供していません。',
        }
      }
      if (result.status === 0 || result.status >= 400) {
        return {
          ok: false,
          supported: result.status === 0 ? false : true,
          status: result.status || 502,
          upstream: base,
          voices: [],
          error: result.error ?? errorMessageOf(result.payload, `HTTP ${result.status}`),
        }
      }
      const list = Array.isArray(result.payload?.data) ? (result.payload?.data as unknown[]) : []
      const voices = list.flatMap((item) => {
        if (typeof item === 'string') return [{ id: item }]
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          if (typeof record.id !== 'string') return []
          return [
            {
              id: record.id,
              noRef: Boolean(record.no_ref),
              refWav: (record.ref_wav as string | null | undefined) ?? null,
              refWavs: Array.isArray(record.ref_wavs) ? (record.ref_wavs as string[]) : null,
            },
          ]
        }
        return []
      })
      return { ok: true, supported: true, status: result.status, upstream: base, voices }
    }),

    uploadVoice: os.upstream.uploadVoice.handler(async ({ input }) => {
      const base = normalizeBaseUrl(input.upstream.baseUrl)
      const form = new FormData()
      form.append('file', input.file, input.file.name || 'reference.wav')
      if (input.voiceId?.trim()) form.append('voice_id', input.voiceId.trim())
      const headers = buildUpstreamHeaders(input.upstream.apiKey ?? serverDefaults.apiKey)
      delete headers.accept
      try {
        const response = await fetch(joinUrl(base, 'audio/voices'), {
          method: 'POST',
          headers,
          body: form,
          signal: AbortSignal.timeout(120_000),
        })
        const payload = await readJson(response)
        return {
          ok: response.ok,
          status: response.status,
          id: typeof payload?.id === 'string' ? payload.id : undefined,
          raw: payload ?? { raw: '（本文なし）' },
        }
      } catch (error) {
        return {
          ok: false,
          status: 502,
          raw: { error: error instanceof Error ? error.message : String(error) },
        }
      }
    }),
  },

  tts: {
    speak: os.tts.speak.handler(async ({ input }) => {
      const { result } = await synthesize({
        ...input,
        upstream: {
          baseUrl: normalizeBaseUrl(input.upstream.baseUrl),
          apiKey: input.upstream.apiKey ?? serverDefaults.apiKey,
        },
      })
      return result
    }),

    stream: os.tts.stream.handler(async function* ({ input, signal }) {
      const normalized = {
        ...input,
        upstream: {
          baseUrl: normalizeBaseUrl(input.upstream.baseUrl),
          apiKey: input.upstream.apiKey ?? serverDefaults.apiKey,
        },
      }
      yield* streamSynthesize(normalized, signal)
    }),
  },

  live: {
    voices: os.live.voices.handler(async () => liveManager.listVoices()),

    start: os.live.start.handler(async ({ input }) => liveManager.startSession(input)),

    events: os.live.events.handler(async function* ({ input, signal }) {
      yield* liveManager.streamEvents(input.sessionId, signal)
    }),

    appendText: os.live.appendText.handler(async ({ input }) => {
      await liveManager.appendText(input.sessionId, input.text)
      return { ok: true }
    }),

    appendSpeech: os.live.appendSpeech.handler(async ({ input }) => {
      await liveManager.appendSpeech(input.sessionId, input.text)
      return { ok: true }
    }),

    stop: os.live.stop.handler(async ({ input }) => {
      await liveManager.stopSession(input.sessionId)
      return { ok: true }
    }),
  },
}

export type AppRouter = typeof router

export { UpstreamError }

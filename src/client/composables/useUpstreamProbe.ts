/** OpenAI 互換 upstream の接続確認とモデル・ボイス一覧の取得。 */

import { ref, shallowRef } from 'vue'

import type { ModelInfo, VoiceInfo } from '@/contract'
import { client, errorMessage } from '../lib/orpc'

export interface ProbeState {
  tone: 'neutral' | 'ok' | 'warn' | 'error'
  message: string
}

export function useUpstreamProbe() {
  const state = ref<ProbeState>({ tone: 'neutral', message: '未確認' })
  const checking = ref(false)
  const models = shallowRef<ModelInfo[]>([])
  const voices = shallowRef<VoiceInfo[]>([])
  const voicesSupported = ref<boolean | null>(null)

  async function check(baseUrl: string, apiKey?: string): Promise<ProbeState> {
    checking.value = true
    state.value = { tone: 'neutral', message: '確認中…' }
    try {
      const result = await client.upstream.health({ baseUrl, apiKey })
      if (result.ok && result.reachable) {
        state.value = {
          tone: 'ok',
          message: `接続 OK（${result.kind}${result.authenticated ? '' : ' / 認証未確認'}）`,
        }
      } else {
        const failed = result.checks.find((check) => check.error) ?? result.checks.at(-1)
        state.value = {
          tone: result.reachable ? 'warn' : 'error',
          message: `到達できません: ${failed?.error ?? `HTTP ${failed?.status ?? '?'}`}`,
        }
      }
    } catch (caught) {
      state.value = { tone: 'error', message: errorMessage(caught) }
    } finally {
      checking.value = false
    }
    return state.value
  }

  async function loadModels(baseUrl: string, apiKey?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await client.upstream.models({ baseUrl, apiKey })
      if (!result.ok) return { ok: false, error: result.error }
      models.value = result.models
      return { ok: true }
    } catch (caught) {
      return { ok: false, error: errorMessage(caught) }
    }
  }

  async function loadVoices(baseUrl: string, apiKey?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await client.upstream.voices({ baseUrl, apiKey })
      voicesSupported.value = result.supported
      if (!result.supported) return { ok: true }
      if (!result.ok) return { ok: false, error: result.error }
      voices.value = result.voices
      return { ok: true }
    } catch (caught) {
      return { ok: false, error: errorMessage(caught) }
    }
  }

  return { state, checking, models, voices, voicesSupported, check, loadModels, loadVoices }
}

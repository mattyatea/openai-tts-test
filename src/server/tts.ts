/**
 * OpenAI 互換 TTS エンドポイントの呼び出し。
 *
 * - 通常レスポンスはそのまま Blob として返す
 * - `stream_format: "sse"` のときは SSE を読み、音声チャンクを連結して返す
 *   （OpenAI 本体と Irodori-TTS-Server の両方の形式を扱う）
 */

import type { SpeechChunkEvent, SpeechRequest, SpeechResult, TtsFormat } from '../contract'
import { MEDIA_TYPES } from './constants'
import { SPEECH_TIMEOUT_MS } from './settings'

export class UpstreamError extends Error {
  readonly status: number
  readonly detail: string

  constructor(message: string, status = 502, detail = '') {
    super(message)
    this.name = 'UpstreamError'
    this.status = status
    this.detail = detail
  }
}

export interface SpeechOutcome {
  result: SpeechResult
  upstreamStatus: number
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new UpstreamError('base URL が空です', 400)
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}

export function joinUrl(baseUrl: string, suffix: string): string {
  return `${normalizeBaseUrl(baseUrl)}/${suffix.replace(/^\/+/, '')}`
}

export function originOf(baseUrl: string): string {
  const url = new URL(normalizeBaseUrl(baseUrl))
  const path = url.pathname.replace(/\/+$/, '')
  const parent = path.endsWith('/v1') ? path.slice(0, -3) : path
  return `${url.origin}${parent}`.replace(/\/+$/, '')
}

function buildAuthHeaders(apiKey?: string): Record<string, string> {
  const key = apiKey?.trim()
  if (!key) return {}
  return { authorization: /^bearer\s/i.test(key) ? key : `Bearer ${key}` }
}

export function buildUpstreamHeaders(apiKey?: string): Record<string, string> {
  return {
    accept: 'application/json, audio/*, text/event-stream, */*',
    'accept-encoding': 'identity',
    'user-agent': 'tts-lab/0.1.0',
    ...buildAuthHeaders(apiKey),
  }
}

/** Irodori 固有のキーは `irodori` にまとめ、未指定キーは落とす。 */
function compactIrodori(options: SpeechRequest['irodori']): Record<string, unknown> | undefined {
  if (!options) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

export function buildSpeechBody(request: SpeechRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    input: request.input,
    response_format: request.responseFormat,
  }
  if (request.voice?.trim()) body.voice = request.voice.trim()
  if (typeof request.speed === 'number') body.speed = request.speed
  if (request.instructions?.trim()) body.instructions = request.instructions.trim()
  if (request.useSse) body.stream_format = 'sse'
  const irodori = compactIrodori(request.irodori)
  if (irodori) body.irodori = irodori
  return body
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } }
      return parsed.error?.message ?? text.slice(0, 500)
    } catch {
      return text.slice(0, 500)
    }
  } catch {
    return ''
  }
}

interface SseAudio {
  complete: Uint8Array[]
  deltas: Uint8Array[]
  chunkFormats: string[]
  transcripts: string[]
}

/** 上流 SSE の 1 イベントを、このアプリの扱いやすい形へ解釈したもの。 */
type InterpretedEvent =
  | { kind: 'chunk'; bytes: Uint8Array; format: string; text: string; seed: number | null; totalToDecode: number | null }
  | { kind: 'delta'; bytes: Uint8Array }
  | { kind: 'error'; message: string }
  | { kind: 'done' }

/** SSE の 1 ブロック（空行で区切られた範囲）を event 名と data に分ける。 */
export function parseSseBlock(block: string): { eventName: string; data: Record<string, unknown> } | null {
  if (!block.trim()) return null
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null
  try {
    return { eventName, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> }
  } catch {
    return null
  }
}

/** 解釈したイベントを、蓄積用と逐次再生用の両方で使える形に正規化する。 */
function interpretSseEvent(
  eventName: string,
  data: Record<string, unknown>,
  request: SpeechRequest,
): InterpretedEvent {
  if (data.error) {
    const error = data.error as { message?: string }
    return { kind: 'error', message: error.message ?? JSON.stringify(data.error).slice(0, 300) }
  }
  if (eventName === 'error') {
    return {
      kind: 'error',
      message: typeof data.message === 'string' ? data.message : 'upstream がストリーム内でエラーを返しました',
    }
  }
  if (eventName === 'done' || data.type === 'speech.audio.done') return { kind: 'done' }

  // Irodori-TTS-Server: 各チャンクが完全な音声ファイル
  const complete = (data.audio_base64 as string | undefined) ?? (data.media_type ? (data.audio as string) : undefined)
  if (typeof complete === 'string') {
    return {
      kind: 'chunk',
      bytes: base64ToBytes(complete),
      format: (data.format as string | undefined) ?? request.responseFormat,
      text: typeof data.text === 'string' ? data.text.trim() : '',
      seed: typeof data.seed === 'number' ? data.seed : null,
      totalToDecode: typeof data.total_to_decode === 'number' ? data.total_to_decode : null,
    }
  }

  // OpenAI: speech.audio.delta は生の音声バイトを base64 で運ぶ（単体では再生できない）
  const delta = (data.audio as string | undefined) ?? (data.delta as string | undefined)
  if (typeof delta === 'string') {
    return { kind: 'delta', bytes: base64ToBytes(delta) }
  }
  return { kind: 'done' }
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value.replace(/\s+/g, ''), 'base64'))
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/** Uint8Array を Blob に入れられる形へ整える（TS の ArrayBufferLike 差異を吸収）。 */
function toBlobPart(bytes: Uint8Array): BlobPart {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function consumeSse(response: Response, request: SpeechRequest): Promise<SseAudio> {
  if (!response.body) throw new UpstreamError('stream の body がありません', 502)
  const collected: SseAudio = { complete: [], deltas: [], chunkFormats: [], transcripts: [] }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamError: string | null = null

  const processBlock = (block: string): void => {
    const parsed = parseSseBlock(block)
    if (!parsed) return
    const event = interpretSseEvent(parsed.eventName, parsed.data, request)
    if (event.kind === 'error') {
      streamError = event.message
    } else if (event.kind === 'chunk') {
      collected.complete.push(event.bytes)
      collected.chunkFormats.push(event.format)
      if (event.text) collected.transcripts.push(event.text)
    } else if (event.kind === 'delta') {
      collected.deltas.push(event.bytes)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.indexOf('\n\n')
    while (index >= 0) {
      processBlock(buffer.slice(0, index))
      buffer = buffer.slice(index + 2)
      index = buffer.indexOf('\n\n')
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) processBlock(buffer)
  if (streamError) throw new UpstreamError(streamError, 502)
  return collected
}

export async function synthesize(request: SpeechRequest): Promise<SpeechOutcome> {
  const url = joinUrl(request.upstream.baseUrl, 'audio/speech')
  const body = buildSpeechBody(request)
  const started = Date.now()

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...buildUpstreamHeaders(request.upstream.apiKey) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new UpstreamError(
      timedOut ? `upstream がタイムアウトしました（${SPEECH_TIMEOUT_MS}ms）` : `upstream に接続できません: ${message}`,
      timedOut ? 504 : 502,
    )
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new UpstreamError(
      `upstream がエラーを返しました（HTTP ${response.status}）${detail ? `: ${detail}` : ''}`,
      response.status === 401 || response.status === 403 ? response.status : 502,
      detail,
    )
  }

  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  const contentType = headers['content-type'] ?? ''

  if (request.useSse || contentType.includes('text/event-stream')) {
    const collected = await consumeSse(response, request)
    if (collected.complete.length) {
      const chunks = collected.complete
      const format = (collected.chunkFormats[0] as TtsFormat | undefined) ?? request.responseFormat
      return {
        upstreamStatus: response.status,
        result: {
          audio: new Blob([toBlobPart(concatBytes(chunks))], {
            type: MEDIA_TYPES[format] ?? 'application/octet-stream',
          }),
          format,
          mediaType: MEDIA_TYPES[format] ?? 'application/octet-stream',
          bytes: chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
          elapsedMs: Date.now() - started,
          mode: 'chunks',
          chunkCount: chunks.length,
          transcripts: collected.transcripts,
          headers,
          upstreamStatus: response.status,
        },
      }
    }
    if (!collected.deltas.length) {
      throw new UpstreamError('SSE ストリームに音声データが含まれていませんでした', 502)
    }
    const merged = concatBytes(collected.deltas)
    return {
      upstreamStatus: response.status,
      result: {
        audio: new Blob([toBlobPart(merged)], { type: MEDIA_TYPES[request.responseFormat] }),
        format: request.responseFormat,
        mediaType: MEDIA_TYPES[request.responseFormat],
        bytes: merged.byteLength,
        elapsedMs: Date.now() - started,
        mode: 'sse',
        chunkCount: collected.deltas.length,
        transcripts: collected.transcripts,
        headers,
        upstreamStatus: response.status,
      },
    }
  }

  const buffer = new Uint8Array(await response.arrayBuffer())
  return {
    upstreamStatus: response.status,
    result: {
      audio: new Blob([toBlobPart(buffer)], { type: contentType || MEDIA_TYPES[request.responseFormat] }),
      format: request.responseFormat,
      mediaType: contentType || MEDIA_TYPES[request.responseFormat],
      bytes: buffer.byteLength,
      elapsedMs: Date.now() - started,
      mode: 'single',
      chunkCount: 1,
      transcripts: [],
      headers,
      upstreamStatus: response.status,
    },
  }
}

/**
 * SSE を受信しつつ、チャンクが届くたびに流す。
 *
 * Irodori-TTS-Server は 1 チャンク = 完全な音声ファイルなので、そのまま再生できる。
 * OpenAI の `speech.audio.delta` は生バイトで単体再生できないため、
 * ストリーム終了時に 1 チャンクへまとめて送出する。
 */
export async function* streamSynthesize(
  request: SpeechRequest,
  signal?: AbortSignal,
): AsyncGenerator<SpeechChunkEvent> {
  const url = joinUrl(request.upstream.baseUrl, 'audio/speech')
  const body = { ...buildSpeechBody(request), stream_format: 'sse' }

  const timeout = AbortSignal.timeout(SPEECH_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...buildUpstreamHeaders(request.upstream.apiKey) },
      body: JSON.stringify(body),
      signal: combined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    yield { type: 'error', message: `upstream に接続できません: ${message}` }
    return
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    yield {
      type: 'error',
      message: `upstream がエラーを返しました（HTTP ${response.status}）${detail ? `: ${detail}` : ''}`,
    }
    return
  }
  if (!response.body) {
    yield { type: 'error', message: 'stream の body がありません' }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let index = 0
  const pendingDeltas: Uint8Array[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const parsed = parseSseBlock(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
        if (!parsed) continue
        const event = interpretSseEvent(parsed.eventName, parsed.data, request)
        if (event.kind === 'error') {
          yield { type: 'error', message: event.message }
          return
        }
        if (event.kind === 'delta') {
          pendingDeltas.push(event.bytes)
          continue
        }
        if (event.kind !== 'chunk') continue
        yield {
          type: 'chunk',
          index: index++,
          text: event.text,
          format: event.format,
          mediaType: MEDIA_TYPES[event.format] ?? 'application/octet-stream',
          audioBase64: Buffer.from(event.bytes).toString('base64'),
          seed: event.seed,
          totalToDecode: event.totalToDecode,
        }
      }
    }

    // 生デルタしか来なかった場合は、まとめて 1 チャンクとして送出する。
    if (index === 0 && pendingDeltas.length) {
      const merged = concatBytes(pendingDeltas)
      yield {
        type: 'chunk',
        index: 0,
        text: '',
        format: request.responseFormat,
        mediaType: MEDIA_TYPES[request.responseFormat] ?? 'application/octet-stream',
        audioBase64: Buffer.from(merged).toString('base64'),
        seed: null,
        totalToDecode: null,
      }
      index = 1
    }
    yield { type: 'done', chunks: index }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

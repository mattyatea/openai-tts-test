import type { TtsFormat } from '@/contract'
import { client, errorMessage } from './orpc'

export const MEDIA_TYPES: Record<TtsFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/L16',
}

/** raw PCM（16bit LE モノラル）を WAV に包む。ヘッダが無いと再生できないため。 */
export function pcmToWav(pcm: ArrayBuffer, sampleRate: number): Blob {
  const samples = new Uint8Array(pcm)
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeText = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  const channels = 1
  const bits = 16
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.byteLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, (sampleRate * channels * bits) / 8, true)
  view.setUint16(32, (channels * bits) / 8, true)
  view.setUint16(34, bits, true)
  writeText(36, 'data')
  view.setUint32(40, samples.byteLength, true)
  return new Blob([header, samples], { type: 'audio/wav' })
}

export interface SpeakOutcome {
  url: string
  blob: Blob
  bytes: number
  elapsedMs: number
  mode: string
  chunkCount: number
  headers: Record<string, string>
  upstreamStatus: number
}

/** サーバー経由で音声を生成し、再生できる ObjectURL を返す。 */
export async function speakToUrl(
  request: Parameters<typeof client.tts.speak>[0],
  pcmSampleRate = 24000,
): Promise<SpeakOutcome> {
  const result = await client.tts.speak(request)
  const blob =
    result.format === 'pcm'
      ? pcmToWav(await result.audio.arrayBuffer(), pcmSampleRate)
      : result.audio
  return {
    url: URL.createObjectURL(blob),
    blob,
    bytes: result.bytes,
    elapsedMs: result.elapsedMs,
    mode: result.mode,
    chunkCount: result.chunkCount,
    headers: result.headers,
    upstreamStatus: result.upstreamStatus,
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** base64 を ArrayBuffer に戻す。Blob へそのまま渡せる型にするため buffer を返す。 */
function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value.replace(/\s+/g, ''))
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index += 1) view[index] = binary.charCodeAt(index)
  return buffer
}

export interface StreamingSpeechHandle {
  /** 受信したチャンク数。 */
  readonly chunkCount: number
  /** 生成が終わるまで待つ。 */
  done: Promise<void>
  stop: () => void
}

export interface PlayStreamOptions {
  onProgress?: (info: { chunkCount: number; playing: boolean }) => void
  onError?: (message: string) => void
  /**
   * 最初のチャンクを鳴らす前に待つ処理。
   * 複数の文を先読みしつつ、再生だけを順番にしたいときに使う。
   */
  beforePlay?: () => Promise<void>
}

/**
 * tts.stream を購読し、チャンクが届くたびに順番に再生する。
 * Irodori は 1 チャンクが完全な音声ファイルなので、受信しながら鳴らせる。
 */
export function playStream(
  request: Parameters<typeof client.tts.stream>[0],
  options: PlayStreamOptions = {},
): StreamingSpeechHandle {
  const controller = new AbortController()
  let chunkCount = 0
  let stopped = false
  let current: HTMLAudioElement | null = null
  const blobUrls: string[] = []

  /** 1 チャンクを再生し終わるまで待つ。 */
  function playBlob(blob: Blob): Promise<void> {
    if (stopped) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      blobUrls.push(url)
      const audio = new Audio(url)
      current = audio
      audio.onended = () => {
        current = null
        resolve()
      }
      audio.onerror = () => {
        current = null
        reject(new Error('音声の再生に失敗しました'))
      }
      audio.play().catch((error: unknown) => {
        current = null
        reject(error)
      })
    })
  }

  async function run(): Promise<void> {
    // 受信したチャンクを、届いた順に直列で鳴らす。
    let chain: Promise<void> = Promise.resolve()
    // 受信はすぐ始め、再生の順番待ちだけをここで待つ。
    const ready = options.beforePlay?.() ?? Promise.resolve()
    try {
      const iterator = await client.tts.stream(request, { signal: controller.signal })
      for await (const event of iterator) {
        if (stopped) break
        if (event.type === 'error') {
          options.onError?.(event.message)
          continue
        }
        if (event.type !== 'chunk') continue
        chunkCount += 1
        const blob = new Blob([base64ToArrayBuffer(event.audioBase64)], { type: event.mediaType })
        chain = chain.then(async () => {
          await ready
          if (stopped) return
          options.onProgress?.({ chunkCount, playing: true })
          await playBlob(blob)
        })
      }
      await chain
    } finally {
      options.onProgress?.({ chunkCount, playing: false })
      for (const url of blobUrls) URL.revokeObjectURL(url)
    }
  }

  return {
    get chunkCount() {
      return chunkCount
    },
    done: run().catch((error) => {
      if (!controller.signal.aborted) options.onError?.(errorMessage(error))
    }),
    stop: () => {
      stopped = true
      controller.abort()
      if (current) {
        current.pause()
        current = null
      }
    },
  }
}

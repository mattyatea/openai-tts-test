import type { TtsFormat } from '@/contract'
import { client } from './orpc'

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

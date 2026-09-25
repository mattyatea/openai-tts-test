/**
 * テキストを順番に TTS へ流して再生するキュー。
 *
 * 1 つの発話は 1 回のリクエストで生成する。長文は Irodori-TTS-Server 側が
 * `chunk_min_chars` で分割し、SSE で順次返す。アプリ側で分割しなくても
 * 最初のチャンクが届いた時点で鳴り始める。
 *
 * GPT Live の返答は確定してから enqueue する使い方を想定。
 */

import { computed, ref, shallowRef } from 'vue'

import type { SpeechRequest } from '@/contract'
import { playStream, speakToUrl, type StreamingSpeechHandle } from '../lib/audio'
import { errorMessage } from '../lib/orpc'

export interface QueueItem {
  id: number
  text: string
  status: 'pending' | 'synthesizing' | 'playing' | 'done' | 'error' | 'skipped'
  error?: string
}

export interface SpeechQueueOptions {
  /** リクエストを組み立てる。再生直前に呼ばれるので最新の設定が反映される。 */
  buildRequest: (text: string) => SpeechRequest
  /** ストリーミングを使わず一括生成する。 */
  useStreaming?: () => boolean
  onError?: (message: string) => void
  onPlaying?: (item: QueueItem) => void
}

export function useSpeechQueue(options: SpeechQueueOptions) {
  const items = shallowRef<QueueItem[]>([])
  const speaking = ref(false)
  const currentId = ref<number | null>(null)
  let nextId = 1
  let active: StreamingSpeechHandle | null = null
  let currentAudio: HTMLAudioElement | null = null
  let draining = false
  let generation = 0
  /** 直前の項目の再生が終わるまでを表す。次文の合成は先に進めつつ、再生だけ順番にする。 */
  let playbackTail: Promise<void> = Promise.resolve()

  const pendingCount = computed(() => items.value.filter((item) => item.status === 'pending').length)
  /** いま鳴っている文。画面表示用。 */
  const currentText = computed(
    () => items.value.find((item) => item.id === currentId.value)?.text ?? '',
  )

  function patch(id: number, changes: Partial<QueueItem>): void {
    items.value = items.value.map((item) => (item.id === id ? { ...item, ...changes } : item))
  }

  function stop(): void {
    generation += 1
    active?.stop()
    active = null
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    playbackTail = Promise.resolve()
    speaking.value = false
    currentId.value = null
    items.value = items.value.map((item) =>
      item.status === 'pending' || item.status === 'synthesizing' || item.status === 'playing'
        ? { ...item, status: 'skipped' }
        : item,
    )
  }

  function clear(): void {
    stop()
    items.value = []
  }

  async function play(item: QueueItem, token: number): Promise<void> {
    patch(item.id, { status: 'synthesizing' })
    const streaming = options.useStreaming?.() ?? true
    const request = { ...options.buildRequest(item.text), useSse: streaming }

    // 前の項目の再生完了を待つためのゲート。合成自体はすぐ始まる。
    const turn = playbackTail
    let releaseTurn: () => void = () => undefined
    playbackTail = new Promise<void>((resolve) => {
      releaseTurn = resolve
    })

    if (!streaming) {
      // SSE 非対応のサーバー向け: 一括生成してから鳴らす。
      try {
        await turn
        const result = await speakToUrl(request)
        if (token === generation) {
          patch(item.id, { status: 'playing' })
          speaking.value = true
          currentId.value = item.id
          await playBlob(result.blob)
        }
        URL.revokeObjectURL(result.url)
      } finally {
        releaseTurn()
      }
    } else {
      // 最初のチャンクが届いた時点で「再生中」に切り替える。
      const handle = playStream(request, {
        beforePlay: () => turn,
        onProgress: ({ chunkCount }) => {
          if (chunkCount > 0) {
            patch(item.id, { status: 'playing' })
            speaking.value = true
            currentId.value = item.id
          }
        },
        onError: (message) => options.onError?.(message),
      })
      active = handle
      try {
        await handle.done
      } finally {
        if (active === handle) active = null
        releaseTurn()
      }
    }
    if (token !== generation) return
    patch(item.id, { status: 'done' })
    if (currentId.value === item.id) {
      speaking.value = false
      currentId.value = null
    }
  }

  /** 一括生成した音声を 1 回鳴らす。 */
  function playBlob(blob: Blob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudio = audio
      audio.onended = () => {
        currentAudio = null
        URL.revokeObjectURL(url)
        resolve()
      }
      audio.onerror = () => {
        currentAudio = null
        URL.revokeObjectURL(url)
        reject(new Error('音声の再生に失敗しました'))
      }
      audio.play().catch((error: unknown) => {
        currentAudio = null
        URL.revokeObjectURL(url)
        reject(error)
      })
    })
  }

  /** 先読みする文の数。合成は先に進め、再生だけを順番に保つ。 */
  const LOOKAHEAD = 2

  async function drain(): Promise<void> {
    if (draining) return
    draining = true
    try {
      const inflight: Array<Promise<void>> = []
      while (true) {
        const next = items.value.find((item) => item.status === 'pending')
        if (!next) break
        const token = generation
        const task = play(next, token)
          .catch((caught: unknown) => {
            const message = errorMessage(caught)
            patch(next.id, { status: 'error', error: message })
            options.onError?.(message)
          })
          .finally(() => {
            const index = inflight.indexOf(task)
            if (index >= 0) inflight.splice(index, 1)
          })
        inflight.push(task)
        // 先読み分を超えたら、いちばん古い項目の完了を待つ。
        if (inflight.length >= LOOKAHEAD) await inflight[0]
        if (token !== generation) break
      }
      await Promise.all(inflight)
    } finally {
      draining = false
      speaking.value = false
      currentId.value = null
      if (items.value.some((item) => item.status === 'pending')) void drain()
    }
  }

  function enqueue(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const item: QueueItem = { id: nextId++, text: trimmed, status: 'pending' }
    items.value = [...items.value, item]
    void drain()
  }

  return { items, speaking, currentId, currentText, pendingCount, enqueue, stop, clear }
}

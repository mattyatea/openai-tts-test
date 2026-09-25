/**
 * テキストを順番に TTS へ流して再生するキュー。
 * GPT Live の返答テキストが確定するたびに enqueue する使い方を想定。
 */

import { computed, ref, shallowRef } from 'vue'

import type { SpeechRequest } from '@/contract'
import { speakToUrl } from '../lib/audio'
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
  pcmSampleRate?: () => number
  onError?: (message: string) => void
}

export function useSpeechQueue(options: SpeechQueueOptions) {
  const items = shallowRef<QueueItem[]>([])
  const speaking = ref(false)
  const currentId = ref<number | null>(null)
  let nextId = 1
  let audio: HTMLAudioElement | null = null
  let draining = false
  let generation = 0

  const pendingCount = computed(() => items.value.filter((item) => item.status === 'pending').length)

  function patch(id: number, changes: Partial<QueueItem>): void {
    items.value = items.value.map((item) => (item.id === id ? { ...item, ...changes } : item))
  }

  function stop(): void {
    generation += 1
    if (audio) {
      audio.pause()
      audio.src = ''
      audio = null
    }
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
    const request = options.buildRequest(item.text)
    const result = await speakToUrl(request, options.pcmSampleRate?.() ?? 24000)
    if (token !== generation) {
      URL.revokeObjectURL(result.url)
      return
    }
    patch(item.id, { status: 'playing' })
    await new Promise<void>((resolve, reject) => {
      const element = new Audio(result.url)
      audio = element
      element.onended = () => resolve()
      element.onerror = () => reject(new Error('音声の再生に失敗しました'))
      element.play().catch(reject)
    })
    URL.revokeObjectURL(result.url)
    if (audio) audio = null
    patch(item.id, { status: 'done' })
  }

  async function drain(): Promise<void> {
    if (draining) return
    draining = true
    try {
      while (true) {
        const next = items.value.find((item) => item.status === 'pending')
        if (!next) break
        const token = generation
        speaking.value = true
        currentId.value = next.id
        try {
          await play(next, token)
        } catch (caught) {
          const message = errorMessage(caught)
          patch(next.id, { status: 'error', error: message })
          options.onError?.(message)
        } finally {
          speaking.value = false
          currentId.value = null
        }
        if (token !== generation) break
      }
    } finally {
      draining = false
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

  return { items, speaking, currentId, pendingCount, enqueue, stop, clear }
}

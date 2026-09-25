/** 読み上げ先（OpenAI 互換 TTS）の設定。Playground と Live で同じ形を使う。 */

import { computed, type Ref } from 'vue'

import type { SpeechRequest, TtsFormat } from '@/contract'
import { useLocalStorage } from '../lib/useLocalStorage'

export interface TtsSettings {
  presetId: string
  baseUrl: string
  apiKey: string
  rememberKey: boolean
  model: string
  voice: string
  format: TtsFormat
  pcmRate: number
  speed: number
  instructions: string
  useSpeed: boolean
  useInstructions: boolean
  useSse: boolean
  /** GPT Live ページでのみ使う: 返答確定後に自動で読み上げるか。 */
  autoSpeak: boolean
  /** ストリーミング合成を使うか。OpenAI の tts-1 / tts-1-hd は非対応。 */
  useStreaming: boolean
}

export function createTtsSettings(overrides: Partial<TtsSettings> = {}): TtsSettings {
  return {
    presetId: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    rememberKey: false,
    model: 'gpt-4o-mini-tts',
    voice: 'coral',
    format: 'mp3',
    pcmRate: 24000,
    speed: 1,
    instructions: '',
    useSpeed: true,
    useInstructions: false,
    useSse: false,
    autoSpeak: true,
    useStreaming: true,
    ...overrides,
  }
}

export function useTtsSettings(key: string, overrides: Partial<TtsSettings> = {}) {
  const settings = useLocalStorage<TtsSettings>(key, createTtsSettings(overrides))

  /** TTS リクエストを組み立てる。irodori は呼び出し側が足す。 */
  function buildRequest(input: string, extra?: Partial<SpeechRequest>): SpeechRequest {
    return {
      upstream: { baseUrl: settings.value.baseUrl, apiKey: settings.value.apiKey || undefined },
      model: settings.value.model,
      input,
      voice: settings.value.voice || undefined,
      responseFormat: settings.value.format,
      speed: settings.value.useSpeed ? settings.value.speed : undefined,
      instructions: settings.value.useInstructions ? settings.value.instructions || undefined : undefined,
      useSse: settings.value.useSse,
      ...extra,
    }
  }

  return { settings: settings as Ref<TtsSettings>, buildRequest }
}

export function useTtsOptionLists(info: Ref<{ openaiVoices: string[]; openaiModels: string[] } | null>) {
  const modelOptions = computed(() =>
    (info.value?.openaiModels ?? ['gpt-4o-mini-tts']).map((value) => ({ value, label: value })),
  )
  const voiceOptions = computed(() =>
    (info.value?.openaiVoices ?? ['coral']).map((value) => ({ value, label: value })),
  )
  const formatOptions: Array<{ value: TtsFormat; label: string }> = [
    { value: 'mp3', label: 'mp3' },
    { value: 'wav', label: 'wav' },
    { value: 'opus', label: 'opus' },
    { value: 'aac', label: 'aac' },
    { value: 'flac', label: 'flac' },
    { value: 'pcm', label: 'pcm（再生時に WAV 化）' },
  ]
  return { modelOptions, voiceOptions, formatOptions }
}

/** Irodori-TTS 固有パラメータの入力状態と、送信用オブジェクトの組み立て。 */

import { reactive, ref } from 'vue'

import type { IrodoriOptions } from '@/contract'

const NUMBER_FIELDS: Array<keyof IrodoriOptions> = [
  'num_steps',
  'seed',
  'cfg_scale_text',
  'cfg_scale_caption',
  'cfg_scale_speaker',
  'sway_coeff',
  'duration_scale',
  'seconds',
  'chunk_min_chars',
  'first_sentence_chunk_min_chars',
  'num_candidates',
  'min_seconds',
  'max_seconds',
  'max_ref_seconds',
  'ref_normalize_db',
  'max_text_len',
  'max_caption_len',
  'truncation_factor',
  'rescale_k',
  'rescale_sigma',
  'cfg_scale',
  'cfg_min_t',
  'cfg_max_t',
  'speaker_kv_scale',
  'speaker_kv_min_t',
  'speaker_kv_max_layers',
  'tail_window_size',
  'tail_std_threshold',
  'tail_mean_threshold',
]

const BOOLEAN_FIELDS: Array<keyof IrodoriOptions> = [
  'ref_ensure_max',
  'context_kv_cache',
  'trim_tail',
  'chunking_enabled',
]

const TEXT_FIELDS: Array<keyof IrodoriOptions> = [
  'caption',
  'ref_wav',
  'ref_latent',
  'ref_embed',
  'lora_adapter',
  'cfg_guidance_mode',
  't_schedule_mode',
  'decode_mode',
]

export function useIrodoriOptions(enabled: ReturnType<typeof ref<boolean>> = ref(false)) {
  const fields = reactive<Record<string, string>>({})

  function build(): IrodoriOptions | undefined {
    if (!enabled.value) return undefined
    const options: IrodoriOptions = {}
    for (const name of NUMBER_FIELDS) {
      const raw = fields[name as string]
      if (raw === undefined || raw === '') continue
      const value = Number(raw)
      if (Number.isFinite(value)) (options as Record<string, unknown>)[name] = value
    }
    for (const name of BOOLEAN_FIELDS) {
      const raw = fields[name as string]
      if (raw !== 'true' && raw !== 'false') continue
      ;(options as Record<string, unknown>)[name] = raw === 'true'
    }
    for (const name of TEXT_FIELDS) {
      const raw = fields[name as string]?.trim()
      if (!raw) continue
      ;(options as Record<string, unknown>)[name] = raw
    }
    return Object.keys(options).length ? options : undefined
  }

  function reset(): void {
    for (const key of Object.keys(fields)) delete fields[key]
  }

  return { fields, build, reset, enabled }
}

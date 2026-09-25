<script setup lang="ts">
/**
 * Irodori-TTS の `irodori` オブジェクトに入れるフィールド群。
 * Playground と GPT Live の両方から同じ見た目で使う。
 */

import AppInput from '../ui/AppInput.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import FieldRow from '../ui/FieldRow.vue'

const fields = defineModel<Record<string, string>>({ required: true })

const guidanceOptions = [
  { value: '', label: '未指定' },
  { value: 'independent', label: 'independent' },
  { value: 'joint', label: 'joint' },
  { value: 'alternating', label: 'alternating' },
]

const scheduleOptions = [
  { value: '', label: '未指定' },
  { value: 'linear', label: 'linear' },
  { value: 'sway', label: 'sway' },
]

const decodeOptions = [
  { value: '', label: '未指定' },
  { value: 'sequential', label: 'sequential' },
  { value: 'batch', label: 'batch' },
]

const triStateOptions = [
  { value: '', label: '未指定' },
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <FieldRow label="caption" hint="Voice Design / 声質と話し方の指示">
      <AppTextarea
        v-model="fields.caption"
        :rows="2"
        placeholder="落ち着いた低めの女性の声。丁寧で穏やかな話し方。"
      />
    </FieldRow>

    <div class="grid gap-3 sm:grid-cols-2">
      <FieldRow label="num_steps" hint="既定 RF 40 / MeanFlow 4">
        <AppInput v-model="fields.num_steps" type="number" placeholder="40" />
      </FieldRow>
      <FieldRow label="seed" hint="空ならランダム">
        <AppInput v-model="fields.seed" type="number" placeholder="1234" />
      </FieldRow>
      <FieldRow label="cfg_scale_text">
        <AppInput v-model="fields.cfg_scale_text" type="number" placeholder="3.0" />
      </FieldRow>
      <FieldRow label="cfg_scale_caption">
        <AppInput v-model="fields.cfg_scale_caption" type="number" placeholder="3.0" />
      </FieldRow>
      <FieldRow label="cfg_scale_speaker">
        <AppInput v-model="fields.cfg_scale_speaker" type="number" placeholder="5.0" />
      </FieldRow>
      <FieldRow label="cfg_guidance_mode">
        <AppSelect v-model="fields.cfg_guidance_mode" :options="guidanceOptions" />
      </FieldRow>
      <FieldRow label="t_schedule_mode">
        <AppSelect v-model="fields.t_schedule_mode" :options="scheduleOptions" />
      </FieldRow>
      <FieldRow label="sway_coeff">
        <AppInput v-model="fields.sway_coeff" type="number" placeholder="-1.0" />
      </FieldRow>
      <FieldRow label="duration_scale">
        <AppInput v-model="fields.duration_scale" type="number" placeholder="1.0" />
      </FieldRow>
      <FieldRow label="seconds" hint="指定すると自動推定を使わない">
        <AppInput v-model="fields.seconds" type="number" placeholder="自動" />
      </FieldRow>
    </div>

    <details>
      <summary class="cursor-pointer text-[11px] text-slate-400 select-none">参照音声と LoRA</summary>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <FieldRow label="ref_wav" hint="サーバー側のパス">
          <AppInput v-model="fields.ref_wav" mono placeholder="/path/to/ref.wav" />
        </FieldRow>
        <FieldRow label="ref_wavs" hint="カンマ区切りで複数指定">
          <AppInput v-model="fields.ref_wavs" mono placeholder="/a.wav,/b.wav" />
        </FieldRow>
        <FieldRow label="ref_latent">
          <AppInput v-model="fields.ref_latent" mono placeholder="/path/to/ref.pt" />
        </FieldRow>
        <FieldRow label="ref_latents" hint="カンマ区切りで複数指定">
          <AppInput v-model="fields.ref_latents" mono placeholder="/a.pt,/b.pt" />
        </FieldRow>
        <FieldRow label="ref_embed" hint="Speaker Inversion">
          <AppInput v-model="fields.ref_embed" mono placeholder="/path/to/speaker.safetensors" />
        </FieldRow>
        <FieldRow label="lora_adapter" hint="lab-02 ではモデル選択で切り替わります">
          <AppInput v-model="fields.lora_adapter" mono placeholder="/models/adapters/speaker-a" />
        </FieldRow>
        <FieldRow label="no_ref" hint="参照なしで合成する">
          <AppSelect v-model="fields.no_ref" :options="triStateOptions" />
        </FieldRow>
        <FieldRow label="max_ref_seconds">
          <AppInput v-model="fields.max_ref_seconds" type="number" placeholder="v4 Small は 120" />
        </FieldRow>
        <FieldRow label="ref_normalize_db">
          <AppInput v-model="fields.ref_normalize_db" type="number" placeholder="-16.0" />
        </FieldRow>
        <FieldRow label="ref_ensure_max">
          <AppSelect v-model="fields.ref_ensure_max" :options="triStateOptions" />
        </FieldRow>
      </div>
    </details>

    <details>
      <summary class="cursor-pointer text-[11px] text-slate-400 select-none">長文分割と上級パラメータ</summary>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <FieldRow label="chunking_enabled">
          <AppSelect v-model="fields.chunking_enabled" :options="triStateOptions" />
        </FieldRow>
        <FieldRow label="chunk_min_chars">
          <AppInput v-model="fields.chunk_min_chars" type="number" placeholder="サーバー既定" />
        </FieldRow>
        <FieldRow label="first_sentence_chunk_min_chars">
          <AppInput v-model="fields.first_sentence_chunk_min_chars" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="num_candidates">
          <AppInput v-model="fields.num_candidates" type="number" placeholder="1" />
        </FieldRow>
        <FieldRow label="decode_mode">
          <AppSelect v-model="fields.decode_mode" :options="decodeOptions" />
        </FieldRow>
        <FieldRow label="min_seconds">
          <AppInput v-model="fields.min_seconds" type="number" placeholder="サーバー既定" />
        </FieldRow>
        <FieldRow label="max_seconds">
          <AppInput v-model="fields.max_seconds" type="number" placeholder="サーバー既定" />
        </FieldRow>
        <FieldRow label="max_text_len">
          <AppInput v-model="fields.max_text_len" type="number" placeholder="チェックポイント既定" />
        </FieldRow>
        <FieldRow label="max_caption_len">
          <AppInput v-model="fields.max_caption_len" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="truncation_factor">
          <AppInput v-model="fields.truncation_factor" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="rescale_k">
          <AppInput v-model="fields.rescale_k" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="rescale_sigma">
          <AppInput v-model="fields.rescale_sigma" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="cfg_scale" hint="非推奨の共通上書き">
          <AppInput v-model="fields.cfg_scale" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="cfg_min_t">
          <AppInput v-model="fields.cfg_min_t" type="number" placeholder="0.5" />
        </FieldRow>
        <FieldRow label="cfg_max_t">
          <AppInput v-model="fields.cfg_max_t" type="number" placeholder="1.0" />
        </FieldRow>
        <FieldRow label="context_kv_cache">
          <AppSelect v-model="fields.context_kv_cache" :options="triStateOptions" />
        </FieldRow>
        <FieldRow label="speaker_kv_scale">
          <AppInput v-model="fields.speaker_kv_scale" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="speaker_kv_min_t">
          <AppInput v-model="fields.speaker_kv_min_t" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="speaker_kv_max_layers">
          <AppInput v-model="fields.speaker_kv_max_layers" type="number" placeholder="未指定" />
        </FieldRow>
        <FieldRow label="trim_tail">
          <AppSelect v-model="fields.trim_tail" :options="triStateOptions" />
        </FieldRow>
        <FieldRow label="tail_window_size">
          <AppInput v-model="fields.tail_window_size" type="number" placeholder="サーバー既定" />
        </FieldRow>
        <FieldRow label="tail_std_threshold">
          <AppInput v-model="fields.tail_std_threshold" type="number" placeholder="サーバー既定" />
        </FieldRow>
        <FieldRow label="tail_mean_threshold">
          <AppInput v-model="fields.tail_mean_threshold" type="number" placeholder="サーバー既定" />
        </FieldRow>
      </div>
    </details>
  </div>
</template>

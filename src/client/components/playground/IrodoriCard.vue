<script setup lang="ts">
import AppInput from '../ui/AppInput.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import FieldRow from '../ui/FieldRow.vue'
import SectionCard from '../ui/SectionCard.vue'

const enabled = defineModel<boolean>('enabled', { required: true })
const fields = defineModel<Record<string, string>>('fields', { required: true })
defineProps<{ available: boolean }>()

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
</script>

<template>
  <SectionCard step="3" title="Irodori-TTS 固有パラメータ" :dimmed="!available">
    <template #actions>
      <span class="rounded-full border border-amber-900 px-2 py-0.5 text-[10px] text-amber-300">
        OpenAI へは送らない
      </span>
    </template>

    <AppSwitch v-model="enabled" label="irodori オブジェクトを送る" :disabled="!available" />

    <div class="mt-3 flex flex-col gap-3">
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
        <FieldRow label="ref_wav" hint="サーバー側のパス">
          <AppInput v-model="fields.ref_wav" mono placeholder="/path/to/ref.wav" />
        </FieldRow>
        <FieldRow label="ref_embed" hint="Speaker Inversion">
          <AppInput v-model="fields.ref_embed" mono placeholder="/path/to/speaker.safetensors" />
        </FieldRow>
        <FieldRow label="lora_adapter">
          <AppInput v-model="fields.lora_adapter" mono placeholder="/models/adapters/speaker-a" />
        </FieldRow>
        <FieldRow label="chunk_min_chars">
          <AppInput v-model="fields.chunk_min_chars" type="number" placeholder="サーバー既定" />
        </FieldRow>
      </div>
    </div>
  </SectionCard>
</template>

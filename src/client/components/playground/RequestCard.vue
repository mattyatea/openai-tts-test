<script setup lang="ts">
import AppSelect from '../ui/AppSelect.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import FieldRow from '../ui/FieldRow.vue'
import SectionCard from '../ui/SectionCard.vue'
import type { TtsFormat } from '@/contract'
import type { TtsSettings } from '@/client/composables/useTtsSettings'

const settings = defineModel<TtsSettings>({ required: true })
defineProps<{
  modelOptions: Array<{ value: string; label: string }>
  voiceOptions: Array<{ value: string; label: string }>
  formatOptions: Array<{ value: TtsFormat; label: string }>
}>()
</script>

<template>
  <SectionCard step="2" title="リクエスト">
    <div class="grid gap-3 sm:grid-cols-2">
      <FieldRow label="モデル">
        <AppSelect v-model="settings.model" :options="modelOptions" placeholder="モデルを選択" />
      </FieldRow>
      <FieldRow label="ボイス">
        <AppSelect v-model="settings.voice" :options="voiceOptions" placeholder="ボイスを選択" />
      </FieldRow>
      <FieldRow label="response_format">
        <AppSelect v-model="settings.format" :options="formatOptions" />
      </FieldRow>
      <FieldRow label="pcm サンプルレート" hint="再生用の WAV 変換に使用">
        <select
          v-model.number="settings.pcmRate"
          class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 hover:border-slate-600 focus-visible:border-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          <option :value="24000">24000（OpenAI）</option>
          <option :value="48000">48000（Irodori v4）</option>
          <option :value="44100">44100</option>
          <option :value="16000">16000</option>
        </select>
      </FieldRow>
    </div>

    <div class="mt-3 flex flex-col gap-3">
      <label class="flex flex-col gap-1.5">
        <span class="field-label">
          speed
          <output class="font-mono text-slate-300">{{ settings.speed.toFixed(2) }}</output>
        </span>
        <input v-model.number="settings.speed" type="range" min="0.25" max="4" step="0.05" class="accent-sky-500" />
      </label>
      <AppSwitch v-model="settings.useSpeed" label="speed を送る" />

      <FieldRow label="instructions" hint="gpt-4o-mini-tts のみ有効">
        <AppTextarea v-model="settings.instructions" :rows="3" placeholder="Speak in a cheerful and positive tone." />
      </FieldRow>
      <AppSwitch v-model="settings.useInstructions" label="instructions を送る" />
      <AppSwitch
        v-model="settings.useSse"
        label="stream_format: sse で受信"
        hint="OpenAI の tts-1 / tts-1-hd は非対応"
      />
    </div>
  </SectionCard>
</template>

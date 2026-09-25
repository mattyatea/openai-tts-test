<script setup lang="ts">
import { Play, VolumeX } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import AppInput from '../ui/AppInput.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import FieldRow from '../ui/FieldRow.vue'
import SectionCard from '../ui/SectionCard.vue'
import IrodoriOptionsFields from '../shared/IrodoriOptionsFields.vue'
import type { TtsSettings } from '@/client/composables/useTtsSettings'

const settings = defineModel<TtsSettings>({ required: true })
const irodoriEnabled = defineModel<boolean>('irodoriEnabled', { required: true })
const irodoriFields = defineModel<Record<string, string>>('irodoriFields', { required: true })

defineProps<{
  presetOptions: Array<{ value: string; label: string }>
  kind: string
  modelOptions: Array<{ value: string; label: string }>
  voiceOptions: Array<{ value: string; label: string }>
  pendingCount: number
  speaking: boolean
}>()

const emit = defineEmits<{ test: []; stop: []; preset: [id: string] }>()
</script>

<template>
  <SectionCard title="読み上げる TTS">
    <template #actions>
      <span class="rounded-full border border-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{{ kind }}</span>
      <AppButton size="sm" @click="emit('test')"><Play class="size-3" />テスト</AppButton>
    </template>

    <div class="grid gap-3 sm:grid-cols-2">
      <FieldRow label="モデル">
        <AppSelect v-model="settings.model" :options="modelOptions" />
      </FieldRow>
      <FieldRow label="ボイス">
        <AppSelect v-model="settings.voice" :options="voiceOptions" />
      </FieldRow>
      <FieldRow label="接続先" hint="OpenAI または OpenAI 互換サーバー">
        <AppSelect
          :model-value="settings.presetId"
          :options="presetOptions"
          @update:model-value="(value: string) => emit('preset', value)"
        />
      </FieldRow>
      <FieldRow label="API キー" hint="空ならサーバーの環境変数を使用">
        <AppInput v-model="settings.apiKey" type="password" placeholder="sk-..." mono />
      </FieldRow>
      <FieldRow label="response_format">
        <AppSelect
          v-model="settings.format"
          :options="[
            { value: 'mp3', label: 'mp3' },
            { value: 'wav', label: 'wav' },
            { value: 'opus', label: 'opus' },
            { value: 'aac', label: 'aac' },
            { value: 'flac', label: 'flac' },
          ]"
        />
      </FieldRow>
      <FieldRow label="speed">
        <input v-model.number="settings.speed" type="range" min="0.25" max="4" step="0.05" class="accent-sky-500" />
      </FieldRow>
    </div>

    <FieldRow class="mt-3" label="instructions" hint="読み上げ方の指示">
      <AppTextarea v-model="settings.instructions" :rows="2" />
    </FieldRow>

    <details class="mt-3">
      <summary class="cursor-pointer text-[11px] text-slate-400 select-none">
        Irodori-TTS 固有パラメータ
        <span v-if="kind === 'irodori'" class="ml-1 text-amber-300">（この接続先で有効）</span>
      </summary>
      <div class="mt-3 flex flex-col gap-3">
        <AppSwitch
          v-model="irodoriEnabled"
          label="irodori オブジェクトを送る"
          :disabled="kind !== 'irodori'"
          hint="caption や cfg_scale、参照音声の指定に使います"
        />
        <IrodoriOptionsFields v-model="irodoriFields" />
      </div>
    </details>

    <div class="mt-3 flex flex-col gap-2">
      <AppSwitch v-model="settings.autoSpeak" label="返答が確定したら自動で読み上げる" />
      <div class="flex flex-wrap items-center gap-2">
        <AppButton size="sm" :disabled="pendingCount === 0" @click="emit('stop')">
          <VolumeX class="size-3" />読み上げを止める
        </AppButton>
        <span class="text-[11px] text-slate-500">
          待ち {{ pendingCount }} 件 / 再生中 {{ speaking ? 'あり' : 'なし' }}
        </span>
      </div>
    </div>
  </SectionCard>
</template>

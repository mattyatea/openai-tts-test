<script setup lang="ts">
import { Play, VolumeX } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import AppInput from '../ui/AppInput.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import FieldRow from '../ui/FieldRow.vue'
import SectionCard from '../ui/SectionCard.vue'
import type { ProviderPreset } from '@/contract'
import type { TtsSettings } from '@/client/composables/useTtsSettings'

const settings = defineModel<TtsSettings>({ required: true })

defineProps<{
  presets: ProviderPreset[]
  modelOptions: Array<{ value: string; label: string }>
  voiceOptions: Array<{ value: string; label: string }>
  pendingCount: number
  speaking: boolean
}>()

const emit = defineEmits<{ test: []; stop: [] }>()
</script>

<template>
  <SectionCard title="読み上げる OpenAI TTS">
    <template #actions>
      <AppButton size="sm" @click="emit('test')"><Play class="size-3" />テスト</AppButton>
    </template>

    <div class="grid gap-3 sm:grid-cols-2">
      <FieldRow label="モデル">
        <AppSelect v-model="settings.model" :options="modelOptions" />
      </FieldRow>
      <FieldRow label="ボイス">
        <AppSelect v-model="settings.voice" :options="voiceOptions" />
      </FieldRow>
      <FieldRow label="base URL" hint="OpenAI または互換サーバー">
        <AppSelect
          :model-value="settings.baseUrl"
          :options="[
            { value: 'https://api.openai.com/v1', label: 'OpenAI' },
            ...presets
              .filter((preset) => preset.baseUrl && preset.baseUrl !== 'https://api.openai.com/v1')
              .map((preset) => ({ value: preset.baseUrl, label: preset.label })),
          ]"
          @update:model-value="(value: string) => (settings.baseUrl = value)"
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

<script setup lang="ts">
import { Plug, RefreshCw } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import AppInput from '../ui/AppInput.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import FieldRow from '../ui/FieldRow.vue'
import SectionCard from '../ui/SectionCard.vue'
import StatusNote from '../ui/StatusNote.vue'
import type { ProviderKind, ProviderPreset } from '@/contract'
import type { TtsSettings } from '@/client/composables/useTtsSettings'
import type { ProbeState } from '@/client/composables/useUpstreamProbe'

const settings = defineModel<TtsSettings>({ required: true })
defineProps<{
  kind: ProviderKind
  presets: ProviderPreset[]
  probe: ProbeState
  hasServerApiKey: boolean
}>()

const emit = defineEmits<{
  preset: [id: string]
  check: []
  models: []
  voices: []
}>()
</script>

<template>
  <SectionCard step="1" title="接続先">
    <template #actions>
      <span class="rounded-full border border-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{{ kind }}</span>
    </template>

    <div class="flex flex-col gap-3">
      <FieldRow label="プリセット">
        <AppSelect
          :model-value="settings.presetId"
          :options="presets.map((preset) => ({ value: preset.id, label: preset.label }))"
          @update:model-value="(value: string) => emit('preset', value)"
        />
      </FieldRow>

      <FieldRow label="base URL" hint="このページが直接リクエストする先">
        <AppInput v-model="settings.baseUrl" mono />
      </FieldRow>

      <FieldRow label="API キー" hint="サーバーには保存しません。リクエストごとに送ります">
        <AppInput v-model="settings.apiKey" type="password" placeholder="sk-..." mono />
      </FieldRow>
      <AppSwitch v-model="settings.rememberKey" label="API キーをこのブラウザに保存する（localStorage）" />

      <div class="flex flex-wrap items-center gap-2">
        <AppButton @click="emit('check')"><Plug class="size-3.5" />接続確認</AppButton>
        <AppButton @click="emit('models')"><RefreshCw class="size-3.5" />モデル取得</AppButton>
        <AppButton @click="emit('voices')"><RefreshCw class="size-3.5" />ボイス取得</AppButton>
      </div>

      <StatusNote :tone="probe.tone" :message="probe.message" />

      <p v-if="hasServerApiKey" class="text-[11px] text-slate-500">
        サーバー側に OPENAI_API_KEY が設定されています。上の入力が空ならそちらを使います。
      </p>
    </div>
  </SectionCard>
</template>

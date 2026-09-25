<script setup lang="ts">
import { Download, Play } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import SectionCard from '../ui/SectionCard.vue'
import StatusNote from '../ui/StatusNote.vue'
import type { SpeakOutcome } from '@/client/lib/audio'

defineProps<{
  running: boolean
  error: string | null
  result: SpeakOutcome | null
  headers: Record<string, string>
}>()

const emit = defineEmits<{ run: []; download: [] }>()
</script>

<template>
  <SectionCard step="5" title="実行">
    <div class="flex flex-wrap items-center gap-2">
      <AppButton variant="primary" :loading="running" @click="emit('run')">
        <Play class="size-3.5" />音声を生成
      </AppButton>
      <span class="text-[11px] text-slate-500">⌘/Ctrl + Enter でも実行</span>
    </div>

    <StatusNote v-if="error" class="mt-3" tone="error" :message="error" />

    <div v-if="result" class="mt-3 flex flex-col gap-2">
      <audio :src="result.url" controls autoplay class="w-full" />
      <div class="flex flex-wrap items-center gap-2">
        <AppButton size="sm" @click="emit('download')">
          <Download class="size-3.5" />ダウンロード
        </AppButton>
        <span class="text-[11px] text-slate-500">
          {{ (result.bytes / 1024).toFixed(1) }} KB / {{ (result.elapsedMs / 1000).toFixed(2) }} 秒 /
          {{ result.mode }}{{ result.chunkCount > 1 ? ` × ${result.chunkCount}` : '' }}
        </span>
      </div>
      <details>
        <summary class="cursor-pointer text-[11px] text-slate-400 select-none">レスポンスヘッダ</summary>
        <pre class="code-block mt-2">{{ JSON.stringify(headers, null, 2) }}</pre>
      </details>
    </div>
  </SectionCard>
</template>

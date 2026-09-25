<script setup lang="ts">
import { Send } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import SectionCard from '../ui/SectionCard.vue'
import type { LiveTranscript } from '@/client/composables/useGptLive'

const manualText = defineModel<string>('manualText', { required: true })
defineProps<{ transcripts: LiveTranscript[]; connected: boolean }>()
const emit = defineEmits<{ send: [] }>()
</script>

<template>
  <SectionCard title="トランスクリプト">
    <template #actions>
      <span class="text-[11px] text-slate-500">{{ transcripts.length }} 件</span>
    </template>

    <div class="flex max-h-[520px] min-h-40 flex-col gap-2 overflow-y-auto">
      <p v-if="transcripts.length === 0" class="text-[11px] text-slate-500">
        まだ会話がありません。開始後、マイクに話しかけるか下の欄からテキストを送ってください。
      </p>
      <div
        v-for="entry in transcripts"
        :key="entry.id"
        class="rounded-xl border px-3 py-2 text-sm leading-relaxed"
        :class="
          entry.role === 'assistant'
            ? 'border-sky-900/60 bg-sky-950/30 text-slate-100'
            : 'border-slate-800 bg-slate-950/60 text-slate-300'
        "
      >
        <div class="mb-1 flex items-center gap-2 text-[10px] text-slate-500">
          <span>{{ entry.role === 'assistant' ? 'GPT Live' : 'あなた' }}</span>
          <span v-if="!entry.final" class="text-amber-400">入力中…</span>
        </div>
        {{ entry.text }}
      </div>
    </div>

    <div class="mt-3 flex items-end gap-2">
      <AppTextarea
        v-model="manualText"
        :rows="2"
        placeholder="マイクの代わりにテキストで送る（Enter で送信、Shift+Enter で改行）"
        :disabled="!connected"
        class="flex-1"
        @keydown.enter.exact.prevent="emit('send')"
      />
      <AppButton variant="primary" :disabled="!connected" @click="emit('send')">
        <Send class="size-3.5" />送信
      </AppButton>
    </div>
  </SectionCard>
</template>

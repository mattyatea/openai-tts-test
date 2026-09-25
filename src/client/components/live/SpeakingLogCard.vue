<script setup lang="ts">
import { Square } from '@lucide/vue'

import SectionCard from '../ui/SectionCard.vue'

export interface SpeakingLogEntry {
  at: string
  text: string
}

defineProps<{ entries: SpeakingLogEntry[] }>()
</script>

<template>
  <SectionCard title="読み上げログ">
    <template #actions>
      <Square class="size-3.5 text-slate-500" />
    </template>

    <p v-if="entries.length === 0" class="text-[11px] text-slate-500">まだ読み上げていません。</p>
    <ul v-else class="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
      <li
        v-for="entry in entries"
        :key="entry.at + entry.text"
        class="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300"
      >
        <span class="font-mono text-slate-500">{{ entry.at }}</span>
        <span class="ml-2">{{ entry.text }}</span>
      </li>
    </ul>
  </SectionCard>
</template>

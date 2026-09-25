<script setup lang="ts">
import AppTextarea from '../ui/AppTextarea.vue'
import SectionCard from '../ui/SectionCard.vue'
import type { ServerInfo } from '@/contract'

const text = defineModel<string>({ required: true })
defineProps<{ emoji: ServerInfo['irodoriEmoji'] }>()
</script>

<template>
  <SectionCard step="4" title="テキスト">
    <template #actions>
      <span class="font-mono text-[11px] text-slate-500">{{ text.length }} 文字</span>
    </template>

    <AppTextarea v-model="text" :rows="6" placeholder="読み上げるテキストを入力" />

    <details class="mt-3">
      <summary class="cursor-pointer text-[11px] text-slate-400 select-none">
        Irodori 絵文字パレット（{{ emoji.length }} 種）
      </summary>
      <p class="mt-2 text-[11px] leading-relaxed text-slate-500">
        テキスト中に置くと話し方や非言語音に効きます（対応チェックポイントのみ・効果は常に安定するわけではありません）。
      </p>
      <div class="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
        <button
          v-for="item in emoji"
          :key="item.emoji + item.label"
          type="button"
          :title="`${item.label}: ${item.description}`"
          class="size-7 cursor-pointer rounded-md border border-slate-800 bg-slate-900 text-base leading-none transition-colors hover:border-sky-600"
          @click="text = text + item.emoji"
        >
          {{ item.emoji }}
        </button>
      </div>
    </details>
  </SectionCard>
</template>

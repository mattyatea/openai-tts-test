<script setup lang="ts">
import { LoaderCircle, TriangleAlert } from '@lucide/vue'

import SectionCard from '../ui/SectionCard.vue'

const notes = [
  'Irodori の参照音声パスはサーバー側から見たパスです。ブラウザからは指定できません。',
  'Irodori の初回生成はモデル読み込みで数分かかることがあります。',
  'pcm は再生時に WAV へ包み直してから再生します。',
]
</script>

<template>
  <SectionCard title="メモ">
    <ul class="flex flex-col gap-1.5 text-[11px] leading-relaxed text-slate-400">
      <li v-for="(note, index) in notes" :key="note" class="flex gap-2">
        <TriangleAlert v-if="index < 2" class="mt-0.5 size-3.5 shrink-0 text-amber-400" />
        <LoaderCircle v-else class="mt-0.5 size-3.5 shrink-0 text-slate-500" />
        {{ note }}
      </li>
    </ul>
  </SectionCard>
</template>

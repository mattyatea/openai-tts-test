<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import SectionCard from '../ui/SectionCard.vue'

const points = [
  'マイク音声は WebRTC の音声トラックとして直接 GPT Live（Codex app-server の realtime）へ送られます。',
  'GPT Live の返答テキストを受け取り、音声トラックは破棄して、左下の TTS で読み直します。',
  'システムプロンプトは Codex の developer instructions と realtime の開始指示の両方に渡します。',
  '「Codex の起動コンテキストを含める」をオフにすると、Codex 標準の振る舞いを外してシステムプロンプトを優先させられます。',
  'realtime は Codex のログイン（ChatGPT アカウント）で認証します。API キー方式では動きません。',
  '音声トラックは受け取る必要があります（V3 の仕様）。「受信トラックあり」でも再生しなければ音は鳴りません。',
  '応答はマイク入力の VAD で始まります。テキスト送信だけでは応答が生成されないことがあります。',
]
</script>

<template>
  <SectionCard title="仕組みと制約">
    <template #actions>
      <TriangleAlert class="size-3.5 text-amber-400" />
    </template>

    <ul class="flex flex-col gap-2 text-[11px] leading-relaxed text-slate-400">
      <li v-for="point in points" :key="point">{{ point }}</li>
    </ul>
  </SectionCard>
</template>

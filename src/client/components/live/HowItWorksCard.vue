<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import SectionCard from '../ui/SectionCard.vue'

const points = [
  'マイク音声はブラウザから WebRTC で直接 GPT Live（Codex app-server の realtime）へ送られます。',
  'GPT Live の返答テキストを受け取り、音声トラックは破棄して、右の OpenAI TTS で読み直します。',
  'システムプロンプトは Codex 側の developer instructions として thread 作成時に渡します。',
  'realtime は Codex のログイン（ChatGPT アカウント）で認証します。API キー方式では動きません。',
  '音声トラックは受け取る必要があります（V3 の仕様）。「受信トラックあり」でも再生しなければ音は鳴りません。',
  'GPT Live の音声を止めている間は、相手の発話終了検知はマイク入力だけで動きます。割り込みはマイクから行ってください。',
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

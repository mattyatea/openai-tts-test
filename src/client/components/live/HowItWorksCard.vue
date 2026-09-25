<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import SectionCard from '../ui/SectionCard.vue'

const points = [
  'マイク音声は WebRTC の音声トラックとして直接 GPT Live（Codex app-server の realtime）へ送られます。',
  '返答は単語ごとに届きますが、読み上げは本文が確定してから 1 回のリクエストで生成します。途中で分割すると、同じ発話の送り直しで先頭が二重に読まれるためです。',
  '長文は Irodori-TTS-Server 側が句点で分割し、SSE で順次返します。最初のチャンクが届いた時点で鳴り始めるので、合成の完了は待ちません。',
  '音声トラックは破棄して、左下の TTS で読み直します。',
  'システムプロンプトは realtime セッションの `prompt` に渡し、既定の Codex 人格を置き換えます。',
  '「Codex の起動コンテキストを追記する」をオンにすると、Codex 標準の振る舞いも後ろに足します。',
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

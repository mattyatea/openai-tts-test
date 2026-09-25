<script setup lang="ts">
import { Radio, SlidersHorizontal } from '@lucide/vue'

import { useServerInfo } from '@/client/composables/useServerInfo'

const { info, loading, error } = useServerInfo()

const links = [
  { to: '/playground', label: 'Playground', icon: SlidersHorizontal },
  { to: '/live', label: 'GPT Live', icon: Radio },
]
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
    <div class="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3">
      <RouterLink to="/playground" class="flex items-baseline gap-2.5">
        <span class="font-mono text-sm font-bold tracking-[0.16em] text-sky-400">TTS LAB</span>
        <span class="hidden text-xs text-slate-500 sm:inline">OpenAI TTS / GPT Live 差し替えテスト</span>
      </RouterLink>

      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
          active-class="bg-slate-800 text-slate-100"
        >
          <component :is="link.icon" class="size-3.5" />
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <span v-if="loading" class="rounded-full border border-slate-800 px-2.5 py-1 text-[11px] text-slate-500">
          サーバー確認中…
        </span>
        <span
          v-else-if="error"
          class="rounded-full border border-rose-900 px-2.5 py-1 text-[11px] text-rose-300"
          :title="error"
        >
          API 未接続
        </span>
        <template v-else-if="info">
          <span class="rounded-full border border-slate-800 px-2.5 py-1 font-mono text-[11px] text-slate-400">
            {{ info.runtime.node }} / v{{ info.version }}
          </span>
          <span
            class="rounded-full border px-2.5 py-1 text-[11px]"
            :class="info.codex.available ? 'border-emerald-900 text-emerald-300' : 'border-amber-900 text-amber-300'"
            :title="info.codex.error ?? info.codex.userAgent ?? ''"
          >
            Codex {{ info.codex.available ? 'OK' : '未検出' }}
          </span>
        </template>
      </div>
    </div>
  </header>
</template>

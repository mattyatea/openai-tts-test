<script setup lang="ts">
import { computed } from 'vue'

type Tone = 'neutral' | 'ok' | 'warn' | 'error'

const props = withDefaults(defineProps<{ tone?: Tone; message: string }>(), { tone: 'neutral' })

const classes = computed(() => {
  const tones: Record<Tone, string> = {
    neutral: 'border-slate-800 bg-slate-950/60 text-slate-400',
    ok: 'border-emerald-900 bg-emerald-950/30 text-emerald-300',
    warn: 'border-amber-900 bg-amber-950/30 text-amber-300',
    error: 'border-rose-900 bg-rose-950/30 text-rose-300',
  }
  return `rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed break-words ${tones[props.tone]}`
})
</script>

<template>
  <p :class="classes">{{ message }}</p>
</template>

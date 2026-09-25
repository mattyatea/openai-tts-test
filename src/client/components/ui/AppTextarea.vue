<script setup lang="ts">
const model = defineModel<string>({ required: true })
withDefaults(
  defineProps<{
    rows?: number
    placeholder?: string
    disabled?: boolean
    mono?: boolean
    readonly?: boolean
  }>(),
  { rows: 4, placeholder: '', disabled: false, mono: false, readonly: false },
)
</script>

<template>
  <textarea
    v-model="model"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :spellcheck="!mono"
    class="w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 hover:border-slate-600 focus-visible:border-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
    :class="mono ? 'font-mono text-[11px]' : ''"
  />
</template>

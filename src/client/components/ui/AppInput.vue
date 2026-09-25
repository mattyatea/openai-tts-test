<script setup lang="ts">
const model = defineModel<string>({ required: true })
withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    disabled?: boolean
    mono?: boolean
  }>(),
  { type: 'text', placeholder: '', disabled: false, mono: false },
)
</script>

<template>
  <input
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    spellcheck="false"
    class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 hover:border-slate-600 focus-visible:border-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
    :class="mono ? 'font-mono' : ''"
  />
</template>

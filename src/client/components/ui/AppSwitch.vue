<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; hint?: string; disabled?: boolean }>()
</script>

<template>
  <label class="flex cursor-pointer items-start gap-2.5" :class="disabled ? 'opacity-50' : ''">
    <SwitchRoot
      v-model="model"
      :disabled="disabled"
      class="mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-slate-700 bg-slate-800 transition-colors data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed"
    >
      <SwitchThumb
        class="my-auto block size-3.5 translate-x-0.5 rounded-full bg-slate-300 transition-transform data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-white"
      />
    </SwitchRoot>
    <span class="text-xs leading-snug text-slate-300">
      {{ label }}
      <em v-if="hint" class="field-hint not-italic">{{ hint }}</em>
    </span>
  </label>
</template>

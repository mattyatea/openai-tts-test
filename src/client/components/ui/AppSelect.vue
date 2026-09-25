<script setup lang="ts" generic="T extends string">
import { SelectContent, SelectIcon, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from 'reka-ui'
import { Check, ChevronDown } from '@lucide/vue'

const model = defineModel<T>({ required: true })
defineProps<{
  options: Array<{ value: T; label: string; disabled?: boolean }>
  placeholder?: string
  disabled?: boolean
}>()
</script>

<template>
  <SelectRoot v-model="model" :disabled="disabled">
    <SelectTrigger
      class="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-left text-xs text-slate-100 hover:border-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SelectValue :placeholder="placeholder ?? '選択'" />
      <SelectIcon>
        <ChevronDown class="size-3.5 text-slate-500" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
            class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-200 outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-slate-800"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="ml-auto">
              <Check class="size-3.5 text-sky-400" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

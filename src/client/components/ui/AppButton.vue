<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    disabled?: boolean
    type?: 'button' | 'submit'
    loading?: boolean
  }>(),
  { variant: 'secondary', size: 'md', disabled: false, type: 'button', loading: false },
)

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
  const sizes: Record<Size, string> = {
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-3 py-1.5 text-xs',
  }
  const variants: Record<Variant, string> = {
    primary: 'border-sky-500 bg-sky-600 text-white hover:bg-sky-500',
    secondary: 'border-slate-700 bg-slate-800/70 text-slate-100 hover:border-slate-600 hover:bg-slate-800',
    ghost: 'border-transparent bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
    danger: 'border-rose-800 bg-rose-950/50 text-rose-200 hover:bg-rose-900/60',
  }
  return [base, sizes[props.size], variants[props.variant]].join(' ')
})
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <span
      v-if="loading"
      class="size-3 animate-spin rounded-full border border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>

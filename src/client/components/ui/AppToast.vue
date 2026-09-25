<script setup lang="ts">
import { ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui'
import { useToast } from '@/client/composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <ToastProvider :duration="3600">
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      :class="[
        'rounded-xl border px-4 py-2.5 shadow-2xl backdrop-blur',
        toast.tone === 'error'
          ? 'border-rose-800 bg-rose-950/90 text-rose-100'
          : toast.tone === 'ok'
            ? 'border-emerald-800 bg-emerald-950/90 text-emerald-100'
            : 'border-slate-700 bg-slate-900/95 text-slate-100',
      ]"
    >
      <ToastTitle class="text-xs font-medium">{{ toast.title }}</ToastTitle>
      <ToastDescription v-if="toast.description" class="mt-0.5 text-[11px] opacity-80">
        {{ toast.description }}
      </ToastDescription>
    </ToastRoot>
    <ToastViewport
      class="fixed bottom-5 left-1/2 z-[100] flex max-h-screen w-auto -translate-x-1/2 flex-col gap-2 outline-none"
    />
  </ToastProvider>
</template>

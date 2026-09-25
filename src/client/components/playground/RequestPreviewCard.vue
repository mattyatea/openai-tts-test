<script setup lang="ts">
import { Copy } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import SectionCard from '../ui/SectionCard.vue'

defineProps<{ requestJson: string; curl: string }>()
const emit = defineEmits<{ copy: [value: string, label: string] }>()
</script>

<template>
  <SectionCard step="6" title="送信内容">
    <div class="flex flex-wrap gap-2">
      <AppButton size="sm" @click="emit('copy', requestJson, 'JSON')">
        <Copy class="size-3.5" />JSON をコピー
      </AppButton>
      <AppButton size="sm" @click="emit('copy', curl, 'curl')">
        <Copy class="size-3.5" />curl をコピー
      </AppButton>
    </div>

    <pre class="code-block mt-3">{{ requestJson }}</pre>
    <details class="mt-3">
      <summary class="cursor-pointer text-[11px] text-slate-400 select-none">curl</summary>
      <pre class="code-block mt-2">{{ curl }}</pre>
    </details>
  </SectionCard>
</template>

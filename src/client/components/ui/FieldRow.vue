<script setup lang="ts">
defineProps<{ label: string; hint?: string }>()
</script>

<template>
  <label class="flex flex-col gap-1.5">
    <span class="field-label">
      {{ label }}
      <em v-if="hint" class="field-hint not-italic">{{ hint }}</em>
    </span>
    <slot />
  </label>
</template>

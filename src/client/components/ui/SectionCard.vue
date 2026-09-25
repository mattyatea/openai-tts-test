<script setup lang="ts">
defineProps<{ step?: string; title: string; dimmed?: boolean }>()
</script>

<template>
  <section class="card" :class="dimmed ? 'opacity-60' : ''">
    <header class="mb-3 flex items-center gap-2">
      <span
        v-if="step"
        class="grid size-5 place-items-center rounded-md bg-sky-950 text-[11px] font-bold text-sky-300"
      >
        {{ step }}
      </span>
      <h2 class="card-title">{{ title }}</h2>
      <div class="ml-auto flex items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

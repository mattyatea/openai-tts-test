<script setup lang="ts">
import AppHeader from './components/layout/AppHeader.vue'
import AppToast from './components/ui/AppToast.vue'
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="mx-auto max-w-[1500px] px-5 py-5">
      <RouterView />
    </main>

    <AppToast />
  </div>
</template>

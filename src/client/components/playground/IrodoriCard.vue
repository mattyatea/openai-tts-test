<script setup lang="ts">
import IrodoriOptionsFields from '../shared/IrodoriOptionsFields.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import SectionCard from '../ui/SectionCard.vue'

const enabled = defineModel<boolean>('enabled', { required: true })
const fields = defineModel<Record<string, string>>('fields', { required: true })
defineProps<{ available: boolean }>()
</script>

<template>
  <SectionCard step="3" title="Irodori-TTS 固有パラメータ" :dimmed="!available">
    <template #actions>
      <span class="rounded-full border border-amber-900 px-2 py-0.5 text-[10px] text-amber-300">
        OpenAI へは送らない
      </span>
    </template>

    <AppSwitch v-model="enabled" label="irodori オブジェクトを送る" :disabled="!available" />

    <div class="mt-3">
      <IrodoriOptionsFields v-model="fields" />
    </div>
  </SectionCard>
</template>

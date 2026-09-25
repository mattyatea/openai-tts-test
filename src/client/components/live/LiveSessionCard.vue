<script setup lang="ts">
import { Mic, PhoneOff, Volume2 } from '@lucide/vue'

import AppButton from '../ui/AppButton.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import AppTextarea from '../ui/AppTextarea.vue'
import FieldRow from '../ui/FieldRow.vue'
import SectionCard from '../ui/SectionCard.vue'
import StatusNote from '../ui/StatusNote.vue'

export interface LiveSettings {
  voice: string
  systemPrompt: string
  instructions: string
  initialPrompt: string
  playGptAudio: boolean
  /** Codex の起動コンテキストを realtime に含めるか。 */
  includeStartupContext: boolean
}

const settings = defineModel<LiveSettings>({ required: true })
defineProps<{
  state: string
  connected: boolean
  statusMessage: string
  error: string | null
  micActive: boolean
  remoteAudioActive: boolean
  voiceOptions: Array<{ value: string; label: string }>
  sentSystemPrompt: string | null
}>()

const emit = defineEmits<{ start: []; stop: []; voices: [] }>()
</script>

<template>
  <SectionCard title="GPT Live セッション">
    <template #actions>
      <span
        class="rounded-full border px-2 py-0.5 text-[10px]"
        :class="
          connected
            ? 'border-emerald-900 text-emerald-300'
            : state === 'error'
              ? 'border-rose-900 text-rose-300'
              : 'border-slate-800 text-slate-400'
        "
      >
        {{ state }}
      </span>
    </template>

    <div class="flex flex-col gap-3">
      <StatusNote :tone="state === 'error' ? 'error' : connected ? 'ok' : 'neutral'" :message="statusMessage" />
      <StatusNote v-if="error && state !== 'error'" tone="warn" :message="error" />

      <FieldRow label="GPT Live ボイス" hint="realtime v1/v3 のボイス（音声自体は破棄できます）">
        <div class="flex gap-2">
          <AppSelect v-model="settings.voice" :options="voiceOptions" />
          <AppButton size="sm" @click="emit('voices')">取得</AppButton>
        </div>
      </FieldRow>

      <FieldRow
        label="システムプロンプト"
        hint="GPT Live 本体のシステムプロンプト。既定の Codex 人格を置き換えます"
      >
        <AppTextarea
          v-model="settings.systemPrompt"
          :rows="5"
          placeholder="あなたは日本語で話す音声アシスタントです。返答は短く…"
        />
      </FieldRow>

      <FieldRow label="追加指示" hint="システムプロンプトとは別に、会話コンテキストへ developer 指示として足します">
        <AppTextarea v-model="settings.instructions" :rows="2" />
      </FieldRow>

      <FieldRow label="冒頭の振る舞い" hint="システムプロンプト末尾へ「セッション開始時」として追記します">
        <AppTextarea v-model="settings.initialPrompt" :rows="2" />
      </FieldRow>

      <AppSwitch
        v-model="settings.includeStartupContext"
        label="Codex の起動コンテキストを追記する"
        hint="オフのままにするとシステムプロンプトだけが効きます"
      />

      <AppSwitch
        v-model="settings.playGptAudio"
        label="GPT Live の音声も再生する"
        hint="オフなら音声は破棄し、テキストだけを自作 TTS で読み上げます"
      />

      <div class="flex flex-wrap items-center gap-2">
        <AppButton v-if="state === 'idle' || state === 'error'" variant="primary" @click="emit('start')">
          <Mic class="size-3.5" />マイクで開始
        </AppButton>
        <AppButton v-else variant="danger" @click="emit('stop')">
          <PhoneOff class="size-3.5" />終了
        </AppButton>
        <span
          class="flex items-center gap-1.5 text-[11px]"
          :class="micActive ? 'text-emerald-300' : 'text-slate-500'"
        >
          <Mic class="size-3" />マイク{{ micActive ? 'ON' : 'OFF' }}
        </span>
        <span
          class="flex items-center gap-1.5 text-[11px]"
          :class="remoteAudioActive ? 'text-emerald-300' : 'text-slate-500'"
        >
          <Volume2 class="size-3" />受信トラック{{ remoteAudioActive ? 'あり' : 'なし' }}
        </span>
      </div>

      <details v-if="sentSystemPrompt">
        <summary class="cursor-pointer text-[11px] text-slate-400 select-none">
          実際に realtime へ渡したシステムプロンプト
        </summary>
        <pre class="code-block mt-2">{{ sentSystemPrompt }}</pre>
      </details>
    </div>
  </SectionCard>
</template>

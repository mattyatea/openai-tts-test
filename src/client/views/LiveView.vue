<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import HowItWorksCard from '../components/live/HowItWorksCard.vue'
import LiveSessionCard, { type LiveSettings } from '../components/live/LiveSessionCard.vue'
import SpeakingLogCard, { type SpeakingLogEntry } from '../components/live/SpeakingLogCard.vue'
import TranscriptCard from '../components/live/TranscriptCard.vue'
import TtsTargetCard from '../components/live/TtsTargetCard.vue'
import { useGptLive } from '../composables/useGptLive'
import { useIrodoriOptions } from '../composables/useIrodoriOptions'
import { useServerInfo } from '../composables/useServerInfo'
import { useSpeechQueue } from '../composables/useSpeechQueue'
import { useToast } from '../composables/useToast'
import { useTtsSettings } from '../composables/useTtsSettings'
import { useUpstreamProbe } from '../composables/useUpstreamProbe'
import type { LiveVoices } from '@/contract'
import { client, errorMessage } from '../lib/orpc'
import { useLocalStorage } from '../lib/useLocalStorage'

const toast = useToast()
const { info } = useServerInfo()
const live = useGptLive()

const liveSettings = useLocalStorage<LiveSettings>('tts-lab.live.settings', {
  voice: 'cove',
  systemPrompt: [
    'あなたは日本語で話す音声アシスタントです。',
    '返答は短く、自然な話し言葉で、原則1〜2文に収めてください。',
    '箇条書きや記号、Markdown は読み上げに向かないため使わないでください。',
  ].join('\n'),
  instructions: '音声で会話します。落ち着いた速さではっきり話してください。',
  initialPrompt: 'これから音声で会話します。最初に短く挨拶してください。',
  playGptAudio: false,
  // Codex 標準の振る舞いより、上のシステムプロンプトを優先させる。
  includeStartupContext: false,
})

const tts = useTtsSettings('tts-lab.live.tts', {
  speed: 1.05,
  instructions: '落ち着いた、聞き取りやすい日本語で読んでください。',
  useSpeed: true,
  useInstructions: true,
  autoSpeak: true,
})
const ttsSettings = tts.settings

const voices = ref<LiveVoices | null>(null)
const manualText = ref('')
const speakingLog = ref<SpeakingLogEntry[]>([])
const ttsProbe = useUpstreamProbe()

const irodoriEnabled = ref(false)
const irodori = useIrodoriOptions(irodoriEnabled)

const queue = useSpeechQueue({
  buildRequest: (text) => tts.buildRequest(text, { irodori: irodori.build() }),
  onError: (message) => toast.error('読み上げに失敗しました', message),
})

const presetOptions = computed(
  () =>
    info.value?.presets
      .filter((preset) => preset.baseUrl || preset.kind === 'custom')
      .map((preset) => ({ value: preset.id, label: preset.label })) ?? [],
)

const ttsKind = computed(
  () => info.value?.presets.find((preset) => preset.id === ttsSettings.value.presetId)?.kind ?? 'openai',
)

/** OpenAI なら既知のボイス、Irodori なら upstream から取得したモデル・ボイスを使う。 */
const ttsModelOptions = computed(() => {
  const values =
    ttsKind.value === 'openai'
      ? [...(info.value?.openaiModels ?? []), ttsSettings.value.model]
      : [ttsSettings.value.model, ...ttsProbe.models.value.map((model) => model.id)]
  return [...new Set(values.filter(Boolean))].map((value) => ({ value, label: value }))
})

const ttsVoiceOptions = computed(() => {
  const values =
    ttsKind.value === 'openai'
      ? [...(info.value?.openaiVoices ?? []), ttsSettings.value.voice]
      : [ttsSettings.value.voice, 'none', ...ttsProbe.voices.value.map((voice) => voice.id)]
  return [...new Set(values.filter(Boolean))].map((value) => ({ value, label: value }))
})

async function applyTtsPreset(id: string): Promise<void> {
  const preset = info.value?.presets.find((entry) => entry.id === id)
  if (!preset) return
  ttsSettings.value.presetId = id
  if (preset.baseUrl) ttsSettings.value.baseUrl = preset.baseUrl
  if (preset.defaultModel) ttsSettings.value.model = preset.defaultModel
  if (preset.defaultVoice) ttsSettings.value.voice = preset.defaultVoice
  irodoriEnabled.value = preset.useIrodori === true
  await refreshTtsLists()
}

async function refreshTtsLists(): Promise<void> {
  await ttsProbe.loadModels(ttsSettings.value.baseUrl, ttsSettings.value.apiKey || undefined)
  await ttsProbe.loadVoices(ttsSettings.value.baseUrl, ttsSettings.value.apiKey || undefined)
}

watch(
  () => info.value,
  (value) => {
    if (!value) return
    const matched = value.presets.find((preset) => preset.baseUrl === ttsSettings.value.baseUrl)
    if (matched) {
      ttsSettings.value.presetId = matched.id
      irodoriEnabled.value = matched.useIrodori === true
    }
    void refreshTtsLists()
  },
  { once: true },
)

const liveVoiceOptions = computed(() => {
  const list = voices.value
  if (!list) return [{ value: liveSettings.value.voice, label: liveSettings.value.voice }]
  return [
    ...list.v1.map((id) => ({ value: id, label: `${id}（realtime v1/v3）` })),
    ...list.v2.map((id) => ({ value: id, label: `${id}（realtime v2）` })),
  ]
})

/** 返答が確定したら、その本文だけを自分の TTS で読み上げる。 */
watch(
  () => live.transcripts.value.filter((entry) => entry.role === 'assistant' && entry.final).length,
  async (count, previous) => {
    if (previous === undefined || count <= previous) return
    if (!ttsSettings.value.autoSpeak) return
    const latest = live.transcripts.value.filter((entry) => entry.role === 'assistant' && entry.final).at(-1)
    if (latest) await speak(latest.text)
  },
)

async function speak(text: string): Promise<void> {
  queue.enqueue(text)
  speakingLog.value = [
    ...speakingLog.value,
    { at: new Date().toLocaleTimeString('ja-JP', { hour12: false }), text },
  ]
  await live.notifySpoken(text)
}

async function start(): Promise<void> {
  speakingLog.value = []
  queue.clear()
  const ok = await live.start({
    voice: liveSettings.value.voice,
    systemPrompt: liveSettings.value.systemPrompt,
    instructions: liveSettings.value.instructions,
    initialPrompt: liveSettings.value.initialPrompt,
    includeStartupContext: liveSettings.value.includeStartupContext,
  })
  if (ok) {
    toast.ok('GPT Live セッションを開始しました', 'マイクに話しかけてください')
    if (!voices.value) voices.value = await live.fetchVoices()
  } else {
    toast.error('セッションを開始できません', live.error.value ?? undefined)
  }
}

async function stop(): Promise<void> {
  queue.stop()
  await live.stop()
  toast.show('セッションを終了しました')
}

async function loadVoices(): Promise<void> {
  const result = await live.fetchVoices()
  if (!result) {
    toast.error('ボイスを取得できません', live.error.value ?? undefined)
    return
  }
  voices.value = result
  toast.ok(`realtime ボイスを取得しました（v1/v3 ${result.v1.length} / v2 ${result.v2.length}）`)
}

async function sendManual(): Promise<void> {
  const text = manualText.value.trim()
  if (!text) return
  try {
    await live.sendText(text)
    manualText.value = ''
  } catch (caught) {
    toast.error('送信できません', errorMessage(caught))
  }
}

async function testSpeak(): Promise<void> {
  try {
    const result = await client.tts.speak(
      tts.buildRequest('これは読み上げテストです。', { irodori: irodori.build() }),
    )
    const url = URL.createObjectURL(result.audio)
    await new Audio(url).play()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    toast.ok(`読み上げテスト成功（${(result.bytes / 1024).toFixed(1)} KB / ${result.elapsedMs} ms）`)
  } catch (caught) {
    toast.error('読み上げテストに失敗', errorMessage(caught))
  }
}

onBeforeUnmount(() => {
  queue.stop()
  void live.stop()
})
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(420px,1fr)_minmax(420px,1fr)]">
    <div class="flex flex-col gap-4">
      <LiveSessionCard
        v-model="liveSettings"
        :state="live.state.value"
        :connected="live.connected.value"
        :status-message="live.statusMessage.value"
        :error="live.error.value"
        :mic-active="live.micActive.value"
        :remote-audio-active="live.remoteAudioActive.value"
        :voice-options="liveVoiceOptions"
        :sent-system-prompt="live.sentSystemPrompt.value"
        @start="start"
        @stop="stop"
        @voices="loadVoices"
      />

      <TtsTargetCard
        v-model="ttsSettings"
        v-model:irodori-enabled="irodoriEnabled"
        v-model:irodori-fields="irodori.fields"
        :preset-options="presetOptions"
        :kind="ttsKind"
        :model-options="ttsModelOptions"
        :voice-options="ttsVoiceOptions"
        :pending-count="queue.pendingCount.value"
        :speaking="queue.speaking.value"
        @test="testSpeak"
        @stop="queue.stop()"
        @preset="applyTtsPreset"
      />

      <SpeakingLogCard :entries="speakingLog" />
    </div>

    <div class="flex flex-col gap-4">
      <TranscriptCard
        v-model:manual-text="manualText"
        :transcripts="live.transcripts.value"
        :connected="live.connected.value"
        @send="sendManual"
      />

      <HowItWorksCard />
    </div>
  </div>
</template>

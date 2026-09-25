<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ConnectionCard from '../components/playground/ConnectionCard.vue'
import IrodoriCard from '../components/playground/IrodoriCard.vue'
import NotesCard from '../components/playground/NotesCard.vue'
import RequestCard from '../components/playground/RequestCard.vue'
import RequestPreviewCard from '../components/playground/RequestPreviewCard.vue'
import RunCard from '../components/playground/RunCard.vue'
import TextCard from '../components/playground/TextCard.vue'
import { useIrodoriOptions } from '../composables/useIrodoriOptions'
import { useServerInfo } from '../composables/useServerInfo'
import { useToast } from '../composables/useToast'
import { useTtsOptionLists, useTtsSettings } from '../composables/useTtsSettings'
import { useUpstreamProbe } from '../composables/useUpstreamProbe'
import { downloadBlob, speakToUrl, type SpeakOutcome } from '../lib/audio'
import { playStream, type StreamingSpeechHandle } from '../lib/audio'
import { errorMessage } from '../lib/orpc'
import { useLocalStorage } from '../lib/useLocalStorage'

const toast = useToast()
const { info } = useServerInfo()
const probe = useUpstreamProbe()
const { settings, buildRequest } = useTtsSettings('tts-lab.playground.settings')
const text = useLocalStorage('tts-lab.playground.text', 'こんにちは。これは OpenAI TTS の動作確認です。')

const irodoriEnabled = ref(false)
const irodori = useIrodoriOptions(irodoriEnabled)

const running = ref(false)
const runError = ref<string | null>(null)
const result = ref<SpeakOutcome | null>(null)
const lastHeaders = ref<Record<string, string>>({})
const streamChunks = ref(0)
const streaming = ref(false)
let streamHandle: StreamingSpeechHandle | null = null

const kind = computed(
  () => info.value?.presets.find((preset) => preset.id === settings.value.presetId)?.kind ?? 'custom',
)

const { modelOptions, voiceOptions, formatOptions } = useTtsOptionLists(info)

/** 取得済みの upstream モデル・ボイスも候補に混ぜる。 */
const mergedModelOptions = computed(() => {
  const base = modelOptions.value.map((option) => option.value)
  const extra = kind.value === 'irodori' ? ['irodori-tts'] : []
  const merged = [...new Set([...base, ...extra, ...probe.models.value.map((model) => model.id)])]
  return merged.map((value) => ({ value, label: value }))
})

const mergedVoiceOptions = computed(() => {
  const base = kind.value === 'openai' ? voiceOptions.value.map((option) => option.value) : []
  const extra = kind.value === 'irodori' ? ['none'] : []
  const merged = [
    ...new Set([...base, ...extra, ...probe.voices.value.map((voice) => voice.id), settings.value.voice]),
  ].filter(Boolean)
  return merged.map((value) => ({ value, label: value }))
})

const builtRequest = computed(() =>
  buildRequest(text.value, { irodori: irodori.build() }),
)

const requestJson = computed(() => {
  try {
    return JSON.stringify(builtRequest.value, null, 2)
  } catch (caught) {
    return `リクエストを組み立てられません: ${errorMessage(caught)}`
  }
})

const curl = computed(() => {
  const auth = settings.value.apiKey ? `  -H "Authorization: Bearer ${settings.value.apiKey}" \\\n` : ''
  return [
    `curl -sS ${settings.value.baseUrl}/audio/speech \\`,
    '  -H "Content-Type: application/json" \\',
    `${auth}  -d '${requestJson.value.replace(/'/g, `'\\''`)}' \\`,
    `  --output speech.${settings.value.format}`,
  ].join('\n')
})

watch(
  () => info.value,
  (value) => {
    if (!value) return
    if (!settings.value.baseUrl) settings.value.baseUrl = value.defaults.baseUrl
    const matched = value.presets.find((preset) => preset.baseUrl === settings.value.baseUrl)
    settings.value.presetId = matched?.id ?? 'custom'
    irodoriEnabled.value = matched?.useIrodori === true || matched?.kind === 'irodori'
    void refreshUpstreamLists()
  },
  { once: true },
)

function applyPreset(id: string): void {
  const preset = info.value?.presets.find((entry) => entry.id === id)
  if (!preset) return
  settings.value.presetId = id
  if (preset.baseUrl) settings.value.baseUrl = preset.baseUrl
  if (preset.defaultModel) settings.value.model = preset.defaultModel
  if (preset.defaultVoice) settings.value.voice = preset.defaultVoice
  irodoriEnabled.value = preset.useIrodori === true
  // プリセットを選んだら、そのサーバーのモデル・ボイス一覧を取り直す。
  void refreshUpstreamLists()
}

async function refreshUpstreamLists(): Promise<void> {
  await probe.loadModels(settings.value.baseUrl, settings.value.apiKey || undefined)
  await probe.loadVoices(settings.value.baseUrl, settings.value.apiKey || undefined)
}

async function checkUpstream(): Promise<void> {
  const outcome = await probe.check(settings.value.baseUrl, settings.value.apiKey || undefined)
  if (outcome.tone === 'error') toast.error('接続できません', outcome.message)
}

async function loadModels(): Promise<void> {
  const outcome = await probe.loadModels(settings.value.baseUrl, settings.value.apiKey || undefined)
  if (!outcome.ok) {
    toast.error('モデル取得に失敗', outcome.error)
    return
  }
  toast.ok(`モデル ${probe.models.value.length} 件を取得しました`)
}

async function loadVoices(): Promise<void> {
  const outcome = await probe.loadVoices(settings.value.baseUrl, settings.value.apiKey || undefined)
  if (!outcome.ok) {
    toast.error('ボイス取得に失敗', outcome.error)
    return
  }
  if (probe.voicesSupported.value === false) {
    toast.show('ボイス一覧なし', 'この upstream は /v1/audio/voices を持ちません')
    return
  }
  toast.ok(`ボイス ${probe.voices.value.length} 件を取得しました`)
}

async function run(): Promise<void> {
  if (running.value) return
  if (!text.value.trim()) {
    toast.error('テキストを入力してください')
    return
  }
  running.value = true
  runError.value = null
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
  try {
    const outcome = await speakToUrl(builtRequest.value, settings.value.pcmRate)
    result.value = outcome
    lastHeaders.value = outcome.headers
    toast.ok(`生成しました（${(outcome.bytes / 1024).toFixed(1)} KB / ${outcome.elapsedMs} ms）`)
  } catch (caught) {
    runError.value = errorMessage(caught)
    toast.error('生成に失敗しました', runError.value)
  } finally {
    running.value = false
  }
}

/** SSE を受信しながら順番に再生する。Irodori はチャンクが届くそばから鳴る。 */
async function runStream(): Promise<void> {
  if (streaming.value) return
  if (!text.value.trim()) {
    toast.error('テキストを入力してください')
    return
  }
  streaming.value = true
  streamChunks.value = 0
  runError.value = null
  const request = { ...builtRequest.value, useSse: true }
  try {
    streamHandle = playStream(request, {
      onProgress: ({ chunkCount }) => {
        streamChunks.value = chunkCount
      },
      onError: (message) => {
        runError.value = message
        toast.error('ストリーミングに失敗しました', message)
      },
    })
    await streamHandle.done
    if (streamChunks.value > 0) {
      toast.ok(`${streamChunks.value} チャンクを受信して再生しました`)
    }
  } catch (caught) {
    runError.value = errorMessage(caught)
  } finally {
    streaming.value = false
    streamHandle = null
  }
}

function stopStream(): void {
  streamHandle?.stop()
  streaming.value = false
  toast.show('ストリーミング再生を止めました')
}

function download(): void {
  if (!result.value) return
  downloadBlob(result.value.blob, `speech.${settings.value.format}`)
}

function copy(value: string, label: string): void {
  void navigator.clipboard.writeText(value).then(
    () => toast.ok(`${label} をコピーしました`),
    () => toast.error('コピーできませんでした'),
  )
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(360px,1fr)_minmax(460px,1.1fr)]">
    <div class="flex flex-col gap-4">
      <ConnectionCard
        v-model="settings"
        :kind="kind"
        :presets="info?.presets ?? []"
        :probe="probe.state.value"
        :has-server-api-key="info?.defaults.hasServerApiKey ?? false"
        @preset="applyPreset"
        @check="checkUpstream"
        @models="loadModels"
        @voices="loadVoices"
      />

      <RequestCard
        v-model="settings"
        :model-options="mergedModelOptions"
        :voice-options="mergedVoiceOptions"
        :format-options="formatOptions"
      />

      <IrodoriCard
        v-model:enabled="irodoriEnabled"
        v-model:fields="irodori.fields"
        :available="kind === 'irodori'"
      />
    </div>

    <div class="flex flex-col gap-4">
      <TextCard v-model="text" :emoji="info?.irodoriEmoji ?? []" />

      <RunCard
        :running="running"
        :streaming="streaming"
        :stream-chunks="streamChunks"
        :error="runError"
        :result="result"
        :headers="lastHeaders"
        @run="run"
        @stream="runStream"
        @stop-stream="stopStream"
        @download="download"
      />

      <RequestPreviewCard :request-json="requestJson" :curl="curl" @copy="copy" />

      <NotesCard />
    </div>
  </div>
</template>

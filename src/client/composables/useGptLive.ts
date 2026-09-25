/**
 * GPT Live との WebRTC 接続をブラウザ側で受け持つ。
 *
 * - マイク音声をそのまま GPT Live へ送る
 * - GPT Live の音声トラックは購読するが再生はしない（テキストだけ使う）
 * - サーバーから SSE で届く transcript を画面へ流す
 */

import { computed, ref, shallowRef } from 'vue'

import type { LiveEvent, LiveVoices } from '@/contract'
import { client, errorMessage } from '../lib/orpc'

export interface LiveTranscript {
  id: number
  role: 'user' | 'assistant'
  text: string
  final: boolean
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

function waitForIceGathering(peer: RTCPeerConnection, timeoutMs = 6000): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs)
    function finish(): void {
      clearTimeout(timer)
      peer.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    function onChange(): void {
      if (peer.iceGatheringState === 'complete') finish()
    }
    peer.addEventListener('icegatheringstatechange', onChange)
  })
}

export function useGptLive() {
  const state = ref<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const statusMessage = ref('未接続')
  const sessionId = ref<string | null>(null)
  const version = ref<string | null>(null)
  const error = ref<string | null>(null)
  /** 実際に realtime へ渡したシステムプロンプト。 */
  const sentSystemPrompt = ref<string | null>(null)
  const transcripts = shallowRef<LiveTranscript[]>([])
  const remoteAudioActive = ref(false)
  const micActive = ref(false)
  const rawEventCount = ref(0)
  const seenFinalTexts = new Set<string>()

  let peer: RTCPeerConnection | null = null
  let micStream: MediaStream | null = null
  let eventAbort: AbortController | null = null
  let nextTranscriptId = 1

  const connected = computed(() => state.value === 'connected')

  function appendTranscript(role: 'user' | 'assistant', text: string, final: boolean): void {
    const list = [...transcripts.value]
    const last = list.at(-1)
    if (last && last.role === role && !last.final) {
      last.text = text
      last.final = final
      transcripts.value = [...list]
      return
    }
    list.push({ id: nextTranscriptId++, role, text, final })
    transcripts.value = list
  }

  function appendFinalOnce(role: 'user' | 'assistant', text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const key = `${role}:${trimmed}`
    const last = [...transcripts.value].reverse().find((entry) => entry.role === role)
    if (seenFinalTexts.has(key)) return
    if (last?.final && last.text.trim() === trimmed) {
      seenFinalTexts.add(key)
      return
    }
    seenFinalTexts.add(key)
    appendTranscript(role, trimmed, true)
  }

  /**
   * data channel に流れる Realtime API の生イベントからも transcript を拾う。
   * app-server の通知と二重になっても appendFinalOnce で重複を除く。
   */
  function handleDataChannelMessage(raw: string): void {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    const type = typeof event.type === 'string' ? event.type : ''
    if (!type) return
    rawEventCount.value += 1

    const delta = typeof event.delta === 'string' ? event.delta : null
    const transcript = typeof event.transcript === 'string' ? event.transcript : null

    switch (type) {
      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
      case 'response.text.delta':
      case 'response.output_text.delta':
        if (delta) appendTranscript('assistant', `${currentAssistantDraft()}${delta}`, false)
        break
      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done':
      case 'response.text.done':
      case 'response.output_text.done':
        if (transcript) appendFinalOnce('assistant', transcript)
        break
      case 'conversation.item.input_audio_transcription.delta':
        if (delta) appendTranscript('user', delta, false)
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (transcript) appendFinalOnce('user', transcript)
        break
      default:
        break
    }
  }

  /** data channel の delta は断片なので、進行中の assistant 行に積み増す。 */
  function currentAssistantDraft(): string {
    const last = transcripts.value.at(-1)
    if (last && last.role === 'assistant' && !last.final) return last.text
    return ''
  }

  function reset(): void {
    transcripts.value = []
    error.value = null
  }

  async function handleEvent(event: LiveEvent): Promise<void> {
    switch (event.type) {
      case 'session-started':
        state.value = 'connected'
        version.value = event.version
        statusMessage.value = `接続中（realtime ${event.version}）`
        break
      case 'assistant-transcript-delta':
        appendTranscript('assistant', event.text, false)
        break
      case 'assistant-transcript-done':
        appendTranscript('assistant', event.text, true)
        break
      case 'user-transcript-delta':
        appendTranscript('user', event.text, false)
        break
      case 'user-transcript-done':
        appendTranscript('user', event.text, true)
        break
      case 'error':
        error.value = event.message
        statusMessage.value = `エラー: ${event.message}`
        break
      case 'closed':
        statusMessage.value = `セッション終了${event.reason ? `（${event.reason}）` : ''}`
        state.value = 'idle'
        break
      default:
        break
    }
  }

  async function consumeEvents(id: string): Promise<void> {
    // stop() が eventAbort を null にしても判定できるよう、ローカルに保持する。
    const controller = new AbortController()
    eventAbort = controller
    try {
      const iterator = await client.live.events({ sessionId: id }, { signal: controller.signal })
      for await (const event of iterator) {
        await handleEvent(event)
      }
    } catch (caught) {
      // 自分で止めたときの AbortError はエラー表示しない。
      if (!controller.signal.aborted) {
        error.value = errorMessage(caught)
      }
    } finally {
      if (eventAbort === controller) eventAbort = null
    }
  }

  async function start(options: {
    voice?: string
    systemPrompt?: string
    instructions?: string
    initialPrompt?: string
    includeStartupContext?: boolean
  }): Promise<boolean> {
    if (peer) return false
    reset()
    state.value = 'connecting'
    statusMessage.value = 'マイクを準備しています…'

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      micActive.value = true
    } catch (caught) {
      state.value = 'error'
      const message = errorMessage(caught)
      error.value = `マイクを取得できません: ${message}`
      statusMessage.value = error.value
      return false
    }

    try {
      const created = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      peer = created
      for (const track of micStream.getAudioTracks()) created.addTrack(track, micStream)
      created.addTransceiver('audio', { direction: 'recvonly' })
      const dataChannel = created.createDataChannel('oai-events')
      dataChannel.onmessage = (event: MessageEvent<string | ArrayBuffer | Blob>) => {
        if (typeof event.data === 'string') {
          handleDataChannelMessage(event.data)
          return
        }
        if (event.data instanceof ArrayBuffer) {
          handleDataChannelMessage(new TextDecoder().decode(event.data))
        }
      }

      created.ontrack = (event) => {
        remoteAudioActive.value = true
        // GPT Live の音声は使わない。トラックは購読したまま破棄する。
        void event
      }
      created.onconnectionstatechange = () => {
        const connectionState = created.connectionState
        if (connectionState === 'connected') {
          statusMessage.value = 'WebRTC 接続済み'
        } else if (connectionState === 'failed') {
          error.value = 'WebRTC の接続に失敗しました（STUN / ネットワークを確認してください）'
          statusMessage.value = error.value
        }
      }

      statusMessage.value = 'SDP を作成しています…'
      await created.setLocalDescription(await created.createOffer())
      await waitForIceGathering(created)

      statusMessage.value = 'GPT Live セッションを開始しています…'
      const started = await client.live.start({
        sdp: created.localDescription?.sdp ?? '',
        version: 'v3',
        voice: options.voice,
        systemPrompt: options.systemPrompt,
        instructions: options.instructions,
        initialPrompt: options.initialPrompt,
        includeStartupContext: options.includeStartupContext,
      })
      sessionId.value = started.sessionId
      version.value = started.version
      sentSystemPrompt.value = started.systemPromptSent

      await created.setRemoteDescription({ type: 'answer', sdp: started.sdp })
      statusMessage.value = 'WebRTC のネゴシエーション完了。音声の疎通を待っています…'
      void consumeEvents(started.sessionId)
      state.value = 'connected'
      return true
    } catch (caught) {
      error.value = errorMessage(caught)
      statusMessage.value = `開始できません: ${error.value}`
      state.value = 'error'
      await stop()
      return false
    }
  }

  async function stop(): Promise<void> {
    eventAbort?.abort()
    eventAbort = null
    const id = sessionId.value
    sessionId.value = null
    if (id) await client.live.stop({ sessionId: id }).catch(() => undefined)
    peer?.close()
    peer = null
    micStream?.getTracks().forEach((track) => track.stop())
    micStream = null
    micActive.value = false
    remoteAudioActive.value = false
    state.value = 'idle'
    statusMessage.value = '未接続'
    error.value = null
  }

  async function sendText(text: string): Promise<void> {
    if (!sessionId.value) throw new Error('セッションが開始していません')
    await client.live.appendText({ sessionId: sessionId.value, text })
    appendTranscript('user', text, true)
  }

  async function notifySpoken(text: string): Promise<void> {
    if (!sessionId.value) return
    await client.live.appendSpeech({ sessionId: sessionId.value, text }).catch(() => undefined)
  }

  async function fetchVoices(): Promise<LiveVoices | null> {
    try {
      return await client.live.voices()
    } catch (caught) {
      error.value = errorMessage(caught)
      return null
    }
  }

  return {
    state,
    connected,
    statusMessage,
    sessionId,
    version,
    error,
    sentSystemPrompt,
    transcripts,
    micActive,
    remoteAudioActive,
    rawEventCount,
    start,
    stop,
    sendText,
    notifySpoken,
    fetchVoices,
    reset,
  }
}

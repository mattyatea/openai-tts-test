/**
 * GPT Live（Codex app-server の realtime セッション）の管理。
 *
 * 流れ:
 *   1. ブラウザが WebRTC の offer を作る
 *   2. サーバーが thread/realtime/start に offer を渡し、SDP answer を受け取る
 *   3. ブラウザは answer を設定してマイク音声と GPT Live 音声を直接やり取りする
 *   4. サーバーは transcript 通知だけを購読し、SSE でブラウザへ中継する
 *
 * GPT Live の音声そのものは使わない。テキストだけ取り出して、好きな TTS に差し替える。
 */

import { randomUUID } from 'node:crypto'

import type { LiveEvent, LiveStatus, LiveVoices } from '../../contract'
import { CodexAppServer, type AppServerNotification } from './appServer'
import { codexBin } from '../settings'

type Subscriber = (event: LiveEvent) => void

interface RealtimeSession {
  id: string
  threadId: string
  version: string
  voice: string | null
  realtimeSessionId: string | null
  subscribers: Set<Subscriber>
  assistantText: string
  userText: string
  closed: boolean
  pendingEvents: LiveEvent[]
}

interface PendingSdp {
  resolve: (sdp: string) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const SDP_TIMEOUT_MS = 45_000
const EVENT_BUFFER_LIMIT = 200

export class LiveManager {
  private readonly appServer = new CodexAppServer(codexBin)
  private readonly sessions = new Map<string, RealtimeSession>()
  private readonly pendingSdp = new Map<string, PendingSdp>()
  private lastError: string | null = null
  private listenerBound = false

  async status(): Promise<LiveStatus> {
    let available = false
    let userAgent: string | null = this.appServer.userAgent
    let authMode: string | null = null
    let authenticated = false
    let error: string | null = null

    try {
      await this.appServer.start()
      available = true
      userAgent = this.appServer.userAgent
      const auth = await this.appServer.readAuth()
      authMode = auth.authMode
      authenticated = auth.authenticated
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
    }

    return {
      running: this.sessions.size > 0,
      sessionId: this.sessions.keys().next().value ?? null,
      threadId: [...this.sessions.values()][0]?.threadId ?? null,
      version: [...this.sessions.values()][0]?.version ?? null,
      codexAvailable: available,
      codexUserAgent: userAgent,
      authenticated,
      authMode,
      lastError: error ?? this.lastError,
    }
  }

  async listVoices(): Promise<LiveVoices> {
    await this.ensureStarted()
    const result = await this.appServer.request<{ voices?: Partial<LiveVoices> }>(
      'thread/realtime/listVoices',
      {},
      15_000,
    )
    const voices = result.voices ?? {}
    return {
      v1: voices.v1 ?? [],
      v2: voices.v2 ?? [],
      defaultV1: voices.defaultV1 ?? null,
      defaultV2: voices.defaultV2 ?? null,
    }
  }

  private async ensureStarted(): Promise<void> {
    if (!this.listenerBound) {
      this.appServer.onNotification((notification) => this.onNotification(notification))
      this.listenerBound = true
    }
    await this.appServer.start()
  }

  private onNotification(notification: AppServerNotification): void {
    const { method, params } = notification

    if (method === 'codex/closed') {
      for (const session of this.sessions.values()) {
        this.publish(session, { type: 'error', message: 'codex app-server が終了しました' })
        this.publish(session, { type: 'closed', reason: 'app-server-exit' })
        session.closed = true
      }
      return
    }

    const threadId = typeof params.threadId === 'string' ? params.threadId : null
    if (!threadId) return
    const session = this.findByThreadId(threadId)

    switch (method) {
      case 'thread/realtime/sdp': {
        const pending = this.pendingSdp.get(threadId)
        if (pending && typeof params.sdp === 'string') {
          clearTimeout(pending.timer)
          this.pendingSdp.delete(threadId)
          pending.resolve(params.sdp)
        }
        return
      }
      case 'thread/realtime/started': {
        if (!session) return
        session.realtimeSessionId =
          typeof params.realtimeSessionId === 'string' ? params.realtimeSessionId : null
        session.version = typeof params.version === 'string' ? params.version : session.version
        this.publish(session, {
          type: 'session-started',
          version: session.version,
          realtimeSessionId: session.realtimeSessionId,
        })
        return
      }
      case 'thread/realtime/transcript/delta':
      case 'thread/realtime/item/transcript/delta': {
        if (!session) return
        const delta = typeof params.delta === 'string' ? params.delta : ''
        if (!delta) return
        if (this.roleOf(params) === 'assistant') {
          session.assistantText += delta
          this.publish(session, { type: 'assistant-transcript-delta', delta, text: session.assistantText })
        } else {
          session.userText += delta
          this.publish(session, { type: 'user-transcript-delta', delta, text: session.userText })
        }
        return
      }
      case 'thread/realtime/transcript/done': {
        if (!session) return
        const text = typeof params.text === 'string' ? params.text : ''
        if (!text.trim()) return
        if (this.roleOf(params) === 'assistant') {
          session.assistantText = ''
          this.publish(session, { type: 'assistant-transcript-done', text })
        } else {
          session.userText = ''
          this.publish(session, { type: 'user-transcript-done', text })
        }
        return
      }
      case 'thread/realtime/itemAdded':
      case 'thread/realtime/item/started':
      case 'thread/realtime/item/completed': {
        if (!session || !params.item) return
        this.publish(session, { type: 'item-added', item: params.item })
        return
      }
      case 'thread/realtime/error': {
        const message = typeof params.message === 'string' ? params.message : 'unknown realtime error'
        this.lastError = message
        if (session) this.publish(session, { type: 'error', message })
        return
      }
      case 'thread/realtime/closed': {
        if (!session) return
        session.closed = true
        this.publish(session, {
          type: 'closed',
          reason: typeof params.reason === 'string' ? params.reason : null,
        })
        return
      }
      default:
        return
    }
  }

  private roleOf(params: Record<string, unknown>): string {
    const role = params.role
    return typeof role === 'string' ? role : 'assistant'
  }

  private findByThreadId(threadId: string): RealtimeSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.threadId === threadId) return session
    }
    return undefined
  }

  private publish(session: RealtimeSession, event: LiveEvent): void {
    if (session.subscribers.size === 0) {
      session.pendingEvents.push(event)
      if (session.pendingEvents.length > EVENT_BUFFER_LIMIT) session.pendingEvents.shift()
      return
    }
    for (const subscriber of session.subscribers) {
      try {
        subscriber(event)
      } catch (error) {
        console.error('[live] subscriber failed', error)
      }
    }
  }

  async startSession(input: {
    sdp: string
    version: 'v1' | 'v3'
    voice?: string
    systemPrompt?: string
    instructions?: string
    initialPrompt?: string
    includeStartupContext?: boolean
    model?: string
  }): Promise<{
    sessionId: string
    threadId: string
    sdp: string
    version: string
    realtimeSessionId: string | null
    voice: string | null
    codexUserAgent: string | null
  }> {
    await this.ensureStarted()

    const threadResult = await this.appServer.request<{ thread?: { id?: string } }>(
      'thread/start',
      {
        cwd: process.cwd(),
        ephemeral: true,
        approvalPolicy: 'never',
        sandbox: 'read-only',
        // システムプロンプトは Codex 側の developer instructions として渡す。
        ...(input.systemPrompt?.trim() ? { developerInstructions: input.systemPrompt.trim() } : {}),
        ...(input.model ? { model: input.model } : {}),
      },
      30_000,
    )
    const threadId = threadResult.thread?.id
    if (!threadId) throw new Error('thread を作成できませんでした（thread.id が空です）')

    const session: RealtimeSession = {
      id: randomUUID(),
      threadId,
      version: input.version,
      voice: input.voice ?? null,
      realtimeSessionId: null,
      subscribers: new Set(),
      assistantText: '',
      userText: '',
      closed: false,
      pendingEvents: [],
    }
    this.sessions.set(session.id, session)

    // システムプロンプトと開始時の追加指示を 1 つにまとめて realtime モデルへ渡す。
    // Codex 側の developer instructions だけでは口調や人格が薄まるため、両方に渡す。
    const sessionInstructions = [input.systemPrompt?.trim(), input.instructions?.trim()]
      .filter((part): part is string => Boolean(part))
      .join('\n\n')

    const sdpPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingSdp.delete(threadId)
        reject(new Error('realtime の SDP answer が返りませんでした（タイムアウト）'))
      }, SDP_TIMEOUT_MS)
      this.pendingSdp.set(threadId, { resolve, reject, timer })
    })

    try {
      await this.appServer.request(
        'thread/realtime/start',
        {
          threadId,
          outputModality: 'audio',
          transport: { type: 'webrtc', sdp: input.sdp },
          version: input.version,
          ...(input.voice ? { voice: input.voice } : {}),
          // リアルタイムモデル自身に効かせる指示。Codex の起動コンテキストより優先させたい内容はここへ。
          ...(sessionInstructions ? { realtimeStartInstructions: sessionInstructions } : {}),
          ...(input.initialPrompt ? { prompt: input.initialPrompt } : {}),
          ...(input.includeStartupContext === false ? { includeStartupContext: false } : {}),
        },
        30_000,
      )
      const answer = await sdpPromise
      return {
        sessionId: session.id,
        threadId,
        sdp: answer,
        version: session.version,
        realtimeSessionId: session.realtimeSessionId,
        voice: session.voice,
        codexUserAgent: this.appServer.userAgent,
      }
    } catch (error) {
      this.sessions.delete(session.id)
      const pending = this.pendingSdp.get(threadId)
      if (pending) {
        clearTimeout(pending.timer)
        this.pendingSdp.delete(threadId)
      }
      await this.appServer.request('thread/realtime/stop', { threadId }, 10_000).catch(() => undefined)
      throw error
    }
  }

  async *streamEvents(sessionId: string, signal?: AbortSignal): AsyncGenerator<LiveEvent> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      yield { type: 'error', message: 'セッションが見つかりません（すでに終了しています）' }
      return
    }

    const queue: LiveEvent[] = []
    let wake: (() => void) | null = null
    const buffered = session.pendingEvents.splice(0, session.pendingEvents.length)
    queue.push(...buffered)

    const subscriber: Subscriber = (event) => {
      queue.push(event)
      wake?.()
    }
    session.subscribers.add(subscriber)

    const onAbort = (): void => {
      wake?.()
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      while (true) {
        if (queue.length === 0) {
          if (signal?.aborted) return
          await new Promise<void>((resolve) => {
            wake = resolve
          })
          wake = null
          continue
        }
        const event = queue.shift()!
        yield event
        if (event.type === 'closed' && session.closed) return
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      session.subscribers.delete(subscriber)
    }
  }

  async appendText(sessionId: string, text: string): Promise<void> {
    const session = this.requireSession(sessionId)
    await this.appServer.request('thread/realtime/appendText', {
      threadId: session.threadId,
      text,
      role: 'user',
    })
  }

  async appendSpeech(sessionId: string, text: string): Promise<void> {
    const session = this.requireSession(sessionId)
    await this.appServer.request('thread/realtime/appendSpeech', {
      threadId: session.threadId,
      text,
    })
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.sessions.delete(sessionId)
    session.closed = true
    session.subscribers.clear()
    await this.appServer.request('thread/realtime/stop', { threadId: session.threadId }, 10_000).catch(() => undefined)
    this.publish(session, { type: 'closed', reason: 'requested' })
  }

  private requireSession(sessionId: string): RealtimeSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('セッションが見つかりません')
    return session
  }

  shutdown(): void {
    this.sessions.clear()
    this.appServer.stop()
  }
}

export const liveManager = new LiveManager()

/**
 * `codex app-server` を子プロセスとして起動し、JSON-RPC（改行区切り）で話す最小クライアント。
 *
 * このアプリが使うのは thread と thread/realtime 系だけ。
 * 認証は Codex 本体のログイン（ChatGPT アカウント）をそのまま使う。
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

export interface AppServerNotification {
  method: string
  params: Record<string, unknown>
}

type NotificationListener = (notification: AppServerNotification) => void

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
  method: string
}

export class AppServerError extends Error {
  readonly code: number | undefined

  constructor(message: string, code?: number) {
    super(message)
    this.name = 'AppServerError'
    this.code = code
  }
}

export class CodexAppServer {
  private child: ChildProcessWithoutNullStreams | null = null
  private readonly listeners = new Set<NotificationListener>()
  private readonly pending = new Map<number, PendingRequest>()
  private nextId = 1
  private stdoutBuffer = ''
  private startPromise: Promise<void> | null = null
  private closed = false
  userAgent: string | null = null
  authMode: string | null = null

  constructor(private readonly bin: string) {}

  get running(): boolean {
    return this.child !== null && !this.closed
  }

  onNotification(listener: NotificationListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {
    if (this.running) return
    if (this.startPromise) return this.startPromise
    this.closed = false
    this.startPromise = this.spawnAndInitialize().catch((error: unknown) => {
      this.startPromise = null
      throw error
    })
    return this.startPromise
  }

  private spawnAndInitialize(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false
      const child = spawn(this.bin, ['app-server', '--listen', 'stdio://'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      }) as ChildProcessWithoutNullStreams

      const failStart = (error: Error): void => {
        if (settled) return
        settled = true
        this.child = null
        reject(error)
      }

      child.on('error', (error) => {
        failStart(new AppServerError(`codex app-server を起動できません（${this.bin}）: ${error.message}`))
      })

      child.on('exit', (code) => {
        const wasSettled = settled
        this.child = null
        this.closed = true
        const error = new AppServerError(`codex app-server が終了しました（exit ${code ?? 'null'}）`)
        if (!wasSettled) failStart(error)
        for (const [id, request] of this.pending) {
          clearTimeout(request.timer)
          this.pending.delete(id)
          request.reject(error)
        }
        this.emit({ method: 'codex/closed', params: { code: code ?? null } })
      })

      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        this.stdoutBuffer += chunk
        let index = this.stdoutBuffer.indexOf('\n')
        while (index >= 0) {
          const line = this.stdoutBuffer.slice(0, index).trim()
          this.stdoutBuffer = this.stdoutBuffer.slice(index + 1)
          index = this.stdoutBuffer.indexOf('\n')
          if (line) this.handleLine(line)
        }
      })

      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => {
        const text = chunk.trim()
        if (text) console.warn('[app-server]', text.slice(0, 800))
      })

      this.child = child

      this.request('initialize', {
        clientInfo: { name: 'tts-lab', title: 'TTS Lab', version: '0.1.0' },
        capabilities: { experimentalApi: true, requestAttestation: false },
      })
        .then((result) => {
          this.userAgent = typeof result.userAgent === 'string' ? result.userAgent : null
          settled = true
          resolve()
        })
        .catch((error: unknown) => {
          failStart(error instanceof Error ? error : new AppServerError(String(error)))
        })
    })
  }

  private handleLine(line: string): void {
    let message: Record<string, unknown>
    try {
      message = JSON.parse(line) as Record<string, unknown>
    } catch {
      return
    }

    const id = message.id
    if (typeof id === 'number') {
      const request = this.pending.get(id)
      if (!request) return
      this.pending.delete(id)
      clearTimeout(request.timer)
      const error = message.error as { code?: number; message?: string } | undefined
      if (error) {
        request.reject(new AppServerError(`${request.method}: ${error.message ?? 'unknown error'}`, error.code))
        return
      }
      request.resolve((message.result ?? {}) as Record<string, unknown>)
      return
    }

    const method = message.method
    if (typeof method === 'string') {
      this.emit({ method, params: (message.params ?? {}) as Record<string, unknown> })
    }
  }

  private emit(notification: AppServerNotification): void {
    for (const listener of this.listeners) {
      try {
        listener(notification)
      } catch (error) {
        console.error('[app-server] notification listener failed', error)
      }
    }
  }

  request<T extends Record<string, unknown> = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 30_000,
  ): Promise<T> {
    const child = this.child
    if (!child || this.closed) {
      return Promise.reject(new AppServerError('codex app-server が起動していません'))
    }
    const id = this.nextId++
    const payload = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new AppServerError(`${method} がタイムアウトしました（${timeoutMs}ms）`))
      }, timeoutMs)
      this.pending.set(id, {
        method,
        timer,
        resolve: (value) => resolve(value as T),
        reject,
      })
      child.stdin.write(payload, (error) => {
        if (!error) return
        this.pending.delete(id)
        clearTimeout(timer)
        reject(new AppServerError(`${method} の送信に失敗しました: ${error.message}`))
      })
    })
  }

  /** 認証状態を読む。realtime の可否をユーザーに示すために使う。 */
  async readAuth(): Promise<{ authMode: string | null; authenticated: boolean }> {
    try {
      const result = await this.request('getAuthStatus', {}, 10_000)
      const mode = typeof result.authMethod === 'string'
        ? result.authMethod
        : typeof result.authMode === 'string'
          ? result.authMode
          : null
      this.authMode = mode
      const authenticated =
        result.authenticated === true || result.requiresOpenaiAuth === false || mode === 'chatgpt' || mode === 'apikey'
      return { authMode: mode, authenticated }
    } catch {
      return { authMode: null, authenticated: false }
    }
  }

  stop(): void {
    this.closed = true
    const child = this.child
    this.child = null
    if (!child) return
    try {
      child.kill()
    } catch {
      // すでに落ちている場合は何もしない
    }
  }
}

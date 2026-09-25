/** サーバー起動時の既定値。API キーは保存せず、リクエストごとに受け取る。 */

export interface ServerDefaults {
  baseUrl: string
  model: string
  voice: string
  apiKey: string | undefined
}

function env(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

export const serverDefaults: ServerDefaults = {
  baseUrl: env('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
  model: env('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts',
  voice: env('OPENAI_TTS_VOICE') ?? 'coral',
  apiKey: env('OPENAI_API_KEY'),
}

export const host = env('HOST') ?? '127.0.0.1'
export const port = Number(env('PORT') ?? '8790')
export const codexBin = env('CODEX_BIN') ?? 'codex'

/** 生成は長め、接続確認は短め。 */
export const SPEECH_TIMEOUT_MS = Number(env('SPEECH_TIMEOUT_MS') ?? '300000')
export const PROBE_TIMEOUT_MS = Number(env('PROBE_TIMEOUT_MS') ?? '15000')

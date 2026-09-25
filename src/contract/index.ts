/**
 * oRPC のコントラクト（Contract First の唯一の正）。
 *
 * ここには実装を一切置かない。サーバーは implement(contract) で実装し、
 * クライアントは contract だけを import して型付きで呼び出す。
 */

import { eventIterator, oc } from '@orpc/contract'
import * as z from 'zod'

// ---------------------------------------------------------------- 共通スキーマ

export const TtsFormatSchema = z.enum(['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'])
export type TtsFormat = z.infer<typeof TtsFormatSchema>

/** 上流の OpenAI 互換エンドポイント。API キーは呼び出しごとに渡す（サーバー保存しない）。 */
export const UpstreamSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().optional(),
})
export type Upstream = z.infer<typeof UpstreamSchema>

export const ProviderKindSchema = z.enum(['openai', 'irodori', 'custom'])
export type ProviderKind = z.infer<typeof ProviderKindSchema>

export const ProviderPresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: ProviderKindSchema,
  baseUrl: z.string(),
  hint: z.string(),
  /** 選んだときに初期値として入れるモデル。 */
  defaultModel: z.string().optional(),
  /** 選んだときに初期値として入れるボイス。 */
  defaultVoice: z.string().optional(),
  /** true なら最初から irodori オブジェクトを有効にする。 */
  useIrodori: z.boolean().optional(),
})
export type ProviderPreset = z.infer<typeof ProviderPresetSchema>

export const ModelInfoSchema = z.object({
  id: z.string(),
  ownedBy: z.string().nullable().optional(),
})
export type ModelInfo = z.infer<typeof ModelInfoSchema>

export const VoiceInfoSchema = z.object({
  id: z.string(),
  noRef: z.boolean().optional(),
  refWav: z.string().nullable().optional(),
  refWavs: z.array(z.string()).nullable().optional(),
})
export type VoiceInfo = z.infer<typeof VoiceInfoSchema>

// ------------------------------------------------------------ Irodori 固有設定

/** Irodori-TTS-Server の `irodori` オブジェクト。OpenAI へは送らない。 */
export const IrodoriOptionsSchema = z.object({
  caption: z.string().optional(),
  ref_wav: z.string().optional(),
  ref_wavs: z.array(z.string()).optional(),
  ref_latent: z.string().optional(),
  ref_latents: z.array(z.string()).optional(),
  ref_embed: z.string().optional(),
  no_ref: z.boolean().optional(),
  seconds: z.number().optional(),
  duration_scale: z.number().optional(),
  min_seconds: z.number().optional(),
  max_seconds: z.number().optional(),
  max_ref_seconds: z.number().optional(),
  ref_normalize_db: z.number().optional(),
  ref_ensure_max: z.boolean().optional(),
  num_steps: z.number().int().optional(),
  t_schedule_mode: z.enum(['linear', 'sway']).optional(),
  sway_coeff: z.number().optional(),
  num_candidates: z.number().int().optional(),
  decode_mode: z.enum(['sequential', 'batch']).optional(),
  cfg_scale_text: z.number().optional(),
  cfg_scale_caption: z.number().optional(),
  cfg_scale_speaker: z.number().optional(),
  cfg_guidance_mode: z.enum(['independent', 'joint', 'alternating']).optional(),
  cfg_scale: z.number().optional(),
  cfg_min_t: z.number().optional(),
  cfg_max_t: z.number().optional(),
  truncation_factor: z.number().optional(),
  rescale_k: z.number().optional(),
  rescale_sigma: z.number().optional(),
  context_kv_cache: z.boolean().optional(),
  speaker_kv_scale: z.number().optional(),
  speaker_kv_min_t: z.number().optional(),
  speaker_kv_max_layers: z.number().int().optional(),
  seed: z.number().int().optional(),
  trim_tail: z.boolean().optional(),
  tail_window_size: z.number().int().optional(),
  tail_std_threshold: z.number().optional(),
  tail_mean_threshold: z.number().optional(),
  max_text_len: z.number().int().optional(),
  max_caption_len: z.number().int().optional(),
  lora_adapter: z.string().optional(),
  chunking_enabled: z.boolean().optional(),
  chunk_min_chars: z.number().int().optional(),
  first_sentence_chunk_min_chars: z.number().int().optional(),
})
export type IrodoriOptions = z.infer<typeof IrodoriOptionsSchema>

// ------------------------------------------------------------------ 音声合成

export const SpeechRequestSchema = z.object({
  upstream: UpstreamSchema,
  model: z.string().min(1),
  input: z.string().min(1),
  voice: z.string().optional(),
  responseFormat: TtsFormatSchema.default('mp3'),
  speed: z.number().min(0.25).max(4).optional(),
  instructions: z.string().optional(),
  irodori: IrodoriOptionsSchema.optional(),
  /** true なら `stream_format: "sse"` の生イベントも受け取り、UI 側で連結する。 */
  useSse: z.boolean().default(false),
})
export type SpeechRequest = z.infer<typeof SpeechRequestSchema>

export const SpeechResultSchema = z.object({
  audio: z.instanceof(Blob),
  format: TtsFormatSchema,
  mediaType: z.string(),
  bytes: z.number().int(),
  elapsedMs: z.number(),
  mode: z.enum(['single', 'sse', 'chunks']),
  chunkCount: z.number().int(),
  transcripts: z.array(z.string()),
  headers: z.record(z.string(), z.string()),
  upstreamStatus: z.number().int(),
})
export type SpeechResult = z.infer<typeof SpeechResultSchema>

/**
 * ストリーミング合成のイベント。
 *
 * Irodori-TTS-Server は 1 チャンク = 完全な音声ファイルを返すので、
 * 届いた順にそのまま再生できる。OpenAI の生デルタのように
 * 単体で再生できないものは、最後に 1 チャンクへまとめて送出する。
 */
export const SpeechChunkEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chunk'),
    index: z.number().int(),
    text: z.string(),
    format: z.string(),
    mediaType: z.string(),
    audioBase64: z.string(),
    seed: z.number().nullable(),
    totalToDecode: z.number().nullable(),
  }),
  z.object({ type: z.literal('done'), chunks: z.number().int() }),
  z.object({ type: z.literal('error'), message: z.string() }),
])
export type SpeechChunkEvent = z.infer<typeof SpeechChunkEventSchema>

// ------------------------------------------------------------------ GPT Live

export const LiveVoiceSchema = z.object({
  v1: z.array(z.string()),
  v2: z.array(z.string()),
  defaultV1: z.string().nullable(),
  defaultV2: z.string().nullable(),
})
export type LiveVoices = z.infer<typeof LiveVoiceSchema>

export const LiveStartInputSchema = z.object({
  /** ブラウザが作った WebRTC の SDP offer。 */
  sdp: z.string().min(1),
  version: z.enum(['v1', 'v3']).default('v3'),
  voice: z.string().optional(),
  /**
   * realtime セッションのシステムプロンプト。
   *
   * Codex 側の `prompt` 引数にそのまま渡り、既定の「You are Codex」という
   * 汎用人格を置き換える。人格・役割・口調・制約はここに書く。
   */
  systemPrompt: z.string().optional(),
  /**
   * 会話コンテキストへ developer 指示として足す追加の指示。
   * システムプロンプトとは別枠で、上限は約 8192 トークン。
   */
  instructions: z.string().optional(),
  /** システムプロンプト末尾へ「セッション開始時」として追記する振る舞い。 */
  initialPrompt: z.string().optional(),
  /**
   * Codex の起動コンテキストを realtime セッションに含めるか。
   * 既定は true。なりきりや別人格を優先したいときは false にする。
   */
  includeStartupContext: z.boolean().optional(),
  model: z.string().optional(),
})
export type LiveStartInput = z.infer<typeof LiveStartInputSchema>

export const LiveStartResultSchema = z.object({
  sessionId: z.string(),
  threadId: z.string(),
  /** app-server が返した SDP answer。 */
  sdp: z.string(),
  version: z.string(),
  realtimeSessionId: z.string().nullable(),
  voice: z.string().nullable(),
  codexUserAgent: z.string().nullable(),
  /** 実際に realtime へシステムプロンプトとして渡した文字列（未指定なら null）。 */
  systemPromptSent: z.string().nullable(),
})
export type LiveStartResult = z.infer<typeof LiveStartResultSchema>

export const LiveSessionIdSchema = z.object({ sessionId: z.string().min(1) })

export const LiveEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session-started'), version: z.string(), realtimeSessionId: z.string().nullable() }),
  z.object({ type: z.literal('user-transcript-delta'), delta: z.string(), text: z.string() }),
  z.object({ type: z.literal('user-transcript-done'), text: z.string() }),
  z.object({ type: z.literal('assistant-transcript-delta'), delta: z.string(), text: z.string() }),
  z.object({ type: z.literal('assistant-transcript-done'), text: z.string() }),
  z.object({ type: z.literal('item-added'), item: z.unknown() }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('closed'), reason: z.string().nullable() }),
])
export type LiveEvent = z.infer<typeof LiveEventSchema>

export const LiveStatusSchema = z.object({
  running: z.boolean(),
  sessionId: z.string().nullable(),
  threadId: z.string().nullable(),
  version: z.string().nullable(),
  codexAvailable: z.boolean(),
  codexUserAgent: z.string().nullable(),
  authenticated: z.boolean(),
  authMode: z.string().nullable(),
  lastError: z.string().nullable(),
})
export type LiveStatus = z.infer<typeof LiveStatusSchema>

// -------------------------------------------------------------------- システム

export const ServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  runtime: z.object({ node: z.string(), platform: z.string() }),
  codex: z.object({
    bin: z.string(),
    available: z.boolean(),
    userAgent: z.string().nullable(),
    authMode: z.string().nullable(),
    error: z.string().nullable(),
  }),
  defaults: z.object({
    baseUrl: z.string(),
    model: z.string(),
    voice: z.string(),
    hasServerApiKey: z.boolean(),
  }),
  presets: z.array(ProviderPresetSchema),
  openaiVoices: z.array(z.string()),
  openaiModels: z.array(z.string()),
  irodoriEmoji: z.array(z.object({ emoji: z.string(), label: z.string(), description: z.string() })),
})
export type ServerInfo = z.infer<typeof ServerInfoSchema>

// --------------------------------------------------------------------- コントラクト

export const UpstreamHealthSchema = z.object({
  ok: z.literal(true),
  reachable: z.boolean(),
  authenticated: z.boolean(),
  kind: ProviderKindSchema.or(z.literal('unknown')),
  upstream: z.string(),
  detail: z.unknown().optional(),
  checks: z.array(z.object({ url: z.string(), status: z.number().optional(), error: z.string().optional() })),
})
export type UpstreamHealth = z.infer<typeof UpstreamHealthSchema>

export const contract = {
  system: {
    info: oc.output(ServerInfoSchema),
    liveStatus: oc.output(LiveStatusSchema),
  },
  upstream: {
    health: oc.input(UpstreamSchema).output(UpstreamHealthSchema),
    models: oc.input(UpstreamSchema).output(
      z.object({
        ok: z.boolean(),
        status: z.number(),
        upstream: z.string(),
        models: z.array(ModelInfoSchema),
        error: z.string().optional(),
      }),
    ),
    voices: oc.input(UpstreamSchema).output(
      z.object({
        ok: z.boolean(),
        supported: z.boolean(),
        status: z.number(),
        upstream: z.string(),
        voices: z.array(VoiceInfoSchema),
        error: z.string().optional(),
        note: z.string().optional(),
      }),
    ),
    uploadVoice: oc
      .input(z.object({ upstream: UpstreamSchema, file: z.instanceof(File), voiceId: z.string().optional() }))
      .output(z.object({ ok: z.boolean(), status: z.number(), id: z.string().optional(), raw: z.unknown() })),
  },
  tts: {
    speak: oc.input(SpeechRequestSchema).output(SpeechResultSchema),
    /** SSE を受けて、チャンクが届くたびに流す。 */
    stream: oc.input(SpeechRequestSchema).output(eventIterator(SpeechChunkEventSchema)),
  },
  live: {
    voices: oc.output(LiveVoiceSchema),
    start: oc.input(LiveStartInputSchema).output(LiveStartResultSchema),
    events: oc.input(LiveSessionIdSchema).output(eventIterator(LiveEventSchema)),
    appendText: oc
      .input(z.object({ sessionId: z.string(), text: z.string().min(1) }))
      .output(z.object({ ok: z.boolean() })),
    /** 自分の TTS で読み上げたテキストを realtime セッションにも伝える。 */
    appendSpeech: oc
      .input(z.object({ sessionId: z.string(), text: z.string().min(1) }))
      .output(z.object({ ok: z.boolean() })),
    stop: oc.input(LiveSessionIdSchema).output(z.object({ ok: z.boolean() })),
  },
}

export type AppContract = typeof contract

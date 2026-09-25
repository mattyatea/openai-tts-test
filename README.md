# openai-tts-test

OpenAI TTS の動作確認と、GPT Live の音声を自分の TTS に差し替える実験を 1 つのアプリにまとめたものです。

Vue 3 + Reka UI + Tailwind CSS の SPA と、Hono + oRPC の API サーバーで構成しています。API はコントラクトファーストで、`src/contract/index.ts` が唯一の正です。

## できること

### Playground（`/playground`）

- OpenAI / Irodori-TTS / 任意の OpenAI 互換サーバーへ切り替えて音声を生成
- モデル、ボイス、`response_format`、`speed`、`instructions` を指定
- `stream_format: "sse"` の受信に対応（OpenAI の生デルタと Irodori のチャンクを両方処理）
- Irodori-TTS 固有の `irodori` オブジェクト（`caption`、`ref_wav`、`cfg_scale_*`、`num_steps`、`t_schedule_mode` など）を送信
- Irodori 公式の絵文字パレット 45 種を挿入

### GPT Live（`/live`）

マイクから GPT Live へ話しかけ、返答テキストだけを取り出して OpenAI TTS で読み上げる構成です。

- ブラウザが WebRTC で直接 GPT Live（Codex app-server の realtime）と接続
- GPT Live の音声トラックは受け取りますが、再生せず破棄できます
- 返答が確定した時点で、左下の TTS が読み上げ（OpenAI でも Irodori-TTS でも可）
- `systemPrompt` を Codex の developer instructions と realtime の開始指示の両方に渡す
- 「Codex の起動コンテキストを含める」をオフにすると、Codex 標準の振る舞いを外してシステムプロンプトを優先させる
- テキスト入力からの会話も可能（マイクなしで確認できる）

### プリセット

`Irodori-TTS（lab-02）` は `http://lab-02.internal.nanasi-apps.xyz:8088/v1` を指します。接続先は `IRODORI_BASE_URL` で変更できます。選ぶと LoRA モデルと `voice: none`、`irodori` オブジェクトが自動で設定されます。

## 必要なもの

- Node.js 22 以上（`mise.toml` で 24.21.0 を指定）
- pnpm 10
- Codex CLI（`codex app-server` が動くこと）
- Codex の ChatGPT ログイン（realtime は API キー認証では動きません）

```bash
mise install
pnpm install
```

## 起動

```bash
# 開発（API 8790 / Vite 8791）
pnpm dev

# 本番ビルドして起動
pnpm build
pnpm start
```

ブラウザで `http://127.0.0.1:8791`（開発）または `http://127.0.0.1:8790`（本番）を開きます。

## 環境変数

`.env.example` を `.env` にコピーして使います。

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `OPENAI_API_KEY` | なし | サーバー側で保持する API キー。画面で入力すれば不要 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 既定の接続先 |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` | 既定のモデル |
| `OPENAI_TTS_VOICE` | `coral` | 既定のボイス |
| `CODEX_BIN` | `codex` | app-server の起動コマンド |
| `IRODORI_BASE_URL` | lab-02 の 8088 | Irodori-TTS プリセットの接続先 |
| `HOST` / `PORT` | `127.0.0.1` / `8790` | API サーバー |

API キーはブラウザからリクエストごとに送るだけで、サーバーには保存しません。

## 構成

```text
src/
  contract/index.ts          oRPC コントラクト（API の唯一の正）
  server/
    index.ts                 Hono + oRPC + SPA 配信
    router.ts                コントラクトの実装
    tts.ts                   OpenAI 互換 TTS 呼び出し（通常 / SSE）
    constants.ts             ボイス、モデル、プリセット、絵文字パレット
    settings.ts              環境変数
    live/
      appServer.ts           codex app-server の JSON-RPC クライアント
      sessions.ts            realtime セッション管理と transcript 中継
  client/
    App.vue / router.ts / main.ts
    components/
      layout/                ヘッダー
      ui/                    Reka UI ベースの汎用部品
      playground/            Playground 用のカード
      live/                  GPT Live 用のカード
    composables/
      useGptLive.ts          WebRTC 接続と transcript の蓄積
      useSpeechQueue.ts      読み上げキュー
      useTtsSettings.ts      TTS 設定とリクエスト組み立て
      useIrodoriOptions.ts   Irodori パラメータ
      useUpstreamProbe.ts    接続確認、モデル、ボイス取得
      useServerInfo.ts       サーバー情報
      useToast.ts            トースト
    lib/                     oRPC クライアント、音声ユーティリティ
```

## API

`/rpc` に oRPC の RPC プロトコルで公開しています。主な手続きは次のとおりです。

| 手続き | 内容 |
| --- | --- |
| `system.info` | サーバー、Codex、プリセット情報 |
| `system.liveStatus` | Codex の可用性と認証状態 |
| `upstream.health` / `upstream.models` / `upstream.voices` | upstream の確認と一覧 |
| `upstream.uploadVoice` | Irodori の参照音声アップロード |
| `tts.speak` | 音声生成（SSE の連結も含む） |
| `live.voices` | realtime のボイス一覧 |
| `live.start` / `live.stop` | realtime セッションの開始と終了 |
| `live.events` | transcript のストリーム（SSE） |
| `live.appendText` / `live.appendSpeech` | テキスト入力と読み上げ通知 |

## 動作確認用スクリプト

`scripts/live-smoke.mjs` は、ブラウザの代わりに werift で WebRTC を張り、`live.start` から transcript までを一通り確認します。

```bash
pnpm build && pnpm start   # 別ターミナルで起動しておく
pnpm smoke:live
```

`scripts/tts-smoke.mjs` は、指定した接続先で実際に音声を生成して WAV を書き出します。

```bash
node scripts/tts-smoke.mjs out.wav http://lab-02.internal.nanasi-apps.xyz:8088/v1 irodori-tts-renewa none "こんにちは"
```

## 既知の制約

- realtime は Codex の ChatGPT ログインが前提です。API キーだけでは `realtime conversation requires API key auth` で失敗します。
- WebRTC の音声トラックは受け取る必要があります（realtime V3 の仕様）。受け取ったうえで再生しなければ、音は鳴りません。
- マイク音声は WebRTC のメディアトラックで送ります。data channel 経由の音声投入（`input_audio.append`）は V3 では拒否されるため、実装していません。
- GPT Live の応答生成はマイク入力（VAD）または `appendText` で始まります。`response.create` は Codex 委譲セッションでは使えません。
- システムプロンプトは realtime の開始指示にも渡しますが、リアルタイムモデル側の素の振る舞いが残る場合があります。効きが弱いときは「Codex の起動コンテキストを含める」をオフにしてください。
- Irodori の参照音声パスはサーバー側から見たパスです。
- 生成はモデル読み込みを含め長くなる場合があり、既定のタイムアウトは 300 秒です（`SPEECH_TIMEOUT_MS`）。

/**
 * tts.speak が実際に音声を返すか確認する。
 *
 *   node scripts/tts-smoke.mjs [出力先] [baseUrl] [model] [voice] [テキスト]
 *
 * 例:
 *   node scripts/tts-smoke.mjs out.wav http://lab-02.internal.nanasi-apps.xyz:8088/v1 irodori-tts-renewa none "こんにちは"
 */

import { writeFile } from 'node:fs/promises'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

const output = process.argv[2] ?? 'speech-smoke.wav'
const baseUrl = process.argv[3] ?? 'http://lab-02.internal.nanasi-apps.xyz:8088/v1'
const model = process.argv[4] ?? 'irodori-tts-renewa'
const voice = process.argv[5] ?? 'none'
const text = process.argv[6] ?? 'こんにちは。Irodori TTS の疎通確認です。'
const localRpc = process.env.TTS_LAB_RPC ?? 'http://127.0.0.1:8790/rpc'

const link = new RPCLink({ url: localRpc })
const client = createORPCClient(link)

const started = Date.now()
console.log(`POST ${localRpc}/tts/speak`)
console.log(`  upstream: ${baseUrl}`)
console.log(`  model: ${model} / voice: ${voice}`)
console.log(`  text: ${text}`)

let result
try {
  result = await client.tts.speak({
    upstream: { baseUrl },
    model,
    input: text,
    voice,
    responseFormat: 'wav',
    useSse: false,
  })
} catch (error) {
  console.error('失敗:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const buffer = Buffer.from(await result.audio.arrayBuffer())
await writeFile(output, buffer)
console.log(
  `OK: ${output} ${(buffer.byteLength / 1024).toFixed(1)} KB / ${result.elapsedMs} ms` +
    ` / mode=${result.mode} chunk=${result.chunkCount} / 実測 ${Date.now() - started} ms`,
)

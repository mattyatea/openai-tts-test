/**
 * tts.stream が「生成しながら」チャンクを返すか、到着時刻を測って確認する。
 *
 *   node scripts/stream-smoke.mjs [baseUrl] [model]
 */

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

const upstream = process.argv[2] ?? 'http://lab-02.internal.nanasi-apps.xyz:8088/v1'
const model = process.argv[3] ?? 'irodori-tts-renewa'

const client = createORPCClient(new RPCLink({ url: 'http://127.0.0.1:8790/rpc' }))

const text =
  '最初の文です。次の文です。三つ目の文です。四つ目の文です。五つ目の文です。' +
  'チャンク分割の確認用に、少し長めの文章を入れてあります。'

const started = Date.now()
console.log(`upstream: ${upstream}`)
console.log(`model: ${model}`)
console.log('--- 受信タイムライン')

let total = 0
let first = null
for await (const event of await client.tts.stream({
  upstream: { baseUrl: upstream },
  model,
  input: text,
  voice: 'none',
  responseFormat: 'wav',
  useSse: true,
  irodori: { chunking_enabled: true, chunk_min_chars: 1 },
})) {
  const at = Date.now() - started
  if (event.type === 'chunk') {
    const bytes = Buffer.from(event.audioBase64, 'base64').byteLength
    total += bytes
    first ??= at
    console.log(`+${String(at).padStart(5)}ms  chunk#${event.index}  ${(bytes / 1024).toFixed(1)} KB  "${event.text}"`)
  } else if (event.type === 'done') {
    console.log(`+${String(at).padStart(5)}ms  done (${event.chunks} chunks)`)
  } else {
    console.log(`+${String(at).padStart(5)}ms  error: ${event.message}`)
  }
}

console.log('---')
console.log(`最初のチャンクまで ${first}ms / 合計 ${(total / 1024).toFixed(1)} KB`)

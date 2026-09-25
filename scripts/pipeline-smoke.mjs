/**
 * 文ごとの読み上げを先読みしたとき、待ち時間が重ならないか確認する。
 *
 * 文Aの再生中に文Bの合成を始めておけば、文Aが終わった瞬間に文Bが鳴り始める。
 * lab-02 は同時合成 1 なので、2 本目はサーバー側で順番待ちになる。
 */

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

const upstream = process.argv[2] ?? 'http://lab-02.internal.nanasi-apps.xyz:8088/v1'
const model = process.argv[3] ?? 'irodori-tts-renewa'
const client = createORPCClient(new RPCLink({ url: 'http://127.0.0.1:8790/rpc' }))

const sentences = ['一つ目の文です。', '二つ目の文です。', '三つ目の文です。']
const started = Date.now()
const at = () => String(Date.now() - started).padStart(5)

function open(text, index) {
  const marks = { first: null, done: null }
  const run = (async () => {
    for await (const event of await client.tts.stream({
      upstream: { baseUrl: upstream },
      model,
      input: text,
      voice: 'none',
      responseFormat: 'wav',
      useSse: true,
    })) {
      if (event.type === 'chunk' && marks.first === null) {
        marks.first = Date.now() - started
        console.log(`+${at()}ms  文${index} 最初のチャンク (${(Buffer.from(event.audioBase64, 'base64').byteLength / 1024).toFixed(0)} KB)`)
      }
      if (event.type === 'done') {
        marks.done = Date.now() - started
        console.log(`+${at()}ms  文${index} 生成完了`)
      }
    }
  })()
  return { marks, run }
}

// 先読みあり: 3 文をまとめて投げる
console.log('--- 先読みあり（3 文を同時に投げる）')
const jobs = sentences.map((text, index) => open(text, index + 1))
await Promise.all(jobs.map((job) => job.run))

const firsts = jobs.map((job) => job.marks.first)
console.log('---')
console.log(`各文の最初のチャンク: ${firsts.join('ms, ')}ms`)
console.log('文ごとに間を空けず生成できていれば、最初のチャンクが早い順に並びます。')

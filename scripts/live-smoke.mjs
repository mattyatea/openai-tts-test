// TTS Lab の live 機能を、werift をブラウザ代わりに使って一気通貫で検証する。
// - WebRTC で GPT Live につなぐ
// - サーバーが中継する transcript イベントを表示する

import { writeFileSync } from 'node:fs'
import { RTCPeerConnection } from 'werift'

const BASE = 'http://127.0.0.1:8790/rpc'
const LOG = new URL('./live-smoke.log', import.meta.url).pathname
writeFileSync(LOG, '')
function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.join(' ')}\n`
  writeFileSync(LOG, line, { append: true })
  process.stdout.write(line)
}

async function rpc(path, input) {
  const response = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`)
  const parsed = JSON.parse(text)
  return parsed.json ?? parsed
}

const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
const dc = pc.createDataChannel('oai-events')
dc.onopen = () => {
  log('data channel open')
}
dc.onMessage.subscribe((data) => {
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
  if (text.includes('transcript') || text.includes('audio.delta') === false) {
    log('DC', text.slice(0, 300))
  }
})
pc.connectionStateChange.subscribe((state) => log('pc state', state))
pc.onTrack.subscribe((track) => {
  log('remote track', track.kind ?? '?')
  let count = 0
  track.onRtp?.subscribe(() => {
    count += 1
    if (count === 1 || count % 200 === 0) log('rtp packets', String(count))
  })
})
pc.addTransceiver('audio', { direction: 'sendrecv' })

await pc.setLocalDescription(await pc.createOffer())
await new Promise((resolve) => {
  if (pc.iceGatheringState === 'complete') return resolve()
  const timer = setTimeout(resolve, 6000)
  pc.iceGatheringStateChange.subscribe((state) => {
    if (state === 'complete') {
      clearTimeout(timer)
      resolve()
    }
  })
})

const started = await rpc('live/start', {
  json: {
    sdp: pc.localDescription.sdp,
    version: 'v3',
    voice: 'cove',
    systemPrompt: 'あなたは日本語で話すアシスタントです。短く1文だけ返してください。',
    instructions: '落ち着いた速さではっきり話してください。',
    initialPrompt: 'これから音声で会話します。最初に短く挨拶してください。',
  },
})
log('sessionId', started.sessionId, '| answer bytes', String(started.sdp?.length))

await pc.setRemoteDescription({ type: 'answer', sdp: started.sdp })
log('remote description set')

// SSE をストリームとして読む（await で固まらないようにする）
void (async () => {
  const response = await fetch(`${BASE}/live/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ json: { sessionId: started.sessionId } }),
  })
  log('event stream status', String(response.status), response.headers.get('content-type') ?? '')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index = buffer.indexOf('\n\n')
    while (index >= 0) {
      const block = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      index = buffer.indexOf('\n\n')
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) log('EVENT', line.slice(5).trim().slice(0, 400))
      }
    }
  }
  log('event stream ended')
})()

setTimeout(() => {
  void rpc('live/appendText', { json: { sessionId: started.sessionId, text: 'こんにちは、聞こえますか？' } })
    .then(() => log('appendText sent'))
    .catch((error) => log('appendText failed', String(error).slice(0, 250)))
}, 8000)

setTimeout(async () => {
  await rpc('live/stop', { json: { sessionId: started.sessionId } }).catch(() => {})
  pc.close()
  log('probe finished')
  process.exit(0)
}, 55_000)

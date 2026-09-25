/** Hono + oRPC の API サーバー。本番ではビルド済み SPA も配信する。 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { RPCHandler } from '@orpc/server/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { liveManager } from './live/sessions'
import { router } from './router'
import { APP_VERSION } from './constants'
import { host, port } from './settings'

const here = dirname(fileURLToPath(import.meta.url))
/** dist/server/index.js からも src/server/index.ts からも dist/client を指せるようにする。 */
const clientDir = [
  resolve(here, '../client'),
  resolve(here, '../../dist/client'),
  resolve(process.cwd(), 'dist/client'),
].find((candidate) => existsSync(candidate))

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}

const app = new Hono()

app.use(
  '/rpc/*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Standard-Server', 'Content-Disposition'],
    exposeHeaders: ['Content-Disposition', 'Standard-Server'],
  }),
)

const rpcHandler = new RPCHandler(router, {
  interceptors: [
    async ({ next }) => {
      try {
        return await next()
      } catch (error) {
        console.error('[rpc] handler failed', error)
        throw error
      }
    },
  ],
})

app.use('/rpc/*', async (c, next) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
    context: {},
  })
  if (matched) return c.newResponse(response.body, response)
  await next()
})

app.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    version: APP_VERSION,
    node: process.version,
    clientBuilt: Boolean(clientDir),
  }),
)

app.get('*', async (c) => {
  if (!clientDir) {
    return c.text('クライアントが未ビルドです。`pnpm build` を実行するか、`pnpm dev` で Vite を使ってください。', 503)
  }
  const url = new URL(c.req.url)
  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(clientDir, requested)
  const target = candidate.startsWith(clientDir) && existsSync(candidate) && extname(candidate)
    ? candidate
    : join(clientDir, 'index.html')

  try {
    const body = await readFile(target)
    return c.body(body, 200, {
      'content-type': CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
      'cache-control': extname(target) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    })
  } catch {
    return c.text('Not found', 404)
  }
})

const { serve } = await import('@hono/node-server')
const httpServer = serve({ fetch: app.fetch, hostname: host, port })

console.log(`[tts-lab] API  http://${host}:${port}/rpc`)
if (clientDir) console.log(`[tts-lab] UI   http://${host}:${port}/`)

const shutdown = (): void => {
  console.log('\n[tts-lab] 停止します')
  liveManager.shutdown()
  httpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

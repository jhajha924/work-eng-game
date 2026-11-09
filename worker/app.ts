// D1：所有 /api 路由集中在 createApp；測試直接呼叫 app.request，不必啟動伺服器
import { Hono } from 'hono'
import { authRoutes, requireSession, type Clock } from './auth/routes'
import type { AppEnv } from './env'
import { syncRoutes } from './sync/routes'

export type AppOptions = { now?: Clock }

/** now：目前時間（毫秒），測試時可以換成固定的時鐘 */
export function createApp({ now = Date.now }: AppOptions = {}) {
  const app = new Hono<AppEnv>().basePath('/api')

  app.get('/health', (c) => c.json({ ok: true }))
  app.route('/auth', authRoutes(now))
  app.use('/sync', requireSession(now))
  app.route('/sync', syncRoutes())

  app.notFound((c) => c.json({ error: 'not_found' }, 404))

  return app
}

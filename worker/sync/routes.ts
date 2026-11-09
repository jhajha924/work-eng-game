// POST /api/sync（D8）；登入檢查由 app.ts 的 requireSession 處理
import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { sync } from './syncRepo'
import { parseSyncRequest } from './validate'

export function syncRoutes() {
  const routes = new Hono<AppEnv>()

  routes.post('/', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'invalid_request' }, 400)
    }
    const parsed = parseSyncRequest(body)
    // 任何一筆不合法就整個請求不接受，不寫入任何資料
    if (!parsed.ok) return c.json({ error: 'invalid_request' }, 400)
    return c.json(await sync(c.env.DB, parsed.value))
  })

  return routes
}

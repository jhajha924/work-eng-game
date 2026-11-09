// 登入、登出、查詢登入狀態，以及給其他路由用的登入檢查（D3、D4）
import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from '../env'
import {
  clearFailures, createSession, deleteExpiredSessions, deleteSession, hasValidSession, lockStatus,
  recordFailure, SESSION_MS,
} from './authRepo'
import { verifyPassword } from './password'

export const SESSION_COOKIE = 'weg_session'

/** Cookie 屬性：JavaScript 讀不到、只走 HTTPS、只送往同網站的 /api */
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'Strict', path: '/api' } as const

export type Clock = () => number

async function readPassword(c: Context<AppEnv>): Promise<string | null> {
  try {
    const body: unknown = await c.req.json()
    if (typeof body === 'object' && body !== null && 'password' in body && typeof body.password === 'string') {
      return body.password
    }
  } catch {
    // 不是 JSON
  }
  return null
}

export function authRoutes(now: Clock) {
  const routes = new Hono<AppEnv>()

  routes.post('/login', async (c) => {
    const password = await readPassword(c)
    if (password === null) return c.json({ error: 'invalid_request' }, 400)

    const stored = c.env.APP_PASSWORD_HASH
    if (!stored) return c.json({ error: 'not_configured' }, 500)

    const db = c.env.DB
    const time = now()
    // 鎖定中不檢查密碼，也不再記錄失敗
    const lock = await lockStatus(db, time)
    if (lock.locked) return c.json({ error: 'locked', retryAfterSeconds: lock.retryAfterSeconds }, 429)

    if (!(await verifyPassword(password, stored))) {
      await recordFailure(db, time)
      return c.json({ error: 'wrong_password' }, 401)
    }

    await Promise.all([clearFailures(db), deleteExpiredSessions(db, time)])
    const token = await createSession(db, time)
    setCookie(c, SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_MS / 1000 })
    return c.json({ ok: true })
  })

  routes.post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await deleteSession(c.env.DB, token)
    deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS)
    return c.json({ ok: true })
  })

  routes.get('/session', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    const loggedIn = token ? await hasValidSession(c.env.DB, token, now()) : false
    return c.json({ loggedIn })
  })

  return routes
}

/** 需要登入的路由：沒有有效工作階段就回 401，不執行後面的處理 */
export function requireSession(now: Clock): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (!token || !(await hasValidSession(c.env.DB, token, now()))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    await next()
  }
}

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { hashToken, SESSION_MS } from './auth/authRepo'
import { hashPassword } from './auth/password'
import { createTestD1, type TestD1 } from './testing/sqliteD1'

const PASSWORD = 'correct horse'
let passwordHash = ''
beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
})

/** 可以手動撥動的時鐘 */
let clock = Date.parse('2026-11-03T10:00:00Z')
let db: TestD1
let app: ReturnType<typeof createApp>
let env: { DB: TestD1; APP_PASSWORD_HASH?: string }

beforeEach(() => {
  clock = Date.parse('2026-11-03T10:00:00Z')
  db = createTestD1()
  app = createApp({ now: () => clock })
  env = { DB: db, APP_PASSWORD_HASH: passwordHash }
})

const count = (table: string) => (db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

function login(password: unknown, raw?: string) {
  return app.request(
    '/api/auth/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify({ password }) },
    env,
  )
}

/** 從 Set-Cookie 取出權杖，組成之後請求要帶的 Cookie 標頭 */
function cookieFrom(res: Response): string {
  const match = /weg_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')
  if (!match) throw new Error('沒有 weg_session Cookie')
  return `weg_session=${match[1]}`
}

async function session(cookie?: string) {
  const res = await app.request('/api/auth/session', { headers: cookie ? { Cookie: cookie } : {} }, env)
  return ((await res.json()) as { loggedIn: boolean }).loggedIn
}

describe('Worker 基礎', () => {
  it('GET /api/health', async () => {
    const res = await app.request('/api/health', {}, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('未知的 /api 路徑回 404', async () => {
    const res = await app.request('/api/nope', {}, env)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })
})

describe('D1 打勾紀錄資料表', () => {
  it('在空資料庫套用遷移', () => {
    const names = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name").all() as {
      name: string
    }[]
    expect(names.map((r) => r.name)).toEqual(
      expect.arrayContaining(['task_logs', 'sessions', 'login_failures', 'idx_task_logs_rev']),
    )
  })
})

describe('登入', () => {
  it('登入成功', async () => {
    const res = await login(PASSWORD)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('weg_session=')
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api', 'Max-Age=2592000']) {
      expect(setCookie).toContain(attr)
    }
    expect(count('sessions')).toBe(1)
  })

  it('密碼錯誤', async () => {
    const res = await login('wrong')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'wrong_password' })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(count('login_failures')).toBe(1)
  })

  it.each([
    { name: '沒有 password 欄位', raw: JSON.stringify({ pwd: 'x' }) },
    { name: '不是 JSON', raw: 'password=x' },
    { name: 'password 不是字串', raw: JSON.stringify({ password: 123 }) },
  ])('請求格式錯誤：$name', async ({ raw }) => {
    const res = await login(undefined, raw)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
    expect(count('login_failures')).toBe(0)
  })

  it('沒有設定機密', async () => {
    delete env.APP_PASSWORD_HASH
    const res = await login(PASSWORD)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })
})

describe('登入失敗鎖定', () => {
  async function failFiveTimes() {
    for (let i = 0; i < 5; i++) expect((await login('wrong')).status).toBe(401)
  }

  it('第 6 次被鎖', async () => {
    await failFiveTimes()
    clock += 5 * 60 * 1000
    const res = await login(PASSWORD)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'locked', retryAfterSeconds: 600 })
    expect(count('sessions')).toBe(0)
  })

  it('15 分鐘後解鎖，成功後清空失敗紀錄', async () => {
    await failFiveTimes()
    clock += 16 * 60 * 1000
    expect((await login(PASSWORD)).status).toBe(200)
    expect(count('login_failures')).toBe(0)
  })

  it('失敗次數未滿', async () => {
    for (let i = 0; i < 4; i++) await login('wrong')
    expect((await login(PASSWORD)).status).toBe(200)
  })
})

describe('工作階段與登出', () => {
  it('查詢登入狀態', async () => {
    const cookie = cookieFrom(await login(PASSWORD))
    expect(await session(cookie)).toBe(true)
    expect(await session('weg_session=random')).toBe(false)
    expect(await session()).toBe(false)
    clock += SESSION_MS + 24 * 60 * 60 * 1000 // 31 天後
    expect(await session(cookie)).toBe(false)
  })

  it('資料庫只存雜湊', async () => {
    const cookie = cookieFrom(await login(PASSWORD))
    const token = cookie.split('=')[1]
    const rows = db.sqlite.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[]
    expect(rows).toEqual([{ token_hash: await hashToken(token) }])
  })

  it('登出後失效，並清除 Cookie', async () => {
    const cookie = cookieFrom(await login(PASSWORD))
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } }, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(await session(cookie)).toBe(false)
  })

  it('沒登入也可以登出', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST' }, env)
    expect(res.status).toBe(200)
  })
})

describe('需要登入的 API', () => {
  it('未登入同步', async () => {
    const res = await app.request(
      '/api/sync',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, changes: [] }) },
      env,
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(count('task_logs')).toBe(0)
  })

  it('兩筆合法、一筆不合法時資料表沒有變化', async () => {
    const cookie = cookieFrom(await login(PASSWORD))
    const valid = (key: string) => ({
      id: `2026-11-02:${key}`, date: '2026-11-02', key, xp: 10, isMinimum: false,
      completedAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z', deleted: false,
    })
    const res = await app.request(
      '/api/sync',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ since: 0, changes: [valid('a'), valid('b'), { ...valid('c'), xp: -1 }] }),
      },
      env,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_request' })
    expect(count('task_logs')).toBe(0)
  })

  it('登入後同步成功', async () => {
    const cookie = cookieFrom(await login(PASSWORD))
    const res = await app.request(
      '/api/sync',
      { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ since: 0, changes: [] }) },
      env,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ cursor: 0, changes: [], hasMore: false })
  })
})

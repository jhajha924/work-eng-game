// 以模擬的 fetch 與 fake-indexeddb 測試同步用戶端
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb, type ProgressDb } from '../progress/db'
import { createProgressRepo, type ProgressRepo } from '../progress/progressRepo'
import { createSyncClient } from './syncClient'

const now = new Date('2026-11-02T12:00:00Z')
let db: ProgressDb
let repo: ProgressRepo
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDb(`sync-client-${counter}`)
  await db.open()
  repo = createProgressRepo(db)
})

afterEach(async () => {
  await db.delete()
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** 模擬伺服器：照實回傳收到的紀錄（像真的伺服器把剛寫入的紀錄回傳） */
function echoServer(options: { hasMoreTimes?: number } = {}) {
  let rev = 0
  let hasMoreTimes = options.hasMoreTimes ?? 0
  return vi.fn(async (_path: RequestInfo | URL, init?: RequestInit) => {
    const { changes } = JSON.parse(String(init?.body)) as { changes: unknown[] }
    rev += changes.length
    const hasMore = hasMoreTimes > 0
    hasMoreTimes -= 1
    return json(200, { cursor: rev, changes, hasMore })
  })
}

async function snapshot() {
  return { logs: await db.taskLogs.toArray(), cursor: await repo.getCursor() }
}

describe('同步用戶端的結果', () => {
  it('各種結果；失敗時本機資料不變', async () => {
    await repo.setTaskDone({ id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }, 10, true, now)
    const before = await snapshot()

    const cases = [
      { fetch: vi.fn(async () => json(401, { error: 'unauthorized' })), online: true, expected: 'unauthorized' },
      { fetch: vi.fn(async () => json(500, { error: 'boom' })), online: true, expected: 'error' },
      { fetch: vi.fn(async () => json(200, { nope: true })), online: true, expected: 'error' },
      { fetch: vi.fn(async () => { throw new TypeError('Failed to fetch') }), online: true, expected: 'offline' },
      { fetch: vi.fn(async () => json(200, {})), online: false, expected: 'offline' },
    ]
    for (const c of cases) {
      const client = createSyncClient({ repo: () => repo, fetch: c.fetch as typeof fetch, isOnline: () => c.online })
      expect((await client.syncOnce()).result).toBe(c.expected)
      expect(await snapshot()).toEqual(before)
    }

    const ok = createSyncClient({ repo: () => repo, fetch: echoServer() as typeof fetch, isOnline: () => true })
    expect(await ok.syncOnce()).toEqual({ result: 'synced', received: false })
    expect(await repo.pendingChanges()).toEqual([])
    expect(await repo.getCursor()).toBe(1)
  })

  it('離線時不發請求', async () => {
    const fetch = vi.fn()
    const client = createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => false })
    expect((await client.syncOnce()).result).toBe('offline')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('600 筆分兩批送出', async () => {
    for (let i = 0; i < 600; i++) {
      await repo.setTaskDone({ id: `2026-11-02:k${i}`, date: '2026-11-02', key: `k${i}` }, 10, true, now)
    }
    const fetch = echoServer()
    const client = createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect((await client.syncOnce()).result).toBe('synced')
    const sizes = fetch.mock.calls.map(([, init]) => (JSON.parse(String(init?.body)) as { changes: unknown[] }).changes.length)
    expect(sizes).toEqual([500, 100])
    expect(await repo.pendingChanges()).toEqual([])
  })

  it('hasMore 時以新游標續傳，最多 20 次', async () => {
    const fetch = echoServer({ hasMoreTimes: 2 })
    const client = createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    await client.syncOnce()
    expect(fetch).toHaveBeenCalledTimes(3)

    const endless = vi.fn(async () => json(200, { cursor: 1, changes: [], hasMore: true }))
    const capped = createSyncClient({ repo: () => repo, fetch: endless as typeof globalThis.fetch, isOnline: () => true })
    expect((await capped.syncOnce()).result).toBe('synced')
    expect(endless).toHaveBeenCalledTimes(20)
  })

  it('取回別台裝置的紀錄時 received 為 true', async () => {
    const remote = {
      id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false,
      completedAt: now.toISOString(), updatedAt: now.toISOString(), deleted: false,
    }
    const fetch = vi.fn(async () => json(200, { cursor: 5, changes: [remote], hasMore: false }))
    const client = createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect(await client.syncOnce()).toEqual({ result: 'synced', received: true })
    expect(await repo.listLogs()).toEqual([remote])
  })

  it('請求帶 same-origin 憑證與 JSON 標頭', async () => {
    const fetch = echoServer()
    await createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => true }).syncOnce()
    const [path, init] = fetch.mock.calls[0]
    expect(path).toBe('/api/sync')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  })
})

describe('登入與登入狀態', () => {
  const clientWith = (fetch: unknown, online = true) =>
    createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => online })

  it('登入的四種回應', async () => {
    expect(await clientWith(vi.fn(async () => json(200, { ok: true }))).login('x')).toEqual({ result: 'ok' })
    expect(await clientWith(vi.fn(async () => json(401, { error: 'wrong_password' }))).login('x')).toEqual({
      result: 'wrong_password',
    })
    expect(await clientWith(vi.fn(async () => json(429, { error: 'locked', retryAfterSeconds: 600 }))).login('x')).toEqual({
      result: 'locked', retryAfterSeconds: 600,
    })
    expect(await clientWith(vi.fn(), false).login('x')).toEqual({ result: 'offline' })
    expect(await clientWith(vi.fn(async () => { throw new TypeError('x') })).login('x')).toEqual({ result: 'offline' })
    expect(await clientWith(vi.fn(async () => json(500, {}))).login('x')).toEqual({ result: 'error' })
  })

  it('查詢登入狀態', async () => {
    expect(await clientWith(vi.fn(async () => json(200, { loggedIn: true }))).checkSession()).toBe('logged-in')
    expect(await clientWith(vi.fn(async () => json(200, { loggedIn: false }))).checkSession()).toBe('logged-out')
    expect(await clientWith(vi.fn(), false).checkSession()).toBe('offline')
    expect(await clientWith(vi.fn(async () => json(500, {}))).checkSession()).toBe('error')
  })
})

// 以模擬的 fetch 與 fake-indexeddb 測試同步用戶端
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb, type ProgressDb } from '../progress/db'
import { createCardRepo, type CardRepo } from '../cards/cardRepo'
import { reviewCard } from '../cards/fsrs'
import { createProgressRepo, type ProgressRepo } from '../progress/progressRepo'
import { createSyncClient } from './syncClient'

const now = new Date('2026-11-02T12:00:00Z')
let db: ProgressDb
let repo: ProgressRepo
let cards: CardRepo
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDb(`sync-client-${counter}`)
  await db.open()
  repo = createProgressRepo(db)
  cards = createCardRepo(db)
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
  return vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
    const { changes } = JSON.parse(String(init?.body)) as { changes: unknown[] }
    rev += changes.length
    const hasMore = path === '/api/sync' && hasMoreTimes > 0
    if (path === '/api/sync') hasMoreTimes -= 1
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
      const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: c.fetch as typeof fetch, isOnline: () => c.online })
      expect((await client.syncOnce()).result).toBe(c.expected)
      expect(await snapshot()).toEqual(before)
    }

    const ok = createSyncClient({ repo: () => repo, cards: () => cards, fetch: echoServer() as typeof fetch, isOnline: () => true })
    expect(await ok.syncOnce()).toEqual({ result: 'synced', received: false })
    expect(await repo.pendingChanges()).toEqual([])
    expect(await repo.getCursor()).toBe(1)
  })

  it('離線時不發請求', async () => {
    const fetch = vi.fn()
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => false })
    expect((await client.syncOnce()).result).toBe('offline')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('600 筆分兩批送出', async () => {
    for (let i = 0; i < 600; i++) {
      await repo.setTaskDone({ id: `2026-11-02:k${i}`, date: '2026-11-02', key: `k${i}` }, 10, true, now)
    }
    const fetch = echoServer()
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect((await client.syncOnce()).result).toBe('synced')
    const sizes = fetch.mock.calls
      .filter(([path]) => path === '/api/sync')
      .map(([, init]) => (JSON.parse(String(init?.body)) as { changes: unknown[] }).changes.length)
    expect(sizes).toEqual([500, 100])
    expect(await repo.pendingChanges()).toEqual([])
  })

  it('hasMore 時以新游標續傳，最多 20 次', async () => {
    const fetch = echoServer({ hasMoreTimes: 2 })
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    await client.syncOnce()
    // 打勾紀錄 3 次，再加卡片狀態 1 次
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/sync', '/api/sync', '/api/sync', '/api/sync/cards'])

    const endless = vi.fn(async () => json(200, { cursor: 1, changes: [], hasMore: true }))
    const capped = createSyncClient({ repo: () => repo, cards: () => cards, fetch: endless as typeof globalThis.fetch, isOnline: () => true })
    expect((await capped.syncOnce()).result).toBe('synced')
    // 每種資料各最多 20 次
    const paths = endless.mock.calls.map((call) => (call as unknown[])[0])
    expect(paths.filter((p) => p === '/api/sync')).toHaveLength(20)
    expect(paths.filter((p) => p === '/api/sync/cards')).toHaveLength(20)
  })

  it('取回別台裝置的紀錄時 received 為 true', async () => {
    const remote = {
      id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false,
      completedAt: now.toISOString(), updatedAt: now.toISOString(), deleted: false,
    }
    const fetch = vi.fn(async () => json(200, { cursor: 5, changes: [remote], hasMore: false }))
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect(await client.syncOnce()).toEqual({ result: 'synced', received: true })
    expect(await repo.listLogs()).toEqual([remote])
  })

  it('格式不合伺服器規則的紀錄不送出，也不擋住其他紀錄', async () => {
    await repo.setTaskDone({ id: '2026-11-02:Bad Key', date: '2026-11-02', key: 'Bad Key' }, 10, true, now)
    await repo.setTaskDone({ id: '2026-11-02:too-much', date: '2026-11-02', key: 'too-much' }, 5000, true, now)
    await repo.setTaskDone({ id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }, 10, true, now)
    const fetch = echoServer()
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect((await client.syncOnce()).result).toBe('synced')
    const sent = (JSON.parse(String(fetch.mock.calls[0][1]?.body)) as { changes: { id: string }[] }).changes
    expect(sent.map((r) => r.id)).toEqual(['2026-11-02:new-words'])
    // 不合格的留在本機（仍標記未同步），不會遺失
    expect((await repo.pendingChanges()).map((r) => r.id).sort()).toEqual(['2026-11-02:Bad Key', '2026-11-02:too-much'])
  })

  it('先打勾紀錄、再卡片狀態：兩筆 dirty 都清掉，兩個游標各自更新', async () => {
    await repo.setTaskDone({ id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }, 10, true, now)
    const review = reviewCard('demo:v:meeting', null, 3, now)
    await cards.saveReview(review.state, review.log)
    const fetch = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
      const { changes } = JSON.parse(String(init?.body)) as { changes: unknown[] }
      return json(200, { cursor: path === '/api/sync' ? 3 : 8, changes, hasMore: false })
    })
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect(await client.syncOnce()).toEqual({ result: 'synced', received: false })
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/sync', '/api/sync/cards'])
    expect(await repo.pendingChanges()).toEqual([])
    expect(await cards.pendingChanges()).toEqual([])
    expect(await repo.getCursor()).toBe(3)
    expect(await cards.getCursor()).toBe(8)
  })

  it('打勾紀錄失敗就不同步卡片狀態', async () => {
    const fetch = vi.fn(async () => json(500, { error: 'boom' }))
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect((await client.syncOnce()).result).toBe('error')
    expect(fetch.mock.calls.map((call) => (call as unknown[])[0])).toEqual(['/api/sync'])
  })

  it('只有卡片狀態被伺服器改變時 received 也是 true', async () => {
    const remote = reviewCard('demo:v:meeting', null, 4, now).state
    const fetch = vi.fn(async (path: RequestInfo | URL) =>
      json(200, { cursor: 1, changes: path === '/api/sync/cards' ? [remote] : [], hasMore: false }),
    )
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect(await client.syncOnce()).toEqual({ result: 'synced', received: true })
    expect(await cards.listStates()).toEqual([remote])
  })

  it('格式不合伺服器規則的卡片狀態不送出', async () => {
    const bad = reviewCard('Bad:v:x', null, 3, now)
    const good = reviewCard('demo:v:meeting', null, 3, now)
    await cards.saveReview(bad.state, bad.log)
    await cards.saveReview(good.state, good.log)
    const fetch = echoServer()
    const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    expect((await client.syncOnce()).result).toBe('synced')
    const cardCall = fetch.mock.calls.find(([path]) => path === '/api/sync/cards')
    const sent = (JSON.parse(String(cardCall?.[1]?.body)) as { changes: { id: string }[] }).changes
    expect(sent.map((c) => c.id)).toEqual(['demo:v:meeting'])
    expect((await cards.pendingChanges()).map((c) => c.id)).toEqual(['Bad:v:x'])
  })

  it('請求帶 same-origin 憑證與 JSON 標頭', async () => {
    const fetch = echoServer()
    await createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => true }).syncOnce()
    const [path, init] = fetch.mock.calls[0]
    expect(path).toBe('/api/sync')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  })
})

describe('登入與登入狀態', () => {
  const clientWith = (fetch: unknown, online = true) =>
    createSyncClient({ repo: () => repo, cards: () => cards, fetch: fetch as typeof globalThis.fetch, isOnline: () => online })

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

  it('登出的三種結果', async () => {
    expect(await clientWith(vi.fn(async () => json(200, { ok: true }))).logout()).toBe('ok')
    expect(await clientWith(vi.fn(async () => { throw new TypeError('x') })).logout()).toBe('offline')
    expect(await clientWith(vi.fn(), false).logout()).toBe('offline')
    expect(await clientWith(vi.fn(async () => json(500, {}))).logout()).toBe('error')
  })

  it('查詢登入狀態', async () => {
    expect(await clientWith(vi.fn(async () => json(200, { loggedIn: true }))).checkSession()).toBe('logged-in')
    expect(await clientWith(vi.fn(async () => json(200, { loggedIn: false }))).checkSession()).toBe('logged-out')
    expect(await clientWith(vi.fn(), false).checkSession()).toBe('offline')
    expect(await clientWith(vi.fn(async () => json(500, {}))).checkSession()).toBe('error')
  })
})

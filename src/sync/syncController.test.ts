// 同步控制器：狀態列的狀態變化、登入登出、各種觸發時機（不需 React）
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb, type ProgressDb } from '../progress/db'
import { createProgressRepo, type ProgressRepo } from '../progress/progressRepo'
import type { SyncStatus } from './messages'
import { createSyncClient, type SyncClient, type SyncOutcome } from './syncClient'
import { createSyncController } from './syncController'

/** 假的同步用戶端：syncOnce 依序回傳給定的結果，用完後一律回 synced */
function fakeClient(options: { session?: Awaited<ReturnType<SyncClient['checkSession']>>; outcomes?: SyncOutcome[] } = {}) {
  const outcomes = [...(options.outcomes ?? [])]
  return {
    checkSession: vi.fn(async () => options.session ?? 'logged-in'),
    syncOnce: vi.fn(async (): Promise<SyncOutcome> => outcomes.shift() ?? { result: 'synced', received: false }),
    login: vi.fn(async () => ({ result: 'ok' as const })),
    logout: vi.fn(async () => 'ok' as const),
  }
}

function setup(client: ReturnType<typeof fakeClient>, hasPending = false) {
  const statuses: SyncStatus[] = []
  const onRemoteChange = vi.fn()
  const controller = createSyncController({
    client,
    hasPending: async () => hasPending,
    onStatus: (s) => statuses.push(s),
    onRemoteChange,
    delayMs: 30_000,
  })
  return { controller, statuses, onRemoteChange }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('開啟頁面', () => {
  it('已登入就同步；未登入不同步', async () => {
    const a = setup(fakeClient())
    await a.controller.start()
    expect(a.statuses).toEqual(['syncing', 'synced'])

    const client = fakeClient({ session: 'logged-out' })
    const b = setup(client)
    await b.controller.start()
    expect(b.statuses).toEqual(['logged-out'])
    expect(client.syncOnce).not.toHaveBeenCalled()
  })
})

describe('今日任務頁情境', () => {
  it('離線時打勾：顯示離線，恢復連線後自動同步並顯示已同步', async () => {
    vi.useFakeTimers()
    const client = fakeClient({ outcomes: [{ result: 'synced', received: false }, { result: 'offline', received: false }] })
    const { controller, statuses } = setup(client)
    await controller.start()

    controller.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(statuses.at(-1)).toBe('offline')

    await controller.handleOnline()
    expect(statuses.at(-1)).toBe('synced')
    expect(client.syncOnce).toHaveBeenCalledTimes(3)
  })

  it('工作階段過期：同步收到 401 就顯示未登入，之後的打勾不再同步', async () => {
    vi.useFakeTimers()
    const client = fakeClient({ outcomes: [{ result: 'unauthorized', received: false }] })
    const { controller, statuses } = setup(client)
    await controller.start()
    expect(statuses.at(-1)).toBe('logged-out')

    controller.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(client.syncOnce).toHaveBeenCalledTimes(1)
  })

  it('登入成功後同步：依序顯示同步中、已同步', async () => {
    const client = fakeClient({ session: 'logged-out' })
    const { controller, statuses } = setup(client)
    await controller.start()
    expect(await controller.login('pw')).toEqual({ result: 'ok' })
    expect(statuses).toEqual(['logged-out', 'syncing', 'synced'])
  })

  it('登入失敗時不同步', async () => {
    const client = fakeClient({ session: 'logged-out' })
    client.login.mockResolvedValueOnce({ result: 'wrong_password' } as never)
    const { controller, statuses } = setup(client)
    await controller.start()
    expect(await controller.login('bad')).toEqual({ result: 'wrong_password' })
    expect(statuses).toEqual(['logged-out'])
    expect(client.syncOnce).not.toHaveBeenCalled()
  })

  it('其他裝置的打勾：同步取回紀錄時通知畫面重新讀取', async () => {
    const { controller, onRemoteChange } = setup(fakeClient({ outcomes: [{ result: 'synced', received: true }] }))
    await controller.start()
    expect(onRemoteChange).toHaveBeenCalledTimes(1)
  })

  it('切到背景：有未同步的紀錄才立刻同步', async () => {
    const withPending = fakeClient()
    const a = setup(withPending, true)
    await a.controller.start()
    await a.controller.handleHidden()
    expect(withPending.syncOnce).toHaveBeenCalledTimes(2)

    const nothing = fakeClient()
    const b = setup(nothing, false)
    await b.controller.start()
    await b.controller.handleHidden()
    expect(nothing.syncOnce).toHaveBeenCalledTimes(1)
  })
})

describe('登出', () => {
  it('離線時登出失敗：維持登入狀態並回報原因，之後照常同步', async () => {
    vi.useFakeTimers()
    const client = fakeClient()
    client.logout.mockResolvedValueOnce('offline' as never)
    const { controller, statuses } = setup(client)
    await controller.start()

    expect(await controller.logout()).toBe('offline')
    expect(statuses.at(-1)).toBe('synced')
    controller.notifyLocalChange()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(client.syncOnce).toHaveBeenCalledTimes(2)
  })

  it('登出成功後停止同步', async () => {
    vi.useFakeTimers()
    const client = fakeClient()
    const { controller, statuses } = setup(client)
    await controller.start()
    controller.notifyLocalChange()

    expect(await controller.logout()).toBe('ok')
    expect(statuses.at(-1)).toBe('logged-out')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(client.syncOnce).toHaveBeenCalledTimes(1)
  })
})

describe('登出保留本機紀錄（真的本機資料庫＋同步用戶端）', () => {
  let db: ProgressDb
  let repo: ProgressRepo
  beforeEach(async () => {
    db = createDb('sync-controller-logout')
    await db.open()
    repo = createProgressRepo(db)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('今天兩個任務已勾選，登出後仍是已勾選', async () => {
    const at = new Date('2026-11-10T08:00:00Z')
    await repo.setTaskDone({ id: '2026-11-10:shadowing', date: '2026-11-10', key: 'shadowing' }, 10, true, at)
    await repo.setTaskDone({ id: '2026-11-10:new-words', date: '2026-11-10', key: 'new-words' }, 10, true, at)
    const before = await repo.listLogs()

    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
    const fetch = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
      if (path === '/api/auth/session') return json({ loggedIn: true })
      if (path === '/api/auth/logout') return json({ ok: true })
      const { changes } = JSON.parse(String(init?.body)) as { changes: unknown[] }
      return json({ cursor: changes.length, changes, hasMore: false })
    })
    const client = createSyncClient({ repo: () => repo, fetch: fetch as typeof globalThis.fetch, isOnline: () => true })
    const statuses: SyncStatus[] = []
    const controller = createSyncController({
      client,
      hasPending: async () => (await repo.pendingChanges()).length > 0,
      onStatus: (s) => statuses.push(s),
      onRemoteChange: () => {},
    })
    await controller.start()
    expect(await controller.logout()).toBe('ok')

    expect(statuses.at(-1)).toBe('logged-out')
    expect(await repo.listLogs()).toEqual(before)
    controller.dispose()
  })
})

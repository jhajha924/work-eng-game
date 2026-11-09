// 「取消打勾也會同步」：兩個本機資料庫透過真正的 Worker 程式（D1 用 node:sqlite 替身）互相同步
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../../src/progress/db'
import { createProgressRepo } from '../../src/progress/progressRepo'
import { computeStats } from '../../src/progress/stats'
import { createSyncClient } from '../../src/sync/syncClient'
import { defaultSchedule } from '../../src/app/defaultPlan'
import { createApp } from '../app'
import { hashPassword } from '../auth/password'
import { createTestD1 } from '../testing/sqliteD1'

const PASSWORD = 'correct horse'
const task = { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }

let env: { DB: D1Database; APP_PASSWORD_HASH: string }
beforeAll(async () => {
  env = { DB: createTestD1(), APP_PASSWORD_HASH: await hashPassword(PASSWORD) }
})

/** 一台裝置：自己的 IndexedDB、自己的 Cookie */
async function device(name: string) {
  const db = createDb(name)
  await db.open()
  const repo = createProgressRepo(db)
  const app = createApp()
  let cookie = ''
  const fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (cookie) headers.set('Cookie', cookie)
    const res = await app.request(String(path), { ...init, headers }, env)
    const match = /weg_session=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')
    if (match) cookie = `weg_session=${match[1]}`
    return res
  }) as typeof globalThis.fetch
  const client = createSyncClient({ repo: () => repo, fetch, isOnline: () => true })
  return { db, repo, client }
}

describe('取消打勾也會同步', () => {
  it('兩台裝置', async () => {
    const a = await device('device-a')
    const b = await device('device-b')
    expect((await a.client.login(PASSWORD)).result).toBe('ok')
    expect((await b.client.login(PASSWORD)).result).toBe('ok')

    // A 打勾並同步，B 同步後也有
    await a.repo.setTaskDone(task, 10, true, new Date('2026-11-02T10:00:00Z'))
    expect((await a.client.syncOnce()).result).toBe('synced')
    expect(await b.client.syncOnce()).toEqual({ result: 'synced', received: true })
    const today = '2026-11-02'
    const xpBefore = computeStats(defaultSchedule, await b.repo.listLogs(), today).totalXp
    expect((await b.repo.listLogs()).map((l) => l.id)).toEqual([task.id])

    // A 取消打勾並同步，B 同步後消失、總經驗值少 10
    await a.repo.setTaskDone(task, 10, false, new Date('2026-11-02T10:05:00Z'))
    expect((await a.client.syncOnce()).result).toBe('synced')
    expect(await b.client.syncOnce()).toEqual({ result: 'synced', received: true })
    expect(await b.repo.listLogs()).toEqual([])
    expect(computeStats(defaultSchedule, await b.repo.listLogs(), today).totalXp).toBe(xpBefore - 10)

    await a.db.delete()
    await b.db.delete()
  })
})

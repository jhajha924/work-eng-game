// 「兩台裝置的卡片狀態一致」：兩個本機資料庫透過真正的 Worker 程式（D1 用 node:sqlite 替身）互相同步
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createCardRepo } from '../../src/cards/cardRepo'
import { reviewCard } from '../../src/cards/fsrs'
import { createDb } from '../../src/progress/db'
import { createProgressRepo } from '../../src/progress/progressRepo'
import { createSyncClient } from '../../src/sync/syncClient'
import { createApp } from '../app'
import { hashPassword } from '../auth/password'
import { createTestD1 } from '../testing/sqliteD1'

const PASSWORD = 'correct horse'
const CARD = 'demo:v:meeting'

let env: { DB: D1Database; APP_PASSWORD_HASH: string }
beforeAll(async () => {
  env = { DB: createTestD1(), APP_PASSWORD_HASH: await hashPassword(PASSWORD) }
})

/** 一台裝置：自己的 IndexedDB、自己的 Cookie */
async function device(name: string) {
  const db = createDb(name)
  await db.open()
  const repo = createProgressRepo(db)
  const cards = createCardRepo(db)
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
  const client = createSyncClient({ repo: () => repo, cards: () => cards, fetch, isOnline: () => true })
  return { db, cards, client }
}

describe('兩台裝置的卡片狀態一致', () => {
  it('手機評分、電腦同步：電腦的狀態和手機相同，dirty 為 0', async () => {
    const phone = await device('card-phone')
    const pc = await device('card-pc')
    expect(await phone.client.login(PASSWORD)).toEqual({ result: 'ok' })
    expect(await pc.client.login(PASSWORD)).toEqual({ result: 'ok' })

    const { state, log } = reviewCard(CARD, null, 3, new Date('2026-11-16T09:00:00Z'))
    await phone.cards.saveReview(state, log)
    expect((await phone.client.syncOnce()).result).toBe('synced')

    expect(await pc.client.syncOnce()).toEqual({ result: 'synced', received: true })
    expect(await pc.cards.listStates()).toEqual([state])
    expect((await pc.db.cardStates.get(CARD))?.dirty).toBe(0)

    // 電腦接著評分並同步，手機同步後換成電腦較新的那一次
    const next = reviewCard(CARD, state, 4, new Date('2026-11-16T09:20:00Z'))
    await pc.cards.saveReview(next.state, next.log)
    await pc.client.syncOnce()
    await phone.client.syncOnce()
    expect(await phone.cards.listStates()).toEqual([next.state])

    // 複習紀錄只存各自本機
    expect(await phone.db.reviewLogs.count()).toBe(1)
    expect(await pc.db.reviewLogs.count()).toBe(1)
  })
})

// 卡片狀態的本機儲存（fake-indexeddb 模擬瀏覽器）
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, SYNC_CURSOR_KEY, type ProgressDb } from '../progress/db'
import { CARD_SYNC_CURSOR_KEY, createCardRepo, type CardRepo } from './cardRepo'
import { reviewCard } from './fsrs'

const ID = 'demo:v:meeting'
const now = new Date('2026-11-16T09:00:00Z')

let db: ProgressDb
let repo: CardRepo
let counter = 0

beforeEach(async () => {
  counter += 1
  db = createDb(`card-repo-${counter}`)
  await db.open()
  repo = createCardRepo(db)
})

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
})

describe('從版本 2 升級', () => {
  it('打勾紀錄與游標都還在，cardStates、reviewLogs 為空', async () => {
    const name = `card-upgrade-${counter}`
    const v2 = new Dexie(name)
    v2.version(1).stores({ taskLogs: 'id, date' })
    v2.version(2).stores({ taskLogs: 'id, date, dirty', meta: 'key' })
    await v2.open()
    const log = (id: string) => ({
      id, date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false, completedAt: now.toISOString(),
      updatedAt: now.toISOString(), deleted: false, dirty: 0,
    })
    await v2.table('taskLogs').bulkPut([log('2026-11-02:a'), log('2026-11-02:b')])
    await v2.table('meta').put({ key: SYNC_CURSOR_KEY, value: 7 })
    v2.close()

    const v3 = createDb(name)
    await v3.open()
    expect(v3.verno).toBe(3)
    expect(await v3.taskLogs.count()).toBe(2)
    expect((await v3.meta.get(SYNC_CURSOR_KEY))?.value).toBe(7)
    expect(await v3.cardStates.count()).toBe(0)
    expect(await v3.reviewLogs.count()).toBe(0)
    v3.close()
    await Dexie.delete(name)
  })
})

describe('評分寫入狀態與紀錄', () => {
  it('cardStates 有這張卡（dirty 1），reviewLogs 多一筆 rating 3', async () => {
    const { state, log } = reviewCard(ID, null, 3, now)
    await repo.saveReview(state, log)
    expect(await repo.listStates()).toEqual([state])
    expect((await db.cardStates.get(ID))?.dirty).toBe(1)
    const logs = await db.reviewLogs.where('cardId').equals(ID).toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0].rating).toBe(3)
    expect(await repo.pendingChanges()).toEqual([state])
  })
})

describe('同步結果', () => {
  it('送出的狀態沒再改過：dirty 清掉、存游標', async () => {
    const { state, log } = reviewCard(ID, null, 3, now)
    await repo.saveReview(state, log)
    expect(await repo.applySyncResult([state], [], 4)).toBe(0)
    expect((await db.cardStates.get(ID))?.dirty).toBe(0)
    expect(await repo.getCursor()).toBe(4)
    expect((await db.meta.get(CARD_SYNC_CURSOR_KEY))?.value).toBe(4)
    // 打勾紀錄的游標不受影響
    expect(await db.meta.get(SYNC_CURSOR_KEY)).toBeUndefined()
  })

  it('送出後又評分的卡保持 dirty 1', async () => {
    const first = reviewCard(ID, null, 3, now)
    await repo.saveReview(first.state, first.log)
    const sent = await repo.pendingChanges()
    const second = reviewCard(ID, first.state, 1, new Date(now.getTime() + 60_000))
    await repo.saveReview(second.state, second.log)
    await repo.applySyncResult(sent, [], 1)
    expect(await db.cardStates.get(ID)).toEqual({ ...second.state, dirty: 1 })
  })

  it('伺服器傳來別台裝置的狀態：寫入並計入變更', async () => {
    const remote = reviewCard(ID, null, 4, now).state
    expect(await repo.applySyncResult([], [remote], 2)).toBe(1)
    expect(await db.cardStates.get(ID)).toEqual({ ...remote, dirty: 0 })
    // 再收到一次相同的不算變更
    expect(await repo.applySyncResult([], [remote], 2)).toBe(0)
  })

  it('本機有較新的未同步評分時保留本機', async () => {
    const remote = reviewCard(ID, null, 4, now).state
    const local = reviewCard(ID, null, 1, new Date(now.getTime() + 60_000))
    await repo.saveReview(local.state, local.log)
    expect(await repo.applySyncResult([], [remote], 2)).toBe(0)
    expect((await db.cardStates.get(ID))?.updatedAt).toBe(local.state.updatedAt)
  })
})

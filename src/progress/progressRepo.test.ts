// 在 Node 上用 fake-indexeddb 模擬瀏覽器的 IndexedDB
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type ProgressDb } from './db'
import { createProgressRepo, type ProgressRepo } from './progressRepo'
import type { TaskLog } from './types'

const now = new Date('2026-11-02T12:00:00Z')
const stamp = now.toISOString()
const task = { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }
const doneLog: TaskLog = {
  id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false,
  completedAt: stamp, updatedAt: stamp, deleted: false,
}

let db: ProgressDb
let repo: ProgressRepo
let counter = 0

function newDbName(): string {
  counter += 1
  return `test-${counter}`
}

beforeEach(async () => {
  // 每個測試用全新的資料庫，互不影響
  db = createDb(newDbName())
  await db.open()
  repo = createProgressRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('打勾紀錄存在本機', () => {
  it('打勾後重新讀取', async () => {
    await repo.setTaskDone(task, 10, true, now)
    // 用新的連線讀，模擬重新整理頁面；讀完關閉，測試結束刪除資料庫時才不會被這條連線擋住
    const reopenedDb = createDb(db.name)
    const logs = await createProgressRepo(reopenedDb).listLogs()
    reopenedDb.close()
    expect(logs).toEqual([doneLog])
  })

  it('重複打勾不會產生兩筆', async () => {
    await repo.setTaskDone(task, 10, true, now)
    await repo.setTaskDone(task, 10, true, now)
    expect(await db.taskLogs.count()).toBe(1)
  })

  it('打勾後等待同步', async () => {
    await repo.setTaskDone(task, 10, true, now)
    expect(await repo.pendingChanges()).toEqual([doneLog])
    expect((await db.taskLogs.get(task.id))?.dirty).toBe(1)
  })
})

describe('取消打勾', () => {
  const later = new Date('2026-11-02T12:00:20Z')

  it('取消後紀錄消失', async () => {
    await repo.setTaskDone(task, 10, true, now)
    await repo.setTaskDone(task, 10, false, later)
    expect(await repo.listLogs()).toEqual([])
  })

  it('取消後留下墓碑', async () => {
    await repo.setTaskDone(task, 10, true, now)
    await repo.setTaskDone(task, 10, false, later)
    expect(await repo.pendingChanges()).toEqual([{ ...doneLog, deleted: true, updatedAt: later.toISOString() }])
    expect((await db.taskLogs.get(task.id))?.dirty).toBe(1)
  })

  it('取消後再打勾', async () => {
    await repo.setTaskDone(task, 10, true, now)
    await repo.setTaskDone(task, 10, false, later)
    await repo.setTaskDone(task, 10, true, new Date('2026-11-02T12:01:00Z'))
    expect(await repo.listLogs()).toHaveLength(1)
    expect(await db.taskLogs.count()).toBe(1)
    expect((await db.taskLogs.get(task.id))?.deleted).toBe(false)
  })

  it('沒有紀錄時取消不做任何事', async () => {
    await repo.setTaskDone(task, 10, false, now)
    expect(await db.taskLogs.count()).toBe(0)
  })
})

describe('最低限度日', () => {
  it('標記與取消最低限度日', async () => {
    await repo.setMinimumDay('2026-11-03', true, now)
    expect(await repo.listLogs()).toEqual([
      { id: '2026-11-03:minimum', date: '2026-11-03', key: 'minimum', xp: 5, isMinimum: true, completedAt: stamp, updatedAt: stamp, deleted: false },
    ])
    await repo.setMinimumDay('2026-11-03', false, now)
    expect(await repo.listLogs()).toEqual([])
  })
})

describe('本機資料庫升級到版本 2', () => {
  it('版本 1 的紀錄升級後保留', async () => {
    const name = newDbName()
    const v1 = new Dexie(name)
    v1.version(1).stores({ taskLogs: 'id, date' })
    const old = [
      { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false, completedAt: '2026-11-02T01:00:00.000Z' },
      { id: '2026-11-02:minimum', date: '2026-11-02', key: 'minimum', xp: 5, isMinimum: true, completedAt: '2026-11-02T02:00:00.000Z' },
    ]
    await v1.table('taskLogs').bulkAdd(old)
    v1.close()

    const v2 = createDb(name)
    const upgraded = createProgressRepo(v2)
    const logs = await upgraded.listLogs()
    // 讀出來依主鍵排序，所以用 arrayContaining 比較內容，不比較順序
    expect(logs).toHaveLength(2)
    expect(logs).toEqual(expect.arrayContaining(old.map((l) => ({ ...l, updatedAt: l.completedAt, deleted: false }))))
    expect(await upgraded.pendingChanges()).toHaveLength(2)
    expect(await upgraded.getCursor()).toBe(0)
    await v2.delete()
  })
})

describe('送出後清除未同步標記', () => {
  it('送出的紀錄沒再改過：dirty 清掉、存游標', async () => {
    await repo.setTaskDone(task, 10, true, now)
    const sent = await repo.pendingChanges()
    const changed = await repo.applySyncResult(sent, sent, 1)
    expect(changed).toBe(0) // 伺服器回傳的是自己剛送的，本機內容沒變
    expect(await repo.pendingChanges()).toEqual([])
    expect(await repo.getCursor()).toBe(1)
  })

  it('送出期間又打勾', async () => {
    await repo.setTaskDone(task, 10, true, new Date('2026-11-02T10:00:00Z'))
    const sent = await repo.pendingChanges()
    // 回應回來前使用者取消打勾
    await repo.setTaskDone(task, 10, false, new Date('2026-11-02T10:00:20Z'))
    await repo.applySyncResult(sent, sent, 1)
    const stored = await db.taskLogs.get(task.id)
    expect(stored).toMatchObject({ dirty: 1, deleted: true, updatedAt: '2026-11-02T10:00:20.000Z' })
  })

  it('伺服器傳來別台裝置的紀錄：寫入並計入變更', async () => {
    const changed = await repo.applySyncResult([], [doneLog], 3)
    expect(changed).toBe(1)
    expect(await repo.listLogs()).toEqual([doneLog])
    expect(await repo.pendingChanges()).toEqual([])
  })
})

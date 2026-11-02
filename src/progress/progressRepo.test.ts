// 在 Node 上用 fake-indexeddb 模擬瀏覽器的 IndexedDB
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type ProgressDb } from './db'
import { createProgressRepo, type ProgressRepo } from './progressRepo'

const now = new Date('2026-11-02T12:00:00Z')
const task = { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }

let db: ProgressDb
let repo: ProgressRepo
let counter = 0

beforeEach(async () => {
  // 每個測試用全新的資料庫，互不影響
  counter += 1
  db = createDb(`test-${counter}`)
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
    expect(logs).toEqual([
      { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false, completedAt: now.toISOString() },
    ])
  })

  it('重複打勾不會產生兩筆', async () => {
    await repo.setTaskDone(task, 10, true, now)
    await repo.setTaskDone(task, 10, true, now)
    expect(await repo.listLogs()).toHaveLength(1)
  })
})

describe('取消打勾', () => {
  it('取消後紀錄消失', async () => {
    await repo.setTaskDone(task, 10, true, now)
    await repo.setTaskDone(task, 10, false, now)
    expect(await repo.listLogs()).toEqual([])
  })
})

describe('最低限度日', () => {
  it('標記與取消最低限度日', async () => {
    await repo.setMinimumDay('2026-11-03', true, now)
    expect(await repo.listLogs()).toEqual([
      { id: '2026-11-03:minimum', date: '2026-11-03', key: 'minimum', xp: 5, isMinimum: true, completedAt: now.toISOString() },
    ])
    await repo.setMinimumDay('2026-11-03', false, now)
    expect(await repo.listLogs()).toEqual([])
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestD1, type TestD1 } from '../testing/sqliteD1'
import { sync } from './syncRepo'
import type { SyncRecord } from './validate'

const record = (overrides: Partial<SyncRecord> = {}): SyncRecord => ({
  id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false,
  completedAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z', deleted: false,
  ...overrides,
})
const at = (time: string) => `2026-11-02T${time}:00.000Z`
const many = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => record({ id: `2026-11-02:k${from + i}`, key: `k${from + i}` }))

let db: TestD1
const row = (id: string) =>
  db.sqlite.prepare('SELECT updated_at, deleted, rev FROM task_logs WHERE id = ?').get(id) as {
    updated_at: string
    deleted: number
    rev: number
  }

beforeEach(() => {
  db = createTestD1()
})

describe('伺服器端合併：較新者為準', () => {
  // 規格 Example「伺服器合併」：資料表已有 10:00、deleted false
  it.each([
    { sent: '10:05', updated: true },
    { sent: '10:00', updated: false },
    { sent: '09:55', updated: false },
  ])('送來 $sent、deleted true', async ({ sent, updated }) => {
    await sync(db, { since: 0, changes: [record({ updatedAt: at('10:00') })] })
    const before = row('2026-11-02:new-words')
    await sync(db, { since: 0, changes: [record({ updatedAt: at(sent), deleted: true })] })
    const after = row('2026-11-02:new-words')
    if (updated) {
      expect(after).toEqual({ updated_at: at(sent), deleted: 1, rev: before.rev + 1 })
    } else {
      expect(after).toEqual(before)
    }
  })

  it('新紀錄：最大 rev 為 7 時，兩筆新紀錄得到 8 和 9', async () => {
    await sync(db, { since: 0, changes: many(1, 7) })
    const result = await sync(db, { since: 7, changes: many(8, 9) })
    expect(result.changes.map((r) => r.key)).toEqual(['k8', 'k9'])
    expect(row('2026-11-02:k8').rev).toBe(8)
    expect(row('2026-11-02:k9').rev).toBe(9)
    expect(result.cursor).toBe(9)
  })
})

describe('取回變更與游標', () => {
  it('分頁取回', async () => {
    // 一次最多送 500 筆，分三次放進 1200 筆
    await sync(db, { since: 0, changes: many(1, 500) })
    await sync(db, { since: 0, changes: many(501, 1000) })
    await sync(db, { since: 0, changes: many(1001, 1200) })

    const pages = []
    let cursor = 0
    for (let i = 0; i < 3; i++) {
      const result = await sync(db, { since: cursor, changes: [] })
      pages.push({ count: result.changes.length, cursor: result.cursor, hasMore: result.hasMore })
      cursor = result.cursor
    }
    expect(pages).toEqual([
      { count: 500, cursor: 500, hasMore: true },
      { count: 500, cursor: 1000, hasMore: true },
      { count: 200, cursor: 1200, hasMore: false },
    ])
  })

  it('游標超過伺服器：整份重新給', async () => {
    await sync(db, { since: 0, changes: many(1, 3) })
    const result = await sync(db, { since: 50, changes: [] })
    expect(result.changes).toHaveLength(3)
    expect(result.cursor).toBe(3)
  })

  it('沒有新紀錄時游標不變，回傳的紀錄欄位與送出時相同', async () => {
    const sent = record({ isMinimum: true, deleted: true })
    const first = await sync(db, { since: 0, changes: [sent] })
    expect(first.changes).toEqual([sent])
    expect(await sync(db, { since: first.cursor, changes: [] })).toEqual({ cursor: first.cursor, changes: [], hasMore: false })
  })
})

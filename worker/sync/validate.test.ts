import { describe, expect, it } from 'vitest'
import { parseSyncRequest, type SyncRecord } from './validate'

const validRecord: SyncRecord = {
  id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false,
  completedAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z', deleted: false,
}
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...validRecord, id: `2026-11-02:k${i}`, key: `k${i}` }))

describe('同步請求格式與檢查', () => {
  // 規格 Example「請求檢查」
  it.each([
    { name: 'since 0、changes 空陣列', body: { since: 0, changes: [] }, ok: true },
    { name: 'since -1', body: { since: -1, changes: [] }, ok: false },
    { name: 'since 1.5', body: { since: 1.5, changes: [] }, ok: false },
    { name: 'changes 501 筆合法紀錄', body: { since: 0, changes: many(501) }, ok: false },
    { name: 'id 日期和 date 不同', body: { since: 0, changes: [{ ...validRecord, date: '2026-11-03' }] }, ok: false },
    { name: 'xp 為字串', body: { since: 0, changes: [{ ...validRecord, xp: '10' }] }, ok: false },
    { name: 'updatedAt 為 yesterday', body: { since: 0, changes: [{ ...validRecord, updatedAt: 'yesterday' }] }, ok: false },
    { name: '兩筆合法、一筆不合法', body: { since: 0, changes: [...many(2), { ...validRecord, xp: -1 }] }, ok: false },
  ])('$name', ({ body, ok }) => {
    expect(parseSyncRequest(body).ok).toBe(ok)
  })

  it('500 筆合法紀錄可以接受', () => {
    expect(parseSyncRequest({ since: 0, changes: many(500) }).ok).toBe(true)
  })

  it('其他不合法的情況', () => {
    for (const body of [
      null, [], { since: 0 }, { since: '0', changes: [] },
      { since: 0, changes: [{ ...validRecord, key: 'New_Words', id: '2026-11-02:New_Words' }] },
      { since: 0, changes: [{ ...validRecord, xp: 1001 }] },
      { since: 0, changes: [{ ...validRecord, deleted: 'false' }] },
      { since: 0, changes: [{ ...validRecord, completedAt: '2026-11-02' }] },
    ]) {
      expect(parseSyncRequest(body).ok).toBe(false)
    }
  })

  it('只保留已知欄位', () => {
    const result = parseSyncRequest({ since: 3, changes: [{ ...validRecord, extra: 'x' }] })
    expect(result).toEqual({ ok: true, value: { since: 3, changes: [validRecord] } })
  })

  it('時間統一成 UTC', () => {
    const result = parseSyncRequest({ since: 0, changes: [{ ...validRecord, updatedAt: '2026-11-02T18:00:00+08:00' }] })
    expect(result.ok && result.value.changes[0].updatedAt).toBe('2026-11-02T10:00:00.000Z')
  })
})

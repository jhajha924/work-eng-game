import { beforeEach, describe, expect, it } from 'vitest'
import type { CardState } from '../../src/cards/types'
import { createTestD1, type TestD1 } from '../testing/sqliteD1'
import { syncCards } from './cardSyncRepo'

const at = (time: string) => `2026-11-16T${time}:00.000Z`
const state = (overrides: Partial<CardState> = {}): CardState => ({
  id: 'demo:v:meeting', due: at('10:10'), stability: 3.2, difficulty: 5.1, elapsedDays: 0, scheduledDays: 0,
  learningSteps: 1, reps: 1, lapses: 0, state: 1, lastReview: at('10:00'), introducedOn: '2026-11-16',
  updatedAt: at('10:00'), ...overrides,
})

let db: TestD1
const row = (id: string) =>
  db.sqlite.prepare('SELECT updated_at, rev FROM card_states WHERE id = ?').get(id) as { updated_at: string; rev: number }

beforeEach(() => {
  db = createTestD1()
})

describe('卡片狀態同步', () => {
  it('送出並取回：回應包含這筆，cursor 為 1', async () => {
    const s = state()
    expect(await syncCards(db, { since: 0, changes: [s] })).toEqual({ cursor: 1, changes: [s], hasMore: false })
  })

  it('舊狀態不覆蓋新狀態：保留 10:05，rev 不變', async () => {
    await syncCards(db, { since: 0, changes: [state({ updatedAt: at('10:05'), reps: 2 })] })
    const before = row('demo:v:meeting')
    const res = await syncCards(db, { since: 1, changes: [state({ updatedAt: at('10:00') })] })
    expect(row('demo:v:meeting')).toEqual(before)
    expect(before.updated_at).toBe(at('10:05'))
    expect(res).toEqual({ cursor: 1, changes: [], hasMore: false })
  })

  it('較新的狀態覆蓋並給新的 rev', async () => {
    await syncCards(db, { since: 0, changes: [state()] })
    const res = await syncCards(db, { since: 1, changes: [state({ updatedAt: at('10:05'), reps: 2 })] })
    expect(row('demo:v:meeting')).toEqual({ updated_at: at('10:05'), rev: 2 })
    expect(res.changes).toEqual([state({ updatedAt: at('10:05'), reps: 2 })])
  })

  it('分頁：每頁 500 筆，hasMore 與游標', async () => {
    const many = Array.from({ length: 501 }, (_, i) => state({ id: `demo:v:w${i}` }))
    await syncCards(db, { since: 0, changes: many.slice(0, 500) })
    await syncCards(db, { since: 0, changes: many.slice(500) })
    const first = await syncCards(db, { since: 0, changes: [] })
    expect(first.changes).toHaveLength(500)
    expect(first.hasMore).toBe(true)
    const second = await syncCards(db, { since: first.cursor, changes: [] })
    expect(second).toEqual({ cursor: 501, changes: [many[500]], hasMore: false })
  })

  it('since 大於最大 rev 時從 0 開始', async () => {
    await syncCards(db, { since: 0, changes: [state()] })
    expect((await syncCards(db, { since: 99, changes: [] })).changes).toHaveLength(1)
  })
})

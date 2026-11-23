import { describe, expect, it } from 'vitest'
import type { CardState } from '../../src/cards/types'
import { isValidCardState, parseCardSyncRequest } from './validate'

const valid: CardState = {
  id: 'demo:v:meeting', due: '2026-11-17T09:00:00.000Z', stability: 3.2, difficulty: 5.1, elapsedDays: 0,
  scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: 2, lastReview: '2026-11-16T09:00:00.000Z',
  introducedOn: '2026-11-16', updatedAt: '2026-11-16T09:00:00.000Z',
}
const one = (overrides: Record<string, unknown>) => ({ since: 0, changes: [{ ...valid, ...overrides }] })

describe('卡片狀態同步 API 的請求檢查', () => {
  // 規格 Example「卡片狀態檢查」
  it.each([
    { name: 'id 為 demo:x:meeting', body: one({ id: 'demo:x:meeting' }), ok: false },
    { name: 'id 為 Demo:v:meeting', body: one({ id: 'Demo:v:meeting' }), ok: false },
    { name: 'due 不是 ISO 時間', body: one({ due: 'tomorrow' }), ok: false },
    { name: 'lastReview 為 null', body: one({ lastReview: null }), ok: true },
    { name: 'introducedOn 為 2026/11/16', body: one({ introducedOn: '2026/11/16' }), ok: false },
    { name: 'reps 為 -1', body: one({ reps: -1 }), ok: false },
    { name: 'stability 為字串', body: one({ stability: '3' }), ok: false },
    {
      name: 'changes 有 501 筆',
      body: { since: 0, changes: Array.from({ length: 501 }, (_, i) => ({ ...valid, id: `demo:v:w${i}` })) },
      ok: false,
    },
  ])('$name', ({ body, ok }) => {
    expect(parseCardSyncRequest(body).ok).toBe(ok)
  })

  it('合法的請求：時間統一成 toISOString，只留已知欄位', () => {
    const result = parseCardSyncRequest(one({ updatedAt: '2026-11-16T17:00:00+08:00', extra: 'x' }))
    expect(result).toEqual({ ok: true, value: { since: 0, changes: [{ ...valid, updatedAt: '2026-11-16T09:00:00.000Z' }] } })
  })

  it('其他不合法的情況', () => {
    for (const body of [
      null,
      { since: -1, changes: [] },
      { since: 0, changes: {} },
      one({ state: 7 }),
      one({ state: 1.5 }),
      one({ lapses: 0.5 }),
      one({ difficulty: Number.POSITIVE_INFINITY }),
      one({ lastReview: 'x' }),
      one({ id: 'demo:v:' }),
    ]) {
      expect(parseCardSyncRequest(body).ok, JSON.stringify(body)).toBe(false)
    }
  })

  it('單筆檢查給前端過濾用', () => {
    expect(isValidCardState(valid)).toBe(true)
    expect(isValidCardState({ ...valid, state: 7 })).toBe(false)
  })
})

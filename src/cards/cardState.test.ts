import { describe, expect, it } from 'vitest'
import { cardFields, keepNewerStates, toCardState } from './cardState'
import type { CardState } from './types'

const at = (time: string) => `2026-11-16T${time}:00.000Z`
const state = (id: string, time: string, reps = 1): CardState => ({
  id, due: at('10:10'), stability: 3.2, difficulty: 5.1, elapsedDays: 0, scheduledDays: 0, learningSteps: 1,
  reps, lapses: 0, state: 1, lastReview: at('10:00'), introducedOn: '2026-11-16', updatedAt: at(time),
})

describe('卡片狀態的欄位', () => {
  it('toCardState 去掉 dirty，欄位順序固定', () => {
    const s = state('demo:v:a', '10:00')
    const stored = { dirty: 1 as const, ...s }
    expect(toCardState(stored)).toEqual(s)
    expect(Object.keys(toCardState(stored))).toEqual(Object.keys(s))
  })

  it('cardFields 只留 id 與 updatedAt 以外的欄位', () => {
    const fields = cardFields(state('demo:v:a', '10:00'))
    expect(fields).not.toHaveProperty('id')
    expect(fields).not.toHaveProperty('updatedAt')
    expect(Object.keys(fields)).toHaveLength(11)
  })
})

describe('重新讀取時保留較新的狀態', () => {
  it('讀取開始後才評分的卡：保留畫面上較新的那份', () => {
    const rated = state('demo:v:a', '10:05', 2)
    const stale = state('demo:v:a', '10:00', 1)
    expect(keepNewerStates([rated], [stale])).toEqual([rated])
  })

  it('其他裝置同步來的較新狀態與新卡片都會採用', () => {
    const mine = state('demo:v:a', '10:00')
    const remote = state('demo:v:a', '10:06', 3)
    const other = state('demo:v:b', '10:01')
    expect(keepNewerStates([mine], [remote, other])).toEqual([remote, other])
  })
})

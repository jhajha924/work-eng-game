import { describe, expect, it } from 'vitest'
import { makeLevel, makePack } from '../plan/testFixtures'
import type { ContentPack, ScheduledWeek } from '../plan/types'
import type { TodayView } from '../progress/today'
import { buildQueue, todayEntryLabel, weekCategoryFor } from './queue'
import type { Card, CardPhase, CardState } from './types'

const NOW = new Date('2026-11-16T09:00:00Z')
const TODAY = '2026-11-16'
const HOUR = 3_600_000

const card = (id: string, group = 'A 會議流程', kind: Card['kind'] = 'word'): Card => ({ id, kind, en: id, zh: id, group })

function state(id: string, due: Date, phase: CardPhase = 2, introducedOn = '2026-11-01'): CardState {
  return {
    id, due: due.toISOString(), stability: 3, difficulty: 5, elapsedDays: 1, scheduledDays: 3, learningSteps: 0,
    reps: 2, lapses: 0, state: phase, lastReview: '2026-11-10T09:00:00.000Z', introducedOn, updatedAt: '2026-11-10T09:00:00.000Z',
  }
}

const options = { now: NOW, today: TODAY, weekCategory: null, newLimit: 15 }
const ids = (cards: Card[]) => cards.map((c) => c.id)

describe('每日複習佇列', () => {
  it('到期卡在前、新卡在後；未到期的不在佇列中', () => {
    const deck = [card('due'), card('later'), card('n1'), card('n2'), card('n3')]
    const states = [state('due', new Date(NOW.getTime() - 24 * HOUR)), state('later', new Date(NOW.getTime() + 24 * HOUR))]
    expect(ids(buildQueue(deck, states, options))).toEqual(['due', 'n1', 'n2', 'n3'])
  })

  it('到期卡依 due 由早到晚', () => {
    const deck = [card('b'), card('a')]
    const states = [state('b', new Date(NOW.getTime() - HOUR)), state('a', new Date(NOW.getTime() - 2 * HOUR))]
    expect(ids(buildQueue(deck, states, options))).toEqual(['a', 'b'])
  })

  it('每天新卡上限：今天已學 12 張，只剩 3 張新卡', () => {
    const introduced = Array.from({ length: 12 }, (_, i) => `t${i}`)
    const fresh = Array.from({ length: 10 }, (_, i) => `n${i}`)
    const deck = [...introduced, ...fresh].map((id) => card(id))
    const states = introduced.map((id) => state(id, new Date(NOW.getTime() + 24 * HOUR), 2, TODAY))
    expect(ids(buildQueue(deck, states, options))).toEqual(['n0', 'n1', 'n2'])
  })

  it('今天已學超過上限時沒有新卡', () => {
    const deck = [card('x'), card('n')]
    const states = [state('x', new Date(NOW.getTime() + HOUR), 2, TODAY)]
    expect(ids(buildQueue(deck, states, { ...options, newLimit: 1 }))).toEqual([])
  })

  it('本週類別的新卡優先', () => {
    const deck = [card('v1', '新手村 30 字'), card('v2', '新手村 30 字'), card('a1'), card('a2')]
    expect(ids(buildQueue(deck, [], { ...options, weekCategory: 'A 會議流程' }))).toEqual(['a1', 'a2', 'v1', 'v2'])
  })

  it('本週類別只優先單字卡，句型照牌組順序', () => {
    const deck = [card('w', 'B'), card('p', 'A 會議流程', 'pattern'), card('a', 'A 會議流程')]
    expect(ids(buildQueue(deck, [], { ...options, weekCategory: 'A 會議流程' }))).toEqual(['a', 'w', 'p'])
  })

  it('剛評「重來」的卡會在 20 分鐘內回來：排在到期卡之後、新卡之前', () => {
    const deck = [card('learning'), card('due'), card('soon-review'), card('far'), card('n')]
    const states = [
      state('learning', new Date(NOW.getTime() + 10 * 60_000), 1),
      state('due', new Date(NOW.getTime() - HOUR)),
      // 複習階段的卡就算 20 分鐘內到期也不提前
      state('soon-review', new Date(NOW.getTime() + 10 * 60_000), 2),
      state('far', new Date(NOW.getTime() + 30 * 60_000), 3),
    ]
    expect(ids(buildQueue(deck, states, options))).toEqual(['due', 'learning', 'n'])
  })

  it('對應不到牌組的狀態會被忽略', () => {
    const deck = [card('n')]
    const states = [state('gone', new Date(NOW.getTime() - HOUR), 2, TODAY)]
    expect(ids(buildQueue(deck, states, options))).toEqual(['n'])
  })
})

describe('本週類別', () => {
  const pack: ContentPack = {
    ...makePack('demo', [makeLevel('L1', 2, 2)]),
    vocab: [
      { category: '新手村 30 字', words: [{ en: 'meeting', zh: '會議' }] },
      { category: 'A 會議流程', words: [{ en: 'agenda', zh: '議程' }] },
    ],
  }
  const week = (vocabCategory: string): ScheduledWeek => ({
    index: 1, startDate: '2026-11-16', packId: 'demo', levelId: 'L1', levelWeek: 1, isBoss: false,
    themes: [{ title: '主題', focus: '', vocabCategory }, { title: '第二', focus: '', vocabCategory: '其他' }],
  })
  const active = (w: ScheduledWeek | null, noviceIndex: number | null): TodayView => ({
    status: 'active', day: { date: TODAY, kind: w ? 'main' : 'novice', weekIndex: w ? 1 : null, tasks: [], isLight: false },
    dayNumber: 1, week: w, levelName: null, noviceIndex,
  })

  // 規格 Example「本週類別」
  it.each<[string, TodayView, string | null]>([
    ['A 會議流程', active(week('A 會議流程'), null), 'A 會議流程'],
    ['A 會議流程（進階）', active(week('A 會議流程（進階）'), null), 'A 會議流程'],
    ['複習 A、B、F', active(week('複習 A、B、F'), null), null],
    ['新手村期間', active(null, 1), '新手村 30 字'],
  ])('%s', (_name, view, expected) => {
    expect(weekCategoryFor(pack, view)).toBe(expected)
  })

  it('不是進行中的日子、或內容包沒有單字時為 null', () => {
    expect(weekCategoryFor(pack, { status: 'rest' })).toBeNull()
    expect(weekCategoryFor({ ...pack, vocab: undefined }, active(null, 1))).toBeNull()
  })
})

describe('單字卡入口', () => {
  it.each<[number, number, string | null]>([
    [18, 100, '複習單字卡（今天 18 張）'],
    [0, 100, '複習單字卡（今天已完成）'],
    [0, 0, null],
  ])('佇列 %i 張、牌組 %i 張', (queueLength, deckSize, label) => {
    expect(todayEntryLabel(queueLength, deckSize)).toBe(label)
  })
})

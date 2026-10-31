import { describe, expect, it } from 'vitest'
import sample from '../../content/packs/meeting-a2-b1-sample/pack.json'
import { buildSchedule } from './buildSchedule'
import { addDays } from './dates'
import { codeOf, makeLevel, makePack } from './testFixtures'
import type { ContentPack, PlanSettings } from './types'

const pack = sample as ContentPack

const settings = (over: Partial<PlanSettings> = {}): PlanSettings => ({
  startDate: '2026-11-02',
  length: { months: 6 },
  includeNovice: true,
  lightRanges: [],
  ...over,
})

const dayOf = (s: ReturnType<typeof buildSchedule>, date: string) => s.days.find((d) => d.date === date)

describe('計畫長度換算', () => {
  // 規格 Example「長度換算」
  it.each<{ name: string; length: PlanSettings['length']; weeks: number; endDate: string }>([
    { name: '6 個月', length: { months: 6 }, weeks: 26, endDate: '2027-05-02' },
    { name: '9 個月', length: { months: 9 }, weeks: 39, endDate: '2027-08-01' },
    { name: '12 個月', length: { months: 12 }, weeks: 52, endDate: '2027-10-31' },
    { name: '結束日 2027-04-28', length: { endDate: '2027-04-28' }, weeks: 25, endDate: '2027-04-25' },
  ])('$name → $weeks 週，結束日 $endDate', ({ length, weeks, endDate }) => {
    const s = buildSchedule([pack], settings({ length }))
    expect(s.totalWeeks).toBe(weeks)
    expect(s.weeks).toHaveLength(weeks)
    expect(s.endDate).toBe(endDate)
  })

  it('結束日 2026-10-30 → END_BEFORE_START', () => {
    expect(codeOf(() => buildSchedule([pack], settings({ length: { endDate: '2026-10-30' } })))).toBe('END_BEFORE_START')
  })

  it('非法日期 → INVALID_DATE', () => {
    expect(codeOf(() => buildSchedule([pack], settings({ startDate: '2026-02-30' })))).toBe('INVALID_DATE')
    expect(codeOf(() => buildSchedule([pack], settings({ length: { endDate: '2027/05/02' } })))).toBe('INVALID_DATE')
  })

  it('沒有內容包 → NO_PACKS', () => {
    expect(codeOf(() => buildSchedule([], settings()))).toBe('NO_PACKS')
  })
})

describe('開始日必須是星期一', () => {
  it('開始日 2026-11-04（星期三）→ START_NOT_MONDAY', () => {
    expect(codeOf(() => buildSchedule([pack], settings({ startDate: '2026-11-04' })))).toBe('START_NOT_MONDAY')
  })
})

describe('週主題對應與頭目戰週', () => {
  it('預設 6 個月的頭目戰週為 4、9、13、17、22、26，第 15 週開始日 2027-02-08', () => {
    const s = buildSchedule([pack], settings())
    expect(s.weeks.filter((w) => w.isBoss).map((w) => w.index)).toEqual([4, 9, 13, 17, 22, 26])
    expect(s.weeks[14].startDate).toBe('2027-02-08')
    // 建議週數時，週主題依序和內容包完全相同
    expect(s.weeks.map((w) => w.themes.map((t) => t.title))).toEqual(
      pack.levels.flatMap((l) => l.weeks.map((t) => [t.title])),
    )
  })

  it('拉長時主題重複、壓縮時主題合併，不跳過任何主題', () => {
    // 一關 3 個一般主題：建議 4 週、最少 2 週
    const level = makeLevel('L', 3, 2)
    const run = (weekCount: number) =>
      buildSchedule(
        [makePack('p', [level])],
        settings({ includeNovice: false, length: { endDate: addDays('2026-11-02', weekCount * 7 - 1) } }),
      ).weeks.map((w) => (w.isBoss ? 'boss' : w.themes.map((t) => t.title.replace('L 主題 ', ''))))
    expect(run(5)).toEqual([['0'], ['0'], ['1'], ['2'], 'boss'])
    expect(run(3)).toEqual([['0'], ['1', '2'], 'boss'])
  })
})

describe('每日任務產生', () => {
  it('第 4 週星期五 2026-11-27 用頭目戰覆寫，id 為「日期:key」', () => {
    const s = buildSchedule([pack], settings())
    const day = dayOf(s, '2026-11-27')!
    expect(day.weekIndex).toBe(4)
    expect(day.tasks).toEqual([
      { ...pack.bossDayOverrides['4'], id: `2026-11-27:${pack.bossDayOverrides['4'].key}` },
    ])
  })

  it('一般週依星期幾取每日模板；正式期共 182 天；任務 id 不重複', () => {
    const s = buildSchedule([pack], settings())
    const main = s.days.filter((d) => d.kind === 'main')
    expect(main).toHaveLength(182)
    expect(dayOf(s, '2026-11-02')!.tasks[0].key).toBe(pack.dailyTemplates[0].key)
    expect(dayOf(s, '2026-11-08')!.tasks[0].key).toBe(pack.dailyTemplates[6].key)
    const ids = s.days.flatMap((d) => d.tasks.map((t) => t.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('新手村前置', () => {
  it('預設新手村為 2026-10-24～10-31 共 8 天，2026-11-01 不在排程中', () => {
    const s = buildSchedule([pack], settings())
    const novice = s.days.filter((d) => d.kind === 'novice')
    expect(novice.map((d) => d.date)).toEqual([
      '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
      '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
    ])
    expect(novice.every((d) => d.weekIndex === null && d.tasks.length === 1)).toBe(true)
    expect(novice.every((d) => d.tasks[0].minutes === 30 && d.isLight === false)).toBe(true)
    expect(novice[0].tasks[0].key).toBe('novice-1')
    expect(dayOf(s, '2026-11-01')).toBeUndefined()
  })

  it('includeNovice 為 false 時沒有新手村日', () => {
    const s = buildSchedule([pack], settings({ includeNovice: false }))
    expect(s.days.some((d) => d.kind === 'novice')).toBe(false)
  })
})

describe('輕量日', () => {
  it('輕量區間 2027-02-04～02-10：平日只有輕量任務，週末不變', () => {
    const s = buildSchedule([pack], settings({ lightRanges: [{ start: '2027-02-04', end: '2027-02-10' }] }))
    for (const date of ['2027-02-04', '2027-02-05', '2027-02-08', '2027-02-09', '2027-02-10']) {
      const day = dayOf(s, date)!
      expect(day.isLight, date).toBe(true)
      expect(day.tasks.map((t) => t.key), date).toEqual([pack.lightDayTemplate.key])
    }
    expect(dayOf(s, '2027-02-06')!.tasks[0].key).toBe(pack.dailyTemplates[5].key)
    expect(dayOf(s, '2027-02-07')!.tasks[0].key).toBe(pack.dailyTemplates[6].key)
    expect(dayOf(s, '2027-02-06')!.isLight).toBe(false)
  })

  it('輕量優先於頭目戰覆寫（第 4 週星期五落在輕量區間）', () => {
    const s = buildSchedule([pack], settings({ lightRanges: [{ start: '2026-11-27', end: '2026-11-27' }] }))
    expect(dayOf(s, '2026-11-27')!.tasks[0].key).toBe(pack.lightDayTemplate.key)
    expect(dayOf(s, '2026-11-28')!.tasks[0].key).toBe(pack.bossDayOverrides['5'].key)
  })
})

describe('排程是純函式', () => {
  function deepFreeze<T>(value: T): T {
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(deepFreeze)
      Object.freeze(value)
    }
    return value
  }

  it('凍結輸入後連續呼叫兩次，不丟錯且結果相同', () => {
    const frozenPack = deepFreeze(structuredClone(pack))
    const frozenSettings = deepFreeze(settings({ lightRanges: [{ start: '2027-02-04', end: '2027-02-10' }] }))
    const first = buildSchedule([frozenPack], frozenSettings)
    const second = buildSchedule([frozenPack], frozenSettings)
    expect(second).toEqual(first)
  })
})

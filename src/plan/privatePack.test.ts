import { describe, expect, it } from 'vitest'
import { buildSchedule } from './buildSchedule'
import { addDays } from './dates'
import type { ContentPack } from './types'

// 私人內容包只在本機存在（由 scripts/export_private_pack.py 產生）；CI 上找不到就整組略過
const found = import.meta.glob<{ default: ContentPack }>('../../content/packs/private/meeting-a2-b1/pack.json', {
  eager: true,
})
const privatePack = Object.values(found)[0]?.default

describe.skipIf(!privatePack)('私人內容包對照原計畫', () => {
  const schedule = () =>
    buildSchedule([privatePack!], {
      startDate: '2026-11-02',
      length: { months: 6 },
      includeNovice: true,
      lightRanges: [],
    })

  it('26 週的週主題標題依序和私人內容包一致', () => {
    const s = schedule()
    expect(s.weeks.map((w) => w.themes.map((t) => t.title))).toEqual(
      privatePack!.levels.flatMap((l) => l.weeks.map((t) => [t.title])),
    )
  })

  it('頭目戰週與日期和原計畫相同', () => {
    const s = schedule()
    expect(s.weeks.filter((w) => w.isBoss).map((w) => w.index)).toEqual([4, 9, 13, 17, 22, 26])
    s.weeks.forEach((w) => expect(w.startDate).toBe(addDays('2026-11-02', (w.index - 1) * 7)))
    expect(s.endDate).toBe('2027-05-02')
    const novice = s.days.filter((d) => d.kind === 'novice').map((d) => d.date)
    expect(novice[0]).toBe('2026-10-24')
    expect(novice[novice.length - 1]).toBe('2026-10-31')
  })
})

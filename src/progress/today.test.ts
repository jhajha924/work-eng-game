import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sample from '../../content/packs/meeting-a2-b1-sample/pack.json'
import { buildSchedule } from '../plan/buildSchedule'
import type { ContentPack } from '../plan/types'
import { findToday, localToday } from './today'

const pack = sample as ContentPack
const schedule = buildSchedule([pack], {
  startDate: '2026-11-02',
  length: { months: 6 },
  includeNovice: true,
  lightRanges: [],
})

describe('今天日期依裝置本機時區', () => {
  const originalTz = process.env.TZ
  afterAll(() => {
    process.env.TZ = originalTz
  })

  describe.each([
    { tz: 'Asia/Taipei', expected: '2026-11-01' },
    { tz: 'America/New_York', expected: '2026-10-31' },
  ])('$tz', ({ tz, expected }) => {
    beforeAll(() => {
      process.env.TZ = tz
    })
    it(`2026-10-31T16:30:00Z → ${expected}`, () => {
      expect(localToday(new Date('2026-10-31T16:30:00Z'))).toBe(expected)
    })
  })
})

describe('今天狀態的判斷', () => {
  it('2026-10-20 → before，第一天 2026-10-24', () => {
    expect(findToday(schedule, pack, '2026-10-20')).toEqual({ status: 'before', firstDate: '2026-10-24' })
  })

  it.each<{ today: string; dayNumber: number; noviceIndex: number }>([
    { today: '2026-10-24', dayNumber: 1, noviceIndex: 1 },
    { today: '2026-10-31', dayNumber: 8, noviceIndex: 8 },
  ])('$today → active，第 $dayNumber 天、新手村第 $noviceIndex 天', ({ today, dayNumber, noviceIndex }) => {
    const view = findToday(schedule, pack, today)
    expect(view.status).toBe('active')
    if (view.status !== 'active') return
    expect(view).toMatchObject({ dayNumber, noviceIndex, week: null, levelName: null })
    expect(view.day.date).toBe(today)
  })

  it('2026-11-01 → rest', () => {
    expect(findToday(schedule, pack, '2026-11-01')).toEqual({ status: 'rest' })
  })

  it('2026-11-02 → active，第 9 天、第 1 週、關卡「發音與開口腳本」', () => {
    const view = findToday(schedule, pack, '2026-11-02')
    if (view.status !== 'active') throw new Error(view.status)
    expect(view.dayNumber).toBe(9)
    expect(view.week?.index).toBe(1)
    expect(view.levelName).toBe('發音與開口腳本')
    expect(view.noviceIndex).toBeNull()
  })

  it('2027-05-02 → active，第 190 天、第 26 週', () => {
    const view = findToday(schedule, pack, '2027-05-02')
    if (view.status !== 'active') throw new Error(view.status)
    expect(view.dayNumber).toBe(190)
    expect(view.week?.index).toBe(26)
  })

  it('2027-05-03 → after，結束日 2027-05-02', () => {
    expect(findToday(schedule, pack, '2027-05-03')).toEqual({ status: 'after', endDate: '2027-05-02' })
  })
})

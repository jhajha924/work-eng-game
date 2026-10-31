import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addDays, diffDays, inRange, isValidDate, weekdayIndex } from './dates'
import { PlanError } from './types'

const originalTz = process.env.TZ

function runChecks() {
  it('加減天數：閏年與跨年', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-11-02', 26 * 7 - 1)).toBe('2027-05-02')
    expect(addDays('2026-11-02', -2)).toBe('2026-10-31')
  })

  it('日期差', () => {
    expect(diffDays('2026-11-02', '2027-05-02')).toBe(181)
    expect(diffDays('2026-11-02', '2026-10-24')).toBe(-9)
  })

  it('星期幾：星期一為 0', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0)
    expect(weekdayIndex('2026-11-27')).toBe(4)
    expect(weekdayIndex('2026-11-01')).toBe(6)
  })

  it('區間判斷含頭尾', () => {
    expect(inRange('2027-02-04', '2027-02-04', '2027-02-10')).toBe(true)
    expect(inRange('2027-02-10', '2027-02-04', '2027-02-10')).toBe(true)
    expect(inRange('2027-02-11', '2027-02-04', '2027-02-10')).toBe(false)
  })

  it.each(['2026-13-01', '2026-02-30', '', '2026-1-1', '2026/11/02'])('非法日期 %j', (bad) => {
    expect(isValidDate(bad)).toBe(false)
    expect(() => addDays(bad, 1)).toThrow(PlanError)
  })
}

// D2：同一組檢查在不同時區下都要得到相同結果
describe.each(['America/New_York', 'Asia/Taipei'])('時區 %s', (tz) => {
  beforeAll(() => {
    process.env.TZ = tz
  })
  it('時區設定生效', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz)
  })
  runChecks()
})

afterAll(() => {
  process.env.TZ = originalTz
})

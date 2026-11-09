import { describe, expect, it } from 'vitest'
import sample from '../../content/packs/meeting-a2-b1-sample/pack.json'
import { buildSchedule } from '../plan/buildSchedule'
import { addDays } from '../plan/dates'
import type { ContentPack } from '../plan/types'
import { computeStats } from './stats'
import type { TaskLog } from './types'
import { taskXp } from './xp'

const pack = sample as ContentPack
const schedule = buildSchedule([pack], {
  startDate: '2026-11-02',
  length: { months: 6 },
  includeNovice: true,
  lightRanges: [],
})

/** 每個打卡日完成當天第一個任務 */
function logsFor(dates: string[]): TaskLog[] {
  return dates.map((date) => {
    const task = schedule.days.find((d) => d.date === date)!.tasks[0]
    return { id: task.id, date, key: task.key, xp: taskXp(pack, task.key), isMinimum: false, completedAt: `${date}T12:00:00Z`, updatedAt: `${date}T12:00:00Z`, deleted: false }
  })
}

/** start～end 每一天（含頭尾） */
function range(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

const year = (md: string) => `2026-${md}`

describe('打卡日與連勝天數', () => {
  // 規格 Example「連勝天數」
  it.each<{ checked: string[]; today: string; streak: number; note: string }>([
    { checked: range(year('10-24'), year('10-30')), today: year('10-30'), streak: 7, note: '今天已打卡' },
    { checked: [year('10-29'), year('10-30'), year('10-31'), year('11-02')], today: year('11-02'), streak: 4, note: '11-01 不在排程，不中斷' },
    { checked: [year('10-29'), year('10-30')], today: year('10-31'), streak: 2, note: '今天還沒打卡，算到昨天' },
    { checked: [year('10-28'), year('10-30')], today: year('10-31'), streak: 1, note: '10-29 中斷' },
    { checked: [year('10-29')], today: year('10-31'), streak: 0, note: '昨天 10-30 沒打卡' },
    { checked: [], today: year('10-24'), streak: 0, note: '第一天還沒打卡' },
  ])('$note → 連勝 $streak', ({ checked, today, streak }) => {
    expect(computeStats(schedule, logsFor(checked), today).streak).toBe(streak)
  })

  it('最低限度日也算打卡', () => {
    const minimum: TaskLog = {
      id: '2026-10-25:minimum', date: '2026-10-25', key: 'minimum', xp: 5, isMinimum: true, completedAt: '2026-10-25T12:00:00Z',
      updatedAt: '2026-10-25T12:00:00Z', deleted: false,
    }
    const stats = computeStats(schedule, [...logsFor([year('10-24')]), minimum], year('10-25'))
    expect(stats).toMatchObject({ streak: 2, checkedInToday: true })
  })
})

describe('連勝獎勵', () => {
  const bonusOf = (checked: string[]) => {
    const logs = logsFor(checked)
    const base = logs.reduce((s, l) => s + l.xp, 0)
    return computeStats(schedule, logs, year('11-30')).totalXp - base
  }

  // 規格 Example「連勝獎勵」
  it.each<{ name: string; checked: string[]; bonus: number }>([
    { name: '10-24～10-30（7 天）', checked: range(year('10-24'), year('10-30')), bonus: 50 },
    {
      name: '10-24～10-31、11-02～11-07（14 個排程日）',
      checked: [...range(year('10-24'), year('10-31')), ...range(year('11-02'), year('11-07'))],
      bonus: 100,
    },
    { name: '10-24～10-29（6 天）', checked: range(year('10-24'), year('10-29')), bonus: 0 },
    {
      name: '兩段各 7 天（中間 10-31、11-02 未打卡）',
      checked: [...range(year('10-24'), year('10-30')), ...range(year('11-03'), year('11-09'))],
      bonus: 100,
    },
  ])('$name → $bonus', ({ checked, bonus }) => {
    expect(bonusOf(checked)).toBe(bonus)
  })
})

describe('總經驗值', () => {
  it('新手村 10-24～10-30 每天一個任務，今天 10-30 → 180＋50＝230', () => {
    const logs = logsFor(range(year('10-24'), year('10-30')))
    expect(logs.map((l) => l.xp)).toEqual([30, 30, 20, 20, 30, 20, 30])
    expect(computeStats(schedule, logs, year('10-30')).totalXp).toBe(230)
  })

  it('今天之後日期的紀錄不計入', () => {
    const logs = logsFor([year('10-24'), year('10-25')])
    expect(computeStats(schedule, logs, year('10-24')).totalXp).toBe(30)
  })
})

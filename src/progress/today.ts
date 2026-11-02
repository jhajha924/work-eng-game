// 今天的日期與今天在計畫中的位置
import { diffDays } from '../plan/dates'
import type { ContentPack, Schedule, ScheduledDay, ScheduledWeek } from '../plan/types'

/** D7：用裝置本機時區的年月日組成 YYYY-MM-DD（不用 UTC，台灣早上 8 點前才不會算成前一天） */
export function localToday(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type TodayView =
  | { status: 'before'; firstDate: string }
  | { status: 'after'; endDate: string }
  | { status: 'rest' }
  | {
      status: 'active'
      day: ScheduledDay
      /** 排程中的第幾天，新手村第一天為 1 */
      dayNumber: number
      week: ScheduledWeek | null
      levelName: string | null
      /** 新手村第幾天；正式期為 null */
      noviceIndex: number | null
    }

export function findToday(schedule: Schedule, pack: ContentPack, today: string): TodayView {
  const first = schedule.days[0]?.date ?? schedule.startDate
  if (diffDays(first, today) < 0) return { status: 'before', firstDate: first }
  if (diffDays(schedule.endDate, today) > 0) return { status: 'after', endDate: schedule.endDate }

  const index = schedule.days.findIndex((d) => d.date === today)
  if (index === -1) return { status: 'rest' }

  const day = schedule.days[index]
  const week = day.weekIndex === null ? null : schedule.weeks[day.weekIndex - 1]
  const level = week ? pack.levels.find((l) => l.id === week.levelId) : undefined
  const noviceIndex = day.kind === 'novice' ? schedule.days.slice(0, index + 1).filter((d) => d.kind === 'novice').length : null
  return { status: 'active', day, dayNumber: index + 1, week, levelName: level?.name ?? null, noviceIndex }
}

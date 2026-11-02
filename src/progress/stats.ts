// 經驗值與連勝（D2：每次由紀錄重新計算；D3 連勝規則；D4 連勝獎勵）
import { diffDays } from '../plan/dates'
import type { Schedule } from '../plan/types'
import type { ProgressStats, TaskLog } from './types'

/** 每段連續打卡的第 7、14、21……天各加 50 */
export const STREAK_BONUS_EVERY = 7
export const STREAK_BONUS_XP = 50

export function computeStats(schedule: Schedule, logs: TaskLog[], today: string): ProgressStats {
  // 今天之後的紀錄不計入
  const counted = logs.filter((log) => diffDays(log.date, today) >= 0)
  const checkedIn = new Set(counted.map((log) => log.date))

  // 只走排程中的日子：不在排程的日子（休息日）不中斷也不計數
  let run = 0
  let bonus = 0
  let streakBeforeToday = 0
  let checkedInToday = false
  for (const day of schedule.days) {
    const offset = diffDays(day.date, today)
    if (offset < 0) break
    if (offset === 0) {
      checkedInToday = checkedIn.has(day.date)
      streakBeforeToday = run
    }
    if (checkedIn.has(day.date)) {
      run += 1
      if (run % STREAK_BONUS_EVERY === 0) bonus += STREAK_BONUS_XP
    } else {
      run = 0
    }
  }
  // 今天在排程中：已打卡算到今天，還沒打卡算到前一個排程日；今天不在排程中（休息日、計畫外）：算到最後一個排程日
  const todayScheduled = schedule.days.some((d) => d.date === today)
  const streak = todayScheduled && !checkedInToday ? streakBeforeToday : run

  const totalXp = counted.reduce((sum, log) => sum + log.xp, 0) + bonus
  return { totalXp, streak, checkedInToday }
}

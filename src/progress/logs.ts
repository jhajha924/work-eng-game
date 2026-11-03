// 完成紀錄的產生與更新（純函式）：資料庫寫入與畫面更新共用同一份規則
import type { TaskLog } from './types'
import { MINIMUM_KEY, MINIMUM_XP } from './xp'

/** 最低限度日紀錄的 id（D5） */
export function minimumLogId(date: string): string {
  return `${date}:${MINIMUM_KEY}`
}

export function taskLogFor(task: { id: string; date: string; key: string }, xp: number, now: Date): TaskLog {
  return { id: task.id, date: task.date, key: task.key, xp, isMinimum: false, completedAt: now.toISOString() }
}

export function minimumLogFor(date: string, now: Date): TaskLog {
  return { id: minimumLogId(date), date, key: MINIMUM_KEY, xp: MINIMUM_XP, isMinimum: true, completedAt: now.toISOString() }
}

/** 加入（或覆蓋同 id 的）紀錄，回傳新陣列，不改動原陣列 */
export function withLog(logs: TaskLog[], log: TaskLog): TaskLog[] {
  return [...logs.filter((l) => l.id !== log.id), log]
}

/** 移除指定 id 的紀錄，回傳新陣列，不改動原陣列 */
export function withoutLog(logs: TaskLog[], id: string): TaskLog[] {
  return logs.filter((l) => l.id !== id)
}

// 完成紀錄的產生與更新（純函式）：資料庫寫入與畫面更新共用同一份規則
import type { StoredLog, TaskLog } from './types'
import { MINIMUM_KEY, MINIMUM_XP } from './xp'

/** 最低限度日紀錄的 id（D5） */
export function minimumLogId(date: string): string {
  return `${date}:${MINIMUM_KEY}`
}

/**
 * D7：修改時間只會往前走。取「現在」與「原本的修改時間加 1 毫秒」較晚的那個，
 * 裝置時鐘慢了也不會讓這次修改比它所根據的版本舊。
 */
export function nextUpdatedAt(prev: string | undefined, now: Date): string {
  if (prev === undefined) return now.toISOString()
  return new Date(Math.max(now.getTime(), Date.parse(prev) + 1)).toISOString()
}

/** prevUpdatedAt：同一筆紀錄原本的修改時間（再打勾時傳入），新紀錄省略 */
export function taskLogFor(
  task: { id: string; date: string; key: string },
  xp: number,
  now: Date,
  prevUpdatedAt?: string,
): TaskLog {
  return {
    id: task.id, date: task.date, key: task.key, xp, isMinimum: false,
    completedAt: now.toISOString(), updatedAt: nextUpdatedAt(prevUpdatedAt, now), deleted: false,
  }
}

export function minimumLogFor(date: string, now: Date, prevUpdatedAt?: string): TaskLog {
  return {
    id: minimumLogId(date), date, key: MINIMUM_KEY, xp: MINIMUM_XP, isMinimum: true,
    completedAt: now.toISOString(), updatedAt: nextUpdatedAt(prevUpdatedAt, now), deleted: false,
  }
}

/** 加入（或覆蓋同 id 的）紀錄，回傳新陣列，不改動原陣列 */
export function withLog(logs: TaskLog[], log: TaskLog): TaskLog[] {
  return [...logs.filter((l) => l.id !== log.id), log]
}

/** 移除指定 id 的紀錄，回傳新陣列，不改動原陣列 */
export function withoutLog(logs: TaskLog[], id: string): TaskLog[] {
  return logs.filter((l) => l.id !== id)
}

/** 去掉本機專用的 dirty 標記，只留紀錄本身 */
export function toTaskLog(log: StoredLog): TaskLog {
  return {
    id: log.id, date: log.date, key: log.key, xp: log.xp, isMinimum: log.isMinimum,
    completedAt: log.completedAt, updatedAt: log.updatedAt, deleted: log.deleted,
  }
}

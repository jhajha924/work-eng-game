// 打勾紀錄的讀寫（打勾＝寫入、取消＝刪除；D5 最低限度日也是一筆紀錄）
import type { ProgressDb } from './db'
import { minimumLogFor, minimumLogId, taskLogFor } from './logs'
import type { TaskLog } from './types'

export type ProgressRepo = {
  listLogs(): Promise<TaskLog[]>
  setTaskDone(task: { id: string; date: string; key: string }, xp: number, done: boolean, now: Date): Promise<void>
  setMinimumDay(date: string, on: boolean, now: Date): Promise<void>
}

export function createProgressRepo(db: ProgressDb): ProgressRepo {
  return {
    listLogs: () => db.taskLogs.toArray(),

    async setTaskDone(task, xp, done, now) {
      if (!done) {
        await db.taskLogs.delete(task.id)
        return
      }
      // put：同一個 id 再寫一次只會覆蓋，不會產生兩筆
      await db.taskLogs.put(taskLogFor(task, xp, now))
    },

    async setMinimumDay(date, on, now) {
      if (!on) {
        await db.taskLogs.delete(minimumLogId(date))
        return
      }
      await db.taskLogs.put(minimumLogFor(date, now))
    },
  }
}

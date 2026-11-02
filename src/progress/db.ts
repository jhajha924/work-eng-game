// 本機資料庫（D6：Dexie、單一資料表 taskLogs）
import Dexie, { type EntityTable } from 'dexie'
import type { TaskLog } from './types'

export type { TaskLog }

export const DB_NAME = 'work-eng-game'

export type ProgressDb = Dexie & { taskLogs: EntityTable<TaskLog, 'id'> }

/**
 * 開啟資料庫。版本 1：taskLogs 以任務 id 為主鍵、建立 date 索引。
 * 之後同步提案加欄位時，用 db.version(2) 升級，不改版本 1 的定義。
 */
export function createDb(name: string = DB_NAME): ProgressDb {
  const db = new Dexie(name) as ProgressDb
  db.version(1).stores({ taskLogs: 'id, date' })
  return db
}

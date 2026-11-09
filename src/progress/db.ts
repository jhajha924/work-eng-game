// 本機資料庫（D6：Dexie；版本 2 加上同步用欄位與 meta 資料表）
import Dexie, { type EntityTable } from 'dexie'
import type { StoredLog, TaskLog } from './types'

export type { StoredLog, TaskLog }

export const DB_NAME = 'work-eng-game'

/** 同步游標存在 meta 資料表的這個 key */
export const SYNC_CURSOR_KEY = 'syncCursor'

export type MetaEntry = { key: string; value: number }

export type ProgressDb = Dexie & {
  taskLogs: EntityTable<StoredLog, 'id'>
  meta: EntityTable<MetaEntry, 'key'>
}

/**
 * 開啟資料庫。
 * 版本 1：taskLogs 以任務 id 為主鍵、建立 date 索引（保留定義，Dexie 才能從舊版升級）。
 * 版本 2：taskLogs 加 dirty 索引、新增 meta；舊紀錄補上同步欄位並標成待上傳。
 */
export function createDb(name: string = DB_NAME): ProgressDb {
  const db = new Dexie(name) as ProgressDb
  db.version(1).stores({ taskLogs: 'id, date' })
  db.version(2)
    .stores({ taskLogs: 'id, date, dirty', meta: 'key' })
    .upgrade((tx) =>
      tx
        .table('taskLogs')
        .toCollection()
        .modify((log: StoredLog) => {
          log.updatedAt ??= log.completedAt
          log.deleted ??= false
          log.dirty = 1
        }),
    )
  return db
}

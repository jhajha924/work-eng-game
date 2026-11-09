// 打勾紀錄的讀寫：打勾＝寫入、取消＝標記墓碑（D6）；D5 最低限度日也是一筆紀錄
import { mergeRemote } from '../sync/merge'
import { SYNC_CURSOR_KEY, type ProgressDb } from './db'
import { minimumLogFor, minimumLogId, nextUpdatedAt, taskLogFor, toTaskLog } from './logs'
import type { StoredLog, TaskLog } from './types'

export type ProgressRepo = {
  /** 沒刪除的紀錄（經驗值、連勝由這些計算） */
  listLogs(): Promise<TaskLog[]>
  setTaskDone(task: { id: string; date: string; key: string }, xp: number, done: boolean, now: Date): Promise<void>
  setMinimumDay(date: string, on: boolean, now: Date): Promise<void>
  /** 尚未同步的紀錄，包含墓碑 */
  pendingChanges(): Promise<TaskLog[]>
  getCursor(): Promise<number>
  /**
   * 套用一次同步的結果（同一個交易）：清除送出後沒再改過的 dirty、合併伺服器紀錄、存游標。
   * 回傳本機實際被伺服器改變的筆數。
   */
  applySyncResult(sent: TaskLog[], remote: TaskLog[], cursor: number): Promise<number>
}

/** 兩筆紀錄內容相同（不看 dirty）；toTaskLog 固定欄位順序，才能直接比較字串 */
function sameLog(a: StoredLog, b: StoredLog): boolean {
  return JSON.stringify(toTaskLog(a)) === JSON.stringify(toTaskLog(b))
}

export function createProgressRepo(db: ProgressDb): ProgressRepo {
  /** 寫入或標記墓碑；make 依原本的紀錄產生新紀錄，回傳 null 表示不用寫 */
  function update(id: string, make: (existing: StoredLog | undefined) => TaskLog | null): Promise<void> {
    return db.transaction('rw', db.taskLogs, async () => {
      const next = make(await db.taskLogs.get(id))
      // put：同一個 id 再寫一次只會覆蓋，不會產生兩筆
      if (next) await db.taskLogs.put({ ...next, dirty: 1 })
    })
  }

  /** 取消：有沒刪除的紀錄才標成墓碑；沒有紀錄或已是墓碑就不做事 */
  function tombstone(existing: StoredLog | undefined, now: Date): TaskLog | null {
    if (!existing || existing.deleted) return null
    return { ...toTaskLog(existing), deleted: true, updatedAt: nextUpdatedAt(existing.updatedAt, now) }
  }

  return {
    listLogs: async () => (await db.taskLogs.toArray()).filter((l) => !l.deleted).map(toTaskLog),

    setTaskDone: (task, xp, done, now) =>
      update(task.id, (existing) => (done ? taskLogFor(task, xp, now, existing?.updatedAt) : tombstone(existing, now))),

    setMinimumDay: (date, on, now) =>
      update(minimumLogId(date), (existing) => (on ? minimumLogFor(date, now, existing?.updatedAt) : tombstone(existing, now))),

    pendingChanges: async () => (await db.taskLogs.where('dirty').equals(1).toArray()).map(toTaskLog),

    getCursor: async () => (await db.meta.get(SYNC_CURSOR_KEY))?.value ?? 0,

    applySyncResult: (sent, remote, cursor) =>
      db.transaction('rw', db.taskLogs, db.meta, async () => {
        for (const log of sent) {
          const current = await db.taskLogs.get(log.id)
          // 送出後又被改過（updatedAt 不同）就保持 dirty，下次再送
          if (current && current.updatedAt === log.updatedAt) await db.taskLogs.put({ ...current, dirty: 0 })
        }
        let changed = 0
        for (const record of remote) {
          const local = await db.taskLogs.get(record.id)
          const merged = mergeRemote(local, record)
          if (!merged) continue
          if (!local || !sameLog(local, merged)) changed += 1
          await db.taskLogs.put(merged)
        }
        await db.meta.put({ key: SYNC_CURSOR_KEY, value: cursor })
        return changed
      }),
  }
}

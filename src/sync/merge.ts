// 本機合併規則（D9）：伺服器回傳的一筆紀錄要不要覆蓋本機（純函式）
import { toTaskLog } from '../progress/logs'
import type { StoredLog, TaskLog } from '../progress/types'

export type { StoredLog }

/** 同步時在網路上傳送的紀錄（請求與回應同格式） */
export type SyncRecord = TaskLog

export const toSyncRecord: (log: StoredLog) => SyncRecord = toTaskLog

/**
 * 回傳要寫入本機的紀錄；回傳 null 表示保留本機版本。
 * 本機沒有或已同步（dirty 0）→ 用伺服器版本；本機有未同步的修改 → 伺服器嚴格較新才覆蓋。
 */
export function mergeRemote(local: StoredLog | undefined, remote: SyncRecord): StoredLog | null {
  if (local && local.dirty === 1 && Date.parse(remote.updatedAt) <= Date.parse(local.updatedAt)) return null
  return { ...remote, dirty: 0 }
}

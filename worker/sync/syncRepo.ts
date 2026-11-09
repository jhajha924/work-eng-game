// D8：同步的資料存取。先推後拉，全部放在同一個 batch（D1 的 batch 是一個交易）
import type { SyncRecord, SyncRequest } from './validate'

export const PAGE_SIZE = 500

export type SyncResponse = { cursor: number; changes: SyncRecord[]; hasMore: boolean }

type Row = {
  id: string
  date: string
  key: string
  xp: number
  is_minimum: number
  completed_at: string
  updated_at: string
  deleted: number
  rev: number
}

/**
 * 沒有這筆、或送來的 updatedAt 嚴格較新才寫入，並給它新的 rev（目前最大 rev 加 1）。
 * 時間都是 toISOString 格式（validate 已統一），可以直接用字串比較。
 */
const UPSERT = `
INSERT INTO task_logs (id, date, key, xp, is_minimum, completed_at, updated_at, deleted, rev)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(rev), 0) + 1 FROM task_logs))
ON CONFLICT (id) DO UPDATE SET
  date = excluded.date, key = excluded.key, xp = excluded.xp, is_minimum = excluded.is_minimum,
  completed_at = excluded.completed_at, updated_at = excluded.updated_at, deleted = excluded.deleted,
  rev = excluded.rev
WHERE excluded.updated_at > task_logs.updated_at`

/** since 超過目前最大 rev（例如伺服器資料重建過）時從 0 開始；多取一筆用來判斷 hasMore */
const PULL = `
SELECT id, date, key, xp, is_minimum, completed_at, updated_at, deleted, rev FROM task_logs
WHERE rev > (CASE WHEN ?1 > (SELECT COALESCE(MAX(rev), 0) FROM task_logs) THEN 0 ELSE ?1 END)
ORDER BY rev
LIMIT ?2`

function toRecord(row: Row): SyncRecord {
  return {
    id: row.id, date: row.date, key: row.key, xp: row.xp, isMinimum: row.is_minimum === 1,
    completedAt: row.completed_at, updatedAt: row.updated_at, deleted: row.deleted === 1,
  }
}

export async function sync(db: D1Database, { since, changes }: SyncRequest): Promise<SyncResponse> {
  const upserts = changes.map((r) =>
    db.prepare(UPSERT).bind(r.id, r.date, r.key, r.xp, r.isMinimum ? 1 : 0, r.completedAt, r.updatedAt, r.deleted ? 1 : 0),
  )
  const pull = db.prepare(PULL).bind(since, PAGE_SIZE + 1)
  const results = await db.batch([...upserts, pull])
  const rows = (results[results.length - 1].results ?? []) as Row[]

  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  return {
    // 沒有新紀錄時游標不變
    cursor: last ? last.rev : since,
    changes: page.map(toRecord),
    hasMore: rows.length > PAGE_SIZE,
  }
}

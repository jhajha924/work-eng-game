// D7：卡片狀態同步的資料存取。規則和打勾紀錄相同：先推後拉、同一個 batch、較新者為準、rev 當游標
import type { CardState } from '../../src/cards/types'
import { PAGE_SIZE } from '../sync/syncRepo'
import type { CardSyncRequest } from './validate'

export type CardSyncResponse = { cursor: number; changes: CardState[]; hasMore: boolean }

type Row = { id: string; state: string; updated_at: string; rev: number }

/** state 欄位只存 id 與 updatedAt 以外的欄位 */
type StoredFields = Omit<CardState, 'id' | 'updatedAt'>

/** 沒有這筆、或送來的 updatedAt 嚴格較新才寫入，並給它新的 rev（目前最大 rev 加 1） */
const UPSERT = `
INSERT INTO card_states (id, state, updated_at, rev)
VALUES (?, ?, ?, (SELECT COALESCE(MAX(rev), 0) + 1 FROM card_states))
ON CONFLICT (id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at, rev = excluded.rev
WHERE excluded.updated_at > card_states.updated_at`

/** since 超過目前最大 rev 時從 0 開始；多取一筆用來判斷 hasMore */
const PULL = `
SELECT id, state, updated_at, rev FROM card_states
WHERE rev > (CASE WHEN ?1 > (SELECT COALESCE(MAX(rev), 0) FROM card_states) THEN 0 ELSE ?1 END)
ORDER BY rev
LIMIT ?2`

function toStored(s: CardState): StoredFields {
  return {
    due: s.due, stability: s.stability, difficulty: s.difficulty, elapsedDays: s.elapsedDays,
    scheduledDays: s.scheduledDays, learningSteps: s.learningSteps, reps: s.reps, lapses: s.lapses, state: s.state,
    lastReview: s.lastReview, introducedOn: s.introducedOn,
  }
}

function toState(row: Row): CardState {
  const fields = JSON.parse(row.state) as StoredFields
  return { id: row.id, ...fields, updatedAt: row.updated_at }
}

export async function syncCards(db: D1Database, { since, changes }: CardSyncRequest): Promise<CardSyncResponse> {
  const upserts = changes.map((s) => db.prepare(UPSERT).bind(s.id, JSON.stringify(toStored(s)), s.updatedAt))
  const pull = db.prepare(PULL).bind(since, PAGE_SIZE + 1)
  const results = await db.batch([...upserts, pull])
  const rows = (results[results.length - 1].results ?? []) as Row[]

  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  return { cursor: last ? last.rev : since, changes: page.map(toState), hasMore: rows.length > PAGE_SIZE }
}

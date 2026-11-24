// D6：卡片狀態與複習紀錄的本機讀寫；D7：卡片狀態的同步（游標和打勾紀錄分開存）
import type { ProgressDb } from '../progress/db'
import { mergeRemote } from '../sync/merge'
import { toCardState } from './cardState'
import type { CardState, ReviewLog, StoredCardState } from './types'

/** 卡片狀態的同步游標存在 meta 的這個 key（打勾紀錄是 syncCursor） */
export const CARD_SYNC_CURSOR_KEY = 'cardSyncCursor'

export type CardRepo = {
  listStates(): Promise<CardState[]>
  /** 同一個交易寫入新的卡片狀態（標成未同步）與一筆複習紀錄 */
  saveReview(state: CardState, log: ReviewLog): Promise<void>
  /** 尚未同步的卡片狀態 */
  pendingChanges(): Promise<CardState[]>
  getCursor(): Promise<number>
  /**
   * 套用一次同步結果（同一個交易）：清除送出後沒再改過的 dirty、合併伺服器狀態、存游標。
   * 回傳本機實際被伺服器改變的張數。
   */
  applySyncResult(sent: CardState[], remote: CardState[], cursor: number): Promise<number>
}

const sameState = (a: StoredCardState, b: StoredCardState) =>
  JSON.stringify(toCardState(a)) === JSON.stringify(toCardState(b))

export function createCardRepo(db: ProgressDb): CardRepo {
  return {
    listStates: async () => (await db.cardStates.toArray()).map(toCardState),

    saveReview: (state, log) =>
      db.transaction('rw', db.cardStates, db.reviewLogs, async () => {
        await db.cardStates.put({ ...toCardState(state), dirty: 1 })
        await db.reviewLogs.put(log)
      }),

    pendingChanges: async () => (await db.cardStates.where('dirty').equals(1).toArray()).map(toCardState),

    getCursor: async () => (await db.meta.get(CARD_SYNC_CURSOR_KEY))?.value ?? 0,

    applySyncResult: (sent, remote, cursor) =>
      db.transaction('rw', db.cardStates, db.meta, async () => {
        for (const s of sent) {
          const current = await db.cardStates.get(s.id)
          // 送出後又評過分（updatedAt 不同）就保持 dirty，下次再送
          if (current && current.updatedAt === s.updatedAt) await db.cardStates.put({ ...current, dirty: 0 })
        }
        let changed = 0
        for (const record of remote) {
          const local = await db.cardStates.get(record.id)
          const merged = mergeRemote(local, toCardState(record))
          if (!merged) continue
          if (!local || !sameState(local, merged)) changed += 1
          await db.cardStates.put(merged)
        }
        await db.meta.put({ key: CARD_SYNC_CURSOR_KEY, value: cursor })
        return changed
      }),
  }
}

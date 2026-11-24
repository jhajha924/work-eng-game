// 卡片狀態的欄位清單只寫在這裡：本機儲存、同步 API、D1 的 JSON 欄位都由這份清單轉換（D6、D7）
import type { CardState, StoredCardState } from './types'

/** id 與 updatedAt 以外的欄位（D1 的 state 欄位存的就是這些），順序固定才能直接比較內容 */
const FIELD_KEYS = [
  'due', 'stability', 'difficulty', 'elapsedDays', 'scheduledDays', 'learningSteps', 'reps', 'lapses', 'state',
  'lastReview', 'introducedOn',
] as const satisfies readonly (keyof CardState)[]

export type CardFields = Pick<CardState, (typeof FIELD_KEYS)[number]>

// 編譯期檢查：CardState 新增欄位卻沒加進清單時，這行會出現型別錯誤
const everyFieldListed: Exclude<keyof CardState, 'id' | 'updatedAt' | (typeof FIELD_KEYS)[number]> extends never
  ? true
  : never = true
void everyFieldListed

/** 只取清單上的欄位 */
export function cardFields(s: CardFields): CardFields {
  return Object.fromEntries(FIELD_KEYS.map((key) => [key, s[key]])) as CardFields
}

/** 去掉 dirty 等多餘欄位，欄位順序固定 */
export function toCardState(s: StoredCardState | CardState): CardState {
  return { id: s.id, ...cardFields(s), updatedAt: s.updatedAt }
}

/**
 * 合併兩份卡片狀態清單：同一張卡留 updatedAt 較新的那份。
 * 單字卡頁重新讀取資料庫時用：讀取開始後才寫入的評分結果不會被較舊的讀取結果蓋掉。
 */
export function keepNewerStates(current: CardState[], loaded: CardState[]): CardState[] {
  const byId = new Map(current.map((s) => [s.id, s]))
  for (const s of loaded) {
    const existing = byId.get(s.id)
    if (!existing || Date.parse(s.updatedAt) >= Date.parse(existing.updatedAt)) byId.set(s.id, s)
  }
  return [...byId.values()]
}

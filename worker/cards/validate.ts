// 卡片狀態同步請求的格式檢查（D7、Implementation Contract）：任何一項不符合就整個請求不接受
import type { CardPhase, CardState } from '../../src/cards/types'
import { MAX_CHANGES } from '../sync/validate'

export type CardSyncRequest = { since: number; changes: CardState[] }

export type CardParseResult = { ok: true; value: CardSyncRequest } | { ok: false; reason: string }

/** <內容包 id>:<v 或 p>:<代號>，內容包 id 與代號只含小寫英數與 - */
const CARD_ID = /^[a-z0-9-]+:[vp]:[a-z0-9-]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIsoTime = (v: unknown): v is string => typeof v === 'string' && ISO_TIME.test(v) && !Number.isNaN(Date.parse(v))
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
/** 時間統一成 UTC 的 toISOString 格式，資料庫才能直接用字串比較先後 */
const toIso = (v: string) => new Date(v).toISOString()

function parseCardState(v: unknown): CardState | string {
  if (!isObject(v)) return '紀錄不是物件'
  const { id, due, stability, difficulty, elapsedDays, scheduledDays, learningSteps, reps, lapses, state, lastReview,
    introducedOn, updatedAt } = v
  if (typeof id !== 'string' || !CARD_ID.test(id)) return 'id 格式錯誤'
  if (!isIsoTime(due) || !isIsoTime(updatedAt)) return 'due、updatedAt 必須是 ISO 時間'
  if (lastReview !== null && !isIsoTime(lastReview)) return 'lastReview 必須是 ISO 時間或 null'
  if (typeof introducedOn !== 'string' || !DATE.test(introducedOn)) return 'introducedOn 必須是 YYYY-MM-DD'
  if (!isCount(state) || state > 3) return 'state 必須是 0～3 的整數'
  if (!isCount(reps) || !isCount(lapses) || !isCount(learningSteps)) return 'reps、lapses、learningSteps 必須是 0 以上的整數'
  if (!isAmount(stability) || !isAmount(difficulty) || !isAmount(elapsedDays) || !isAmount(scheduledDays)) {
    return 'stability、difficulty、elapsedDays、scheduledDays 必須是 0 以上的數字'
  }
  // 只取已知欄位，多送的欄位不會被存進資料庫
  return {
    id, due: toIso(due), stability, difficulty, elapsedDays, scheduledDays, learningSteps, reps, lapses,
    state: state as CardPhase, lastReview: lastReview === null ? null : toIso(lastReview), introducedOn,
    updatedAt: toIso(updatedAt),
  }
}

/** 單筆卡片狀態是否符合伺服器規則；前端送出前用同一套規則過濾，一筆不合格才不會擋住整批同步 */
export function isValidCardState(v: unknown): boolean {
  return typeof parseCardState(v) !== 'string'
}

export function parseCardSyncRequest(body: unknown): CardParseResult {
  if (!isObject(body)) return { ok: false, reason: '請求不是物件' }
  const { since, changes } = body
  if (!isCount(since)) return { ok: false, reason: 'since 必須是 0 以上的整數' }
  if (!Array.isArray(changes)) return { ok: false, reason: 'changes 必須是陣列' }
  if (changes.length > MAX_CHANGES) return { ok: false, reason: `changes 最多 ${MAX_CHANGES} 筆` }
  const states: CardState[] = []
  for (const [index, item] of changes.entries()) {
    const parsed = parseCardState(item)
    if (typeof parsed === 'string') return { ok: false, reason: `第 ${index + 1} 筆：${parsed}` }
    states.push(parsed)
  }
  return { ok: true, value: { since, changes: states } }
}

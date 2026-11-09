// 同步請求的格式檢查（D8、Implementation Contract）：任何一項不符合就整個請求不接受
export const MAX_CHANGES = 500
export const MAX_XP = 1000

/** 同步紀錄：和前端 TaskLog 同格式 */
export type SyncRecord = {
  id: string
  date: string
  key: string
  xp: number
  isMinimum: boolean
  completedAt: string
  updatedAt: string
  deleted: boolean
}

export type SyncRequest = { since: number; changes: SyncRecord[] }

export type ParseResult = { ok: true; value: SyncRequest } | { ok: false; reason: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const KEY = /^[a-z0-9-]+$/
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIsoTime = (v: unknown): v is string => typeof v === 'string' && ISO_TIME.test(v) && !Number.isNaN(Date.parse(v))

function parseRecord(v: unknown): SyncRecord | string {
  if (!isObject(v)) return '紀錄不是物件'
  const { id, date, key, xp, isMinimum, completedAt, updatedAt, deleted } = v
  if (typeof date !== 'string' || !DATE.test(date)) return 'date 格式錯誤'
  if (typeof key !== 'string' || !KEY.test(key)) return 'key 格式錯誤'
  if (id !== `${date}:${key}`) return 'id 必須是 date:key'
  if (typeof xp !== 'number' || !Number.isInteger(xp) || xp < 0 || xp > MAX_XP) return 'xp 必須是 0～1000 的整數'
  if (typeof isMinimum !== 'boolean' || typeof deleted !== 'boolean') return 'isMinimum、deleted 必須是布林'
  if (!isIsoTime(completedAt) || !isIsoTime(updatedAt)) return 'completedAt、updatedAt 必須是 ISO 時間'
  // 只取已知欄位，多送的欄位不會被寫進資料庫；時間統一成 UTC 的 toISOString 格式，
  // 資料庫才能直接用字串比較先後
  return {
    id, date, key, xp, isMinimum, deleted,
    completedAt: new Date(completedAt).toISOString(), updatedAt: new Date(updatedAt).toISOString(),
  }
}

export function parseSyncRequest(body: unknown): ParseResult {
  if (!isObject(body)) return { ok: false, reason: '請求不是物件' }
  const { since, changes } = body
  if (typeof since !== 'number' || !Number.isInteger(since) || since < 0) return { ok: false, reason: 'since 必須是 0 以上的整數' }
  if (!Array.isArray(changes)) return { ok: false, reason: 'changes 必須是陣列' }
  if (changes.length > MAX_CHANGES) return { ok: false, reason: `changes 最多 ${MAX_CHANGES} 筆` }
  const records: SyncRecord[] = []
  for (const [index, item] of changes.entries()) {
    const parsed = parseRecord(item)
    if (typeof parsed === 'string') return { ok: false, reason: `第 ${index + 1} 筆：${parsed}` }
    records.push(parsed)
  }
  return { ok: true, value: { since, changes: records } }
}

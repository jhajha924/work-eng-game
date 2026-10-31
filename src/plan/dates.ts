// 日期工具（D2）：介面一律是 YYYY-MM-DD 字串，內部用 UTC 午夜的毫秒數計算，
// 不受執行環境時區與夏令時間影響。
import { PlanError } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 把 YYYY-MM-DD 轉成 UTC 午夜的毫秒數；格式或日期不存在時回傳 null */
function toUtcMs(date: string): number | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(y, mo - 1, d)
  const back = new Date(ms)
  // Date.UTC 會把 2 月 30 日自動進位成 3 月 2 日，轉回來比對才能抓出不存在的日期
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null
  return ms
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function isValidDate(date: string): boolean {
  return toUtcMs(date) !== null
}

/** 合法日期回傳毫秒數，否則丟出 INVALID_DATE */
function parse(date: string): number {
  const ms = toUtcMs(date)
  if (ms === null) throw new PlanError('INVALID_DATE', `日期格式錯誤：${date}`)
  return ms
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(parse(date) + days * DAY_MS)
}

/** b − a 的天數 */
export function diffDays(a: string, b: string): number {
  return Math.round((parse(b) - parse(a)) / DAY_MS)
}

/** 星期幾：0 = 星期一 … 6 = 星期日 */
export function weekdayIndex(date: string): number {
  return (new Date(parse(date)).getUTCDay() + 6) % 7
}

/** date 是否落在 start～end（含頭尾） */
export function inRange(date: string, start: string, end: string): boolean {
  const d = parse(date)
  return parse(start) <= d && d <= parse(end)
}

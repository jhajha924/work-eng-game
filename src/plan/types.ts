// 內容包與排程的資料型別（D1：內容包不含任何日期，日期全部由計畫設定計算）

export type DayTemplate = { key: string; title: string; minutes: number }

export type WeekTheme = { title: string; focus: string; vocabCategory: string }

export type Level = {
  id: string
  name: string
  icon: string
  goal: string
  /** 壓縮時最少保留的週數，2 ≤ minWeeks ≤ weeks.length */
  minWeeks: number
  /** 拉長時分配多出週數的權重，> 0 */
  stretchWeight: number
  /** 建議週數 = weeks.length；最後一個是頭目戰週 */
  weeks: WeekTheme[]
}

export type NoviceDay = { title: string; description: string; xp: number; icon: string }

export type ContentPack = {
  id: string
  name: string
  version: number
  novice: NoviceDay[]
  levels: Level[]
  /** 恰好 7 個，索引 0 = 星期一 */
  dailyTemplates: DayTemplate[]
  /** 頭目戰週的覆寫任務，鍵為 "0"～"6" */
  bossDayOverrides: Record<string, DayTemplate>
  lightDayTemplate: DayTemplate
}

export type PlanLength = { months: 6 | 9 | 12 | 18 } | { endDate: string }

export type PlanSettings = {
  /** YYYY-MM-DD，必須是星期一 */
  startDate: string
  length: PlanLength
  includeNovice: boolean
  /** 輕量日期區間，含頭尾 */
  lightRanges: { start: string; end: string }[]
}

export type WeekAllocation = { packId: string; levelId: string; weeks: number }

/** id = `${date}:${key}` */
export type ScheduledTask = { id: string; key: string; title: string; minutes: number }

export type ScheduledWeek = {
  /** 從 1 起算 */
  index: number
  startDate: string
  packId: string
  levelId: string
  /** 關卡內第幾週，從 1 起算 */
  levelWeek: number
  themes: WeekTheme[]
  isBoss: boolean
}

export type ScheduledDay = {
  date: string
  kind: 'novice' | 'main'
  weekIndex: number | null
  tasks: ScheduledTask[]
  isLight: boolean
}

export type Schedule = {
  startDate: string
  endDate: string
  totalWeeks: number
  weeks: ScheduledWeek[]
  days: ScheduledDay[]
}

export type PlanErrorCode =
  | 'NO_PACKS'
  | 'INVALID_PACK'
  | 'INVALID_DATE'
  | 'START_NOT_MONDAY'
  | 'END_BEFORE_START'
  | 'PLAN_TOO_SHORT'

export class PlanError extends Error {
  readonly code: PlanErrorCode

  constructor(code: PlanErrorCode, message: string) {
    super(message)
    this.name = 'PlanError'
    this.code = code
  }
}

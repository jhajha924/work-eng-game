// 計畫引擎：內容包 × 計畫設定 → 每週主題與每天任務（純函式，不改動輸入、不依賴系統時間）
import { allocateWeeks } from './allocateWeeks'
import { addDays, diffDays, inRange, isValidDate, weekdayIndex } from './dates'
import {
  PlanError,
  type ContentPack,
  type DayTemplate,
  type PlanSettings,
  type Schedule,
  type ScheduledDay,
  type ScheduledTask,
  type ScheduledWeek,
  type WeekTheme,
} from './types'

/** D3：月數換週數（月數 × 13 ÷ 3） */
const MONTH_WEEKS = { 6: 26, 9: 39, 12: 52, 18: 78 } as const

/** 新手村每天任務的分鐘數 */
const NOVICE_MINUTES = 30

function requireDate(date: string, field: string): void {
  if (!isValidDate(date)) throw new PlanError('INVALID_DATE', `${field} 不是合法的 YYYY-MM-DD 日期：${date}`)
}

/** D3：計算總週數 */
function totalWeeksOf(settings: PlanSettings): number {
  if ('months' in settings.length) return MONTH_WEEKS[settings.length.months]
  const { endDate } = settings.length
  requireDate(endDate, '結束日')
  const days = diffDays(settings.startDate, endDate) + 1
  if (days < 1) throw new PlanError('END_BEFORE_START', `結束日 ${endDate} 早於開始日 ${settings.startDate}`)
  return Math.floor(days / 7)
}

/**
 * D6：一關的一般週對應週主題。
 * 第 j 週涵蓋索引 floor(j×T÷N) 到 max(floor(j×T÷N)+1, floor((j+1)×T÷N))（不含尾端）。
 */
function themesForWeek(themes: WeekTheme[], weekIndex: number, practiceWeeks: number): WeekTheme[] {
  const t = themes.length
  const start = Math.floor((weekIndex * t) / practiceWeeks)
  const end = Math.max(start + 1, Math.floor(((weekIndex + 1) * t) / practiceWeeks))
  return themes.slice(start, end)
}

function buildWeeks(packs: ContentPack[], startDate: string, totalWeeks: number): ScheduledWeek[] {
  const weeks: ScheduledWeek[] = []
  for (const { packId, levelId, weeks: count } of allocateWeeks(packs, totalWeeks)) {
    const level = packs.find((p) => p.id === packId)!.levels.find((l) => l.id === levelId)!
    const practiceThemes = level.weeks.slice(0, -1)
    const bossTheme = level.weeks[level.weeks.length - 1]
    for (let j = 0; j < count; j++) {
      const isBoss = j === count - 1
      weeks.push({
        index: weeks.length + 1,
        startDate: addDays(startDate, weeks.length * 7),
        packId,
        levelId,
        levelWeek: j + 1,
        themes: isBoss ? [bossTheme] : themesForWeek(practiceThemes, j, count - 1),
        isBoss,
      })
    }
  }
  return weeks
}

const toTask = (date: string, t: DayTemplate): ScheduledTask => ({
  id: `${date}:${t.key}`,
  key: t.key,
  title: t.title,
  minutes: t.minutes,
})

/** D7：新手村排在開始日前，最後一天是開始日前的星期六（星期日休息） */
function buildNoviceDays(pack: ContentPack, startDate: string): ScheduledDay[] {
  const lastDay = addDays(startDate, -2)
  const first = addDays(lastDay, -(pack.novice.length - 1))
  return pack.novice.map((d, i) => {
    const date = addDays(first, i)
    const key = `novice-${i + 1}`
    return {
      date,
      kind: 'novice',
      weekIndex: null,
      tasks: [{ id: `${date}:${key}`, key, title: d.title, minutes: NOVICE_MINUTES }],
      isLight: false,
    }
  })
}

function buildMainDays(packs: ContentPack[], weeks: ScheduledWeek[], settings: PlanSettings): ScheduledDay[] {
  const days: ScheduledDay[] = []
  for (const week of weeks) {
    const pack = packs.find((p) => p.id === week.packId)!
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(week.startDate, offset)
      // 輕量只影響平日，且優先於頭目戰覆寫
      const isLight = offset <= 4 && settings.lightRanges.some((r) => inRange(date, r.start, r.end))
      const boss = week.isBoss ? pack.bossDayOverrides[String(offset)] : undefined
      const template = isLight ? pack.lightDayTemplate : (boss ?? pack.dailyTemplates[offset])
      days.push({ date, kind: 'main', weekIndex: week.index, tasks: [toTask(date, template)], isLight })
    }
  }
  return days
}

export function buildSchedule(packs: ContentPack[], settings: PlanSettings): Schedule {
  if (packs.length === 0) throw new PlanError('NO_PACKS', '沒有任何內容包')
  requireDate(settings.startDate, '開始日')
  settings.lightRanges.forEach((r) => {
    requireDate(r.start, '輕量區間開始日')
    requireDate(r.end, '輕量區間結束日')
  })
  if (weekdayIndex(settings.startDate) !== 0) {
    throw new PlanError('START_NOT_MONDAY', `開始日 ${settings.startDate} 不是星期一`)
  }

  const totalWeeks = totalWeeksOf(settings)
  const weeks = buildWeeks(packs, settings.startDate, totalWeeks)
  const noviceDays = settings.includeNovice ? buildNoviceDays(packs[0], settings.startDate) : []

  return {
    startDate: settings.startDate,
    endDate: addDays(settings.startDate, totalWeeks * 7 - 1),
    totalWeeks,
    weeks,
    days: [...noviceDays, ...buildMainDays(packs, weeks, settings)],
  }
}

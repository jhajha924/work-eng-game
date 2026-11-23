// D5：每日複習佇列（純函式）。到期的複習卡在前、提前學習的卡其次、新卡最後（每天有上限）
import type { ContentPack } from '../plan/types'
import type { TodayView } from '../progress/today'
import type { Card, CardState } from './types'

/** 每天最多學的新卡數（和每日任務「新字 15 個」一致） */
export const NEW_CARDS_PER_DAY = 15
/** 學習中的卡在這段時間內到期就提前列入，「重來」的卡不用乾等 */
export const LEARN_AHEAD_MS = 20 * 60_000

export type QueueOptions = {
  now: Date
  /** 今天的本地日期（YYYY-MM-DD） */
  today: string
  /** 本週優先學的單字類別；null 表示照牌組順序 */
  weekCategory: string | null
  newLimit: number
}

const LEARNING = 1
const RELEARNING = 3

const byDue = (a: CardState, b: CardState) => Date.parse(a.due) - Date.parse(b.due)

export function buildQueue(deck: Card[], states: CardState[], { now, today, weekCategory, newLimit }: QueueOptions): Card[] {
  const cards = new Map(deck.map((c) => [c.id, c]))
  // 對應不到牌組的狀態（例如內容包改過英文）一律忽略
  const known = states.filter((s) => cards.has(s.id))
  const stateIds = new Set(known.map((s) => s.id))
  const time = now.getTime()

  const due = known.filter((s) => Date.parse(s.due) <= time).sort(byDue)
  const ahead = known
    .filter((s) => {
      const at = Date.parse(s.due)
      return (s.state === LEARNING || s.state === RELEARNING) && at > time && at <= time + LEARN_AHEAD_MS
    })
    .sort(byDue)

  const introducedToday = known.filter((s) => s.introducedOn === today).length
  const room = Math.max(0, newLimit - introducedToday)
  const fresh = deck.filter((c) => !stateIds.has(c.id))
  const preferred = fresh.filter((c) => c.kind === 'word' && weekCategory !== null && c.group === weekCategory)
  const rest = fresh.filter((c) => !preferred.includes(c))
  const newCards = [...preferred, ...rest].slice(0, room)

  return [...[...due, ...ahead].map((s) => cards.get(s.id)!), ...newCards]
}

const ADVANCED = /（進階）$/

/**
 * 本週優先的單字類別：今天所在週第一個週主題的 vocabCategory 去掉「（進階）」；
 * 新手村期間用內容包第一個單字類別；對不到任何單字類別時為 null
 */
export function weekCategoryFor(pack: ContentPack, view: TodayView): string | null {
  const categories = (pack.vocab ?? []).map((g) => g.category)
  if (view.status !== 'active' || categories.length === 0) return null
  if (view.noviceIndex !== null) return categories[0]
  const name = view.week?.themes[0]?.vocabCategory.replace(ADVANCED, '')
  return name !== undefined && categories.includes(name) ? name : null
}

/** 今日任務頁的單字卡入口文字；牌組沒有卡片時回傳 null（不顯示入口） */
export function todayEntryLabel(queueLength: number, deckSize: number): string | null {
  if (deckSize === 0) return null
  return queueLength === 0 ? '複習單字卡（今天已完成）' : `複習單字卡（今天 ${queueLength} 張）`
}

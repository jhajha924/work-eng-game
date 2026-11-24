// D4：FSRS 排程。用 ts-fsrs 計算評分後的新狀態；關閉隨機擾動，相同輸入一定得到相同結果
import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { nextUpdatedAt } from '../progress/logs'
import { localToday } from '../progress/today'
import type { CardPhase, CardState, Rating, ReviewLog } from './types'

const scheduler = fsrs(generatorParameters({ enable_fuzz: false }))

/** 我們的卡片狀態 → ts-fsrs 的卡片 */
function toFsrs(state: CardState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    ...(state.lastReview ? { last_review: new Date(state.lastReview) } : {}),
  }
}

/**
 * 評一次分。state 為 null 表示新卡（introducedOn 記今天的本地日期）。
 * 回傳新的卡片狀態（updatedAt 依 nextUpdatedAt：裝置時鐘倒退也會往前走）與一筆複習紀錄。
 */
export function reviewCard(
  cardId: string,
  state: CardState | null,
  rating: Rating,
  now: Date,
): { state: CardState; log: ReviewLog } {
  // 裝置時鐘倒退或同一毫秒再評（不晚於上次複習）時，以上次複習的下一毫秒計算：
  // ts-fsrs 不接受倒退的時間，複習紀錄的 id（卡片 id＠複習時間）也才不會和上一筆重複
  const last = state?.lastReview ? Date.parse(state.lastReview) : null
  const at = last !== null && last >= now.getTime() ? new Date(last + 1) : now
  const current = state ? toFsrs(state) : createEmptyCard(at)
  const { card } = scheduler.next(current, at, rating as Grade)
  const reviewedAt = at.toISOString()
  const next: CardState = {
    id: cardId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardPhase,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
    introducedOn: state?.introducedOn ?? localToday(at),
    updatedAt: nextUpdatedAt(state?.updatedAt, now),
  }
  const log: ReviewLog = {
    id: `${cardId}@${reviewedAt}`,
    cardId,
    rating,
    reviewedAt,
    state: next.state,
    due: next.due,
  }
  return { state: next, log }
}

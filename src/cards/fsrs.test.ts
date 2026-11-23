import { describe, expect, it } from 'vitest'
import { reviewCard } from './fsrs'

// 2026-11-16 09:00 本地時間（測試環境的時區由 vitest 設定決定，日期用 localToday 計算）
const now = new Date(2026, 10, 16, 9, 0, 0)
const ID = 'demo:v:meeting'

describe('FSRS 評分', () => {
  it('新卡評「良好」：reps 1、introducedOn 為今天、due 晚於 now、紀錄 rating 3', () => {
    const { state, log } = reviewCard(ID, null, 3, now)
    expect(state.id).toBe(ID)
    expect(state.reps).toBe(1)
    expect(state.introducedOn).toBe('2026-11-16')
    expect(Date.parse(state.due)).toBeGreaterThan(now.getTime())
    expect(state.updatedAt).toBe(now.toISOString())
    expect(state.lastReview).toBe(now.toISOString())
    expect(log).toEqual({
      id: `${ID}@${now.toISOString()}`,
      cardId: ID,
      rating: 3,
      reviewedAt: now.toISOString(),
      state: state.state,
      due: state.due,
    })
  })

  it('評「重來」比評「簡單」更早到期', () => {
    const { state } = reviewCard(ID, null, 3, now)
    const later = new Date(Date.parse(state.due) + 60_000)
    const again = reviewCard(ID, state, 1, later).state
    const easy = reviewCard(ID, state, 4, later).state
    expect(Date.parse(again.due)).toBeLessThan(Date.parse(easy.due))
  })

  it('不是新卡時 introducedOn 保持原值，updatedAt 一定往前走', () => {
    const first = reviewCard(ID, null, 4, now).state
    // 裝置時鐘倒退：updatedAt 取原本的加 1 毫秒
    const earlier = new Date(now.getTime() - 3_600_000 * 48)
    const second = reviewCard(ID, first, 3, earlier).state
    expect(second.introducedOn).toBe('2026-11-16')
    expect(second.updatedAt).toBe(new Date(now.getTime() + 1).toISOString())
    // 排程以上次複習時間計算，不會因為時鐘倒退而出錯
    expect(second.reps).toBe(2)
    expect(Date.parse(second.due)).toBeGreaterThan(now.getTime())
  })

  it('結果可重現：相同輸入兩次結果相同', () => {
    const base = reviewCard(ID, null, 3, now).state
    const at = new Date(now.getTime() + 600_000)
    expect(reviewCard(ID, base, 2, at)).toEqual(reviewCard(ID, base, 2, at))
  })
})

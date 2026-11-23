// 單字卡的資料型別（D2、D3、D6；設計的 Implementation Contract「資料格式」）

export type CardKind = 'word' | 'pattern'

/** 一張卡：正面中文（zh）＋分組，背面英文（en）＋例句；group 是單字的類別或句型的情境 */
export type Card = {
  id: string
  kind: CardKind
  en: string
  zh: string
  example?: string
  group: string
}

/** 評分：1 重來、2 困難、3 良好、4 簡單 */
export type Rating = 1 | 2 | 3 | 4

/** FSRS 的卡片階段：0 新、1 學習中、2 複習、3 重新學習 */
export type CardPhase = 0 | 1 | 2 | 3

/** 卡片狀態（本機與同步相同格式）；時間都是 ISO 字串 */
export type CardState = {
  id: string
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: CardPhase
  lastReview: string | null
  /** 第一次評分的本地日期（YYYY-MM-DD），用來計算每天新卡上限 */
  introducedOn: string
  updatedAt: string
}

/** 本機儲存的卡片狀態：多一個未同步標記 */
export type StoredCardState = CardState & { dirty: 0 | 1 }

/** 一次評分的紀錄（只存本機）；id = `${cardId}@${reviewedAt}` */
export type ReviewLog = {
  id: string
  cardId: string
  rating: Rating
  reviewedAt: string
  /** 評分後的階段與下次到期時間 */
  state: CardPhase
  due: string
}

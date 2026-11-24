// 單字卡頁的狀態：讀取卡片狀態、算今天的佇列、評分（D5、D6）；畫面元件只負責顯示
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultPack, defaultSchedule } from '../app/defaultPlan'
import { getCardRepo } from '../app/storage'
import { findToday, localToday } from '../progress/today'
import { keepNewerStates } from './cardState'
import { buildDeck } from './deck'
import { reviewCard } from './fsrs'
import { buildQueue, NEW_CARDS_PER_DAY, weekCategoryFor } from './queue'
import type { CardState, Rating } from './types'

export const CARD_DB_ERROR = '無法存取本機資料庫，單字卡進度無法儲存'
/** 頁面開著時多久更新一次「現在」：學習中的卡到期後回到佇列，跨過午夜也會換成新的一天 */
export const NOW_REFRESH_MS = 30_000

export type FlashcardsOptions = {
  /** 同步取回其他裝置的變更時加 1，這裡就重新讀取卡片狀態 */
  remoteVersion?: number
  /** 評分寫入成功後呼叫（排程同步） */
  onWrite?: () => void
}

export function useFlashcards({ remoteVersion = 0, onWrite }: FlashcardsOptions = {}) {
  const deck = useMemo(() => buildDeck(defaultPack), [])
  const [states, setStates] = useState<CardState[]>([])
  // 佇列用的「現在」：載入、每次評分與每 30 秒更新；「今天」由它算出，跨過午夜就換成新的一天
  const [now, setNow] = useState(() => new Date())
  const today = localToday(now)
  const weekCategory = useMemo(() => weekCategoryFor(defaultPack, findToday(defaultSchedule, defaultPack, today)), [today])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 評分中：停用評分按鈕；ref 立即生效，連點第二下一定被擋下
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => getCardRepo().listStates())
      .then((loaded) => {
        if (cancelled) return
        // 讀取開始後才寫入的評分結果比讀到的新，不能被蓋掉
        setStates((current) => keepNewerStates(current, loaded))
        setNow(new Date())
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError(CARD_DB_ERROR)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [remoteVersion])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const queue = useMemo(
    () => buildQueue(deck, states, { now, today, weekCategory, newLimit: NEW_CARDS_PER_DAY }),
    [deck, states, now, today, weekCategory],
  )
  const current = queue[0] ?? null

  /** 對目前這張卡評分：寫入成功才更新畫面並排程同步 */
  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || writing.current) return
      writing.current = true
      setBusy(true)
      try {
        const at = new Date()
        const previous = states.find((s) => s.id === current.id) ?? null
        const { state, log } = reviewCard(current.id, previous, rating, at)
        await getCardRepo().saveReview(state, log)
        setStates((prev) => keepNewerStates(prev, [state]))
        setNow(at)
        setError(null)
        onWrite?.()
      } catch {
        setError(CARD_DB_ERROR)
      } finally {
        writing.current = false
        setBusy(false)
      }
    },
    [current, states, onWrite],
  )

  return { loading, error, busy, deckSize: deck.length, queue, current, rate }
}

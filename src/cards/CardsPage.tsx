// 單字卡頁（D3、D8）：正面中文 → 翻面看英文 → 四種評分；狀態與動作都來自 useFlashcards
import { useState } from 'react'
import type { SyncApi } from '../sync/useSync'
import type { Rating } from './types'
import { useFlashcards } from './useFlashcards'
import './CardsPage.css'

const RATINGS: { rating: Rating; label: string }[] = [
  { rating: 1, label: '重來' },
  { rating: 2, label: '困難' },
  { rating: 3, label: '良好' },
  { rating: 4, label: '簡單' },
]

export function CardsPage({ sync }: { sync: SyncApi }) {
  const { loading, error, busy, deckSize, queue, current, rate } = useFlashcards({
    remoteVersion: sync.remoteVersion,
    onWrite: sync.notifyLocalChange,
  })
  // 記住翻面的是哪一張：同步重新讀取後換成別張卡時，新的卡一定從正面開始
  const [flippedId, setFlippedId] = useState<string | null>(null)
  const flipped = current !== null && flippedId === current.id

  function onRate(rating: Rating) {
    // 下一張（包含「重來」後再出現的同一張）都從正面開始
    setFlippedId(null)
    void rate(rating)
  }

  return (
    <main className="cards">
      <header className="cards-header">
        <a className="cards-back" href="#/">
          回今日任務
        </a>
        {!loading && !error && deckSize > 0 && <p className="cards-count">今天還有 {queue.length} 張</p>}
      </header>

      {error && (
        <p className="cards-error" role="alert">
          {error}
        </p>
      )}

      {!error && loading && <p className="cards-message">載入中…</p>}
      {!error && !loading && deckSize === 0 && <p className="cards-message">這個內容包沒有單字卡</p>}
      {!error && !loading && deckSize > 0 && !current && <p className="cards-message">今天的單字卡已完成！</p>}

      {!error && !loading && current && (
        <section className="flashcard" aria-label="單字卡">
          <p className="flashcard-group">
            {current.kind === 'word' ? '單字' : '句型'}・{current.group}
          </p>
          <p className="flashcard-front">{current.zh}</p>

          {flipped ? (
            <>
              <p className="flashcard-back" lang="en">
                {current.en}
              </p>
              {current.example && (
                <p className="flashcard-example" lang="en">
                  {current.example}
                </p>
              )}
              <div className="ratings">
                {RATINGS.map(({ rating, label }) => (
                  <button key={rating} type="button" className="rating" disabled={busy} onClick={() => onRate(rating)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className="flip" onClick={() => setFlippedId(current.id)}>
              翻面
            </button>
          )}
        </section>
      )}
    </main>
  )
}

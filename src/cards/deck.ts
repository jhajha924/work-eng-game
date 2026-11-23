// 單字卡牌組（D2）：由內容包產生卡片，卡片 id 跨裝置相同
import type { ContentPack } from '../plan/types'
import type { Card } from './types'

/**
 * 卡片代號：英文轉小寫、連續的非英數字元換成一個 -、去掉頭尾的 -。
 * 例如 "Shall we get started?" → "shall-we-get-started"；沒有任何英數字元時回傳空字串
 */
export function cardSlug(en: string): string {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * 由內容包產生卡片：所有單字（依類別、類別內順序）在前，所有句型在後。
 * id = `<內容包 id>:<v 或 p>:<代號>`；內容包沒有單字與句型時回傳空陣列
 */
export function buildDeck(pack: ContentPack): Card[] {
  const words: Card[] = (pack.vocab ?? []).flatMap((group) =>
    group.words.map((w) => ({
      id: `${pack.id}:v:${cardSlug(w.en)}`,
      kind: 'word' as const,
      en: w.en,
      zh: w.zh,
      ...(w.example ? { example: w.example } : {}),
      group: group.category,
    })),
  )
  const patterns: Card[] = (pack.patterns ?? []).flatMap((group) =>
    group.items.map((p) => ({
      id: `${pack.id}:p:${cardSlug(p.en)}`,
      kind: 'pattern' as const,
      en: p.en,
      zh: p.zh,
      group: group.scenario,
    })),
  )
  return [...words, ...patterns]
}

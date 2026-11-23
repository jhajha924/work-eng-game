import { describe, expect, it } from 'vitest'
import { makeLevel, makePack } from '../plan/testFixtures'
import type { ContentPack } from '../plan/types'
import { buildDeck, cardSlug } from './deck'

describe('卡片代號', () => {
  // 規格 Example「代號轉換」
  it.each([
    ['meeting', 'meeting'],
    ['follow up', 'follow-up'],
    ['Shall we get started?', 'shall-we-get-started'],
    ["Today I'd like to talk about…", 'today-i-d-like-to-talk-about'],
    ['Q3 KPI', 'q3-kpi'],
  ])('%s → %s', (en, slug) => {
    expect(cardSlug(en)).toBe(slug)
  })
})

describe('卡片牌組', () => {
  const base = makePack('demo', [makeLevel('L1', 2, 2)])

  it('單字與句型都轉成卡片：單字在前、句型在後', () => {
    const pack: ContentPack = {
      ...base,
      vocab: [{ category: 'A 會議流程', words: [{ en: 'follow up', zh: '後續追蹤', example: "I'll follow up." }] }],
      patterns: [{ scenario: '開場', items: [{ en: 'Shall we get started?', zh: '我們開始吧？' }] }],
    }
    expect(buildDeck(pack)).toEqual([
      { id: 'demo:v:follow-up', kind: 'word', en: 'follow up', zh: '後續追蹤', example: "I'll follow up.", group: 'A 會議流程' },
      { id: 'demo:p:shall-we-get-started', kind: 'pattern', en: 'Shall we get started?', zh: '我們開始吧？', group: '開場' },
    ])
  })

  it('依類別、類別內順序排列；沒有例句的單字不帶 example', () => {
    const pack: ContentPack = {
      ...base,
      vocab: [
        { category: 'A', words: [{ en: 'agenda', zh: '議程' }, { en: 'minutes', zh: '會議紀錄' }] },
        { category: 'B', words: [{ en: 'deadline', zh: '截止日' }] },
      ],
    }
    const deck = buildDeck(pack)
    expect(deck.map((c) => c.id)).toEqual(['demo:v:agenda', 'demo:v:minutes', 'demo:v:deadline'])
    expect('example' in deck[0]).toBe(false)
  })

  it('沒有單字與句型時回傳空陣列', () => {
    expect(buildDeck(base)).toEqual([])
  })
})

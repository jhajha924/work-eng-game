import { describe, expect, it } from 'vitest'
import sample from '../../content/packs/meeting-a2-b1-sample/pack.json'
import type { ContentPack } from '../plan/types'
import { taskXp } from './xp'

const pack = sample as ContentPack

describe('任務經驗值', () => {
  // 規格 Example「任務經驗值」
  it.each<{ key: string; xp: number }>([
    { key: 'novice-1', xp: 30 },
    { key: 'novice-8', xp: 100 },
    { key: 'new-words', xp: 10 },
    { key: 'ai-talk', xp: 20 },
    { key: 'boss-battle', xp: 100 },
    { key: 'light', xp: 10 },
    { key: 'minimum', xp: 5 },
    { key: 'unknown-key', xp: 0 },
  ])('$key → $xp', ({ key, xp }) => {
    expect(taskXp(pack, key)).toBe(xp)
  })
})

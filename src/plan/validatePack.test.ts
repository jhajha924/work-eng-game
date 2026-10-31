import { describe, expect, it } from 'vitest'
import { makeLevel, makePack } from './testFixtures'
import type { ContentPack } from './types'
import { validatePack } from './validatePack'

const valid = (): ContentPack => makePack('ok', [makeLevel('L1', 3, 3), makeLevel('L2', 2, 2)], 2)

describe('內容包結構', () => {
  it('完整的內容包通過檢查', () => {
    expect(validatePack(valid())).toEqual({ ok: true })
  })
})

describe('結構檢查回報錯誤', () => {
  // 規格 Example「各種違規」：每一列各自失敗
  it.each<[string, (p: ContentPack) => unknown]>([
    ['id 為空字串', (p) => ({ ...p, id: '' })],
    ['levels 為空陣列', (p) => ({ ...p, levels: [] })],
    ['某關 weeks 只有 1 個', (p) => ({ ...p, levels: [{ ...p.levels[0], weeks: p.levels[0].weeks.slice(0, 1), minWeeks: 2 }] })],
    ['某關 minWeeks 為 1', (p) => ({ ...p, levels: [{ ...p.levels[0], minWeeks: 1 }] })],
    ['stretchWeight 為 0', (p) => ({ ...p, levels: [{ ...p.levels[0], stretchWeight: 0 }] })],
    ['bossDayOverrides 有鍵 "7"', (p) => ({ ...p, bossDayOverrides: { '7': p.dailyTemplates[0] } })],
    ['輸入不是物件（null）', () => null],
  ])('%s → ok: false', (_name, mutate) => {
    const result = validatePack(mutate(valid()))
    expect(result.ok).toBe(false)
  })

  it('多個錯誤同時回報', () => {
    const p = valid()
    const broken = {
      ...p,
      dailyTemplates: p.dailyTemplates.slice(0, 6),
      levels: [{ ...p.levels[0], minWeeks: 9 }],
    }
    const result = validatePack(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.some((e) => e.includes('dailyTemplates'))).toBe(true)
      expect(result.errors.some((e) => e.includes('minWeeks'))).toBe(true)
    }
  })

  it('任務模板 minutes 必須大於 0、key 不可重複、lightDayTemplate 必須存在', () => {
    const p = valid()
    const templates = p.dailyTemplates.map((t, i) => (i === 1 ? { ...t, key: 'mon', minutes: 0 } : t))
    const result = validatePack({ ...p, dailyTemplates: templates, lightDayTemplate: undefined })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('minutes'))).toBe(true)
      expect(result.errors.some((e) => e.includes('重複'))).toBe(true)
      expect(result.errors.some((e) => e.includes('lightDayTemplate'))).toBe(true)
    }
  })
})

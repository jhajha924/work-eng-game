import { describe, expect, it } from 'vitest'
import sample from '../../content/packs/meeting-a2-b1-sample/pack.json'
import { allocateWeeks } from './allocateWeeks'
import { makePackB } from './testFixtures'
import { PlanError, type ContentPack, type WeekAllocation } from './types'

const packA = sample as ContentPack
const packB = makePackB()

const weeksOf = (alloc: WeekAllocation[], packId: string) =>
  alloc.filter((a) => a.packId === packId).reduce((s, a) => s + a.weeks, 0)

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    if (e instanceof PlanError) return e.code
    throw e
  }
  return undefined
}

describe('內容包週數分配', () => {
  // 規格 Example「跨包分配」
  it.each<[string, ContentPack[], number, number, number]>([
    ['只有 A，26 週', [packA], 26, 26, 0],
    ['只有 A，39 週', [packA], 39, 39, 0],
    ['A、B，39 週', [packA, packB], 39, 39, 0],
    ['A、B，52 週', [packA, packB], 52, 26, 26],
    ['A、B，78 週', [packA, packB], 78, 26, 52],
  ])('%s → A %i 週、B %i 週', (_name, packs, total, a, b) => {
    const alloc = allocateWeeks(packs, total)
    expect(weeksOf(alloc, packA.id)).toBe(a)
    expect(weeksOf(alloc, packB.id)).toBe(b)
  })

  it('沒有內容包 → NO_PACKS', () => {
    expect(codeOf(() => allocateWeeks([], 26))).toBe('NO_PACKS')
  })

  it('內容包結構錯誤 → INVALID_PACK', () => {
    expect(codeOf(() => allocateWeeks([{ ...packA, levels: [] }], 26))).toBe('INVALID_PACK')
  })
})

describe('關卡週數拉長與壓縮', () => {
  // 規格 Example「關卡週數」
  it.each<[number, number[]]>([
    [26, [4, 5, 4, 4, 5, 4]],
    [39, [6, 7, 6, 7, 8, 5]],
    [22, [3, 4, 3, 4, 5, 3]],
    [20, [3, 4, 3, 3, 4, 3]],
  ])('分到 %i 週 → 各關 %j', (total, expected) => {
    expect(allocateWeeks([packA], total).map((a) => a.weeks)).toEqual(expected)
  })

  it('分到 19 週（低於最少值總和）→ PLAN_TOO_SHORT', () => {
    expect(codeOf(() => allocateWeeks([packA], 19))).toBe('PLAN_TOO_SHORT')
  })
})

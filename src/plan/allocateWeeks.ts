// 週數分配：先在內容包之間分（D4），再在每包的關卡之間分（D5 最大餘數法加權重）
import { PlanError, type ContentPack, type Level, type WeekAllocation } from './types'
import { validatePack } from './validatePack'

const EPS = 1e-9

const suggested = (pack: ContentPack) => pack.levels.reduce((sum, l) => sum + l.weeks.length, 0)
const minimum = (pack: ContentPack) => pack.levels.reduce((sum, l) => sum + l.minWeeks, 0)

type Share = { index: number; base: number; remainder: number; weight: number }

/**
 * 最大餘數法：把 amount 依 quotas 比例分成整數。
 * 先給每個人整數部分，剩下的依小數部分由大到小補 1；小數相同時用 tieBreak 排序。
 */
function largestRemainder(amount: number, ratios: number[], weights: number[], tieBreak: (a: Share, b: Share) => number) {
  const total = ratios.reduce((s, r) => s + r, 0)
  const shares: Share[] = ratios.map((r, index) => {
    const quota = (amount * r) / total
    const base = Math.floor(quota + EPS)
    return { index, base, remainder: quota - base, weight: weights[index] }
  })
  let left = amount - shares.reduce((s, x) => s + x.base, 0)
  const order = [...shares].sort((a, b) => {
    if (Math.abs(a.remainder - b.remainder) > EPS) return b.remainder - a.remainder
    return tieBreak(a, b)
  })
  for (const share of order) {
    if (left <= 0) break
    share.base += 1
    left -= 1
  }
  return shares.map((s) => s.base)
}

/** 把一包分到的週數分配到各關 */
function allocateLevels(levels: Level[], weeks: number): number[] {
  const base = levels.map((l) => l.weeks.length)
  const total = base.reduce((s, n) => s + n, 0)
  const weights = levels.map((l) => l.stretchWeight)

  if (weeks >= total) {
    // 拉長：依權重分配；小數相同時權重高者優先，再相同則關卡在前者優先
    if (weeks === total) return base
    const extra = largestRemainder(weeks - total, weights, weights, (a, b) => b.weight - a.weight || a.index - b.index)
    return base.map((n, i) => n + extra[i])
  }

  // 壓縮：依可壓縮量分配；小數相同時權重低者先扣，再相同則關卡在後者先扣
  const capacity = levels.map((l) => l.weeks.length - l.minWeeks)
  const capacityTotal = capacity.reduce((s, n) => s + n, 0)
  const shortfall = total - weeks
  if (shortfall > capacityTotal) {
    throw new PlanError('PLAN_TOO_SHORT', `計畫太短：至少需要 ${total - capacityTotal} 週，目前只有 ${weeks} 週`)
  }
  const cut = largestRemainder(shortfall, capacity, weights, (a, b) => a.weight - b.weight || b.index - a.index)
  return base.map((n, i) => n - cut[i])
}

export function allocateWeeks(packs: ContentPack[], totalWeeks: number): WeekAllocation[] {
  if (packs.length === 0) throw new PlanError('NO_PACKS', '沒有任何內容包')
  packs.forEach((pack, i) => {
    const result = validatePack(pack)
    if (!result.ok) throw new PlanError('INVALID_PACK', `內容包 ${i} 結構錯誤：${result.errors.join('；')}`)
  })
  // 排程用 id 反查內容包，id 重複就會查到錯的那一包
  const ids = packs.map((p) => p.id)
  if (new Set(ids).size !== ids.length) throw new PlanError('INVALID_PACK', `內容包 id 重複：${ids.join('、')}`)

  const result: WeekAllocation[] = []
  let remaining = totalWeeks
  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i]
    const next = packs[i + 1]
    const takeAll =
      remaining <= suggested(pack) || next === undefined || remaining - suggested(pack) < minimum(next)
    const weeks = takeAll ? remaining : suggested(pack)
    allocateLevels(pack.levels, weeks).forEach((n, j) => {
      result.push({ packId: pack.id, levelId: pack.levels[j].id, weeks: n })
    })
    remaining -= weeks
    if (takeAll) break
  }
  return result
}

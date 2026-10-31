// 內容包結構檢查：一次回報所有違規，不在第一個錯誤就停
import type { ContentPack } from './types'

export type PackValidation = { ok: true } | { ok: false; errors: string[] }

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

function checkTemplate(t: unknown, where: string, errors: string[]): void {
  if (!isObj(t)) {
    errors.push(`${where}：必須是任務模板物件`)
    return
  }
  if (!isNonEmptyString(t.key)) errors.push(`${where}：key 不可為空`)
  if (!isNonEmptyString(t.title)) errors.push(`${where}：title 不可為空`)
  if (!isPositive(t.minutes)) errors.push(`${where}：minutes 必須大於 0`)
}

export function validatePack(pack: unknown): PackValidation {
  const errors: string[] = []
  if (!isObj(pack)) return { ok: false, errors: ['內容包必須是物件'] }

  if (!isNonEmptyString(pack.id)) errors.push('id 不可為空')
  if (!isNonEmptyString(pack.name)) errors.push('name 不可為空')
  if (typeof pack.version !== 'number') errors.push('version 必須是數字')
  if (!Array.isArray(pack.novice)) {
    errors.push('novice 必須是陣列（可為空）')
  } else {
    pack.novice.forEach((day: unknown, i) => {
      const where = `novice[${i}]`
      if (!isObj(day)) {
        errors.push(`${where}：必須是物件`)
        return
      }
      if (!isNonEmptyString(day.title)) errors.push(`${where}：title 不可為空`)
      if (!isNonEmptyString(day.description)) errors.push(`${where}：description 不可為空`)
      if (!isNonEmptyString(day.icon)) errors.push(`${where}：icon 不可為空`)
      if (typeof day.xp !== 'number' || !Number.isFinite(day.xp)) errors.push(`${where}：xp 必須是數字`)
    })
  }

  if (!Array.isArray(pack.levels) || pack.levels.length === 0) {
    errors.push('levels 至少要有 1 關')
  } else {
    const seenIds = new Set<unknown>()
    pack.levels.forEach((level: unknown, i) => {
      const where = `levels[${i}]`
      if (!isObj(level)) {
        errors.push(`${where}：必須是物件`)
        return
      }
      if (!isNonEmptyString(level.id)) errors.push(`${where}：id 不可為空`)
      else if (seenIds.has(level.id)) errors.push(`${where}：id「${level.id}」和前面的關卡重複`)
      seenIds.add(level.id)
      if (!isNonEmptyString(level.name)) errors.push(`${where}：name 不可為空`)
      const weeks = Array.isArray(level.weeks) ? level.weeks : []
      if (weeks.length < 2) errors.push(`${where}：weeks 至少要 2 個（一般週＋頭目戰週）`)
      weeks.forEach((week: unknown, j) => {
        const at = `${where}.weeks[${j}]`
        if (!isObj(week)) {
          errors.push(`${at}：必須是物件`)
          return
        }
        if (!isNonEmptyString(week.title)) errors.push(`${at}：title 不可為空`)
        if (typeof week.focus !== 'string') errors.push(`${at}：focus 必須是字串`)
        if (typeof week.vocabCategory !== 'string') errors.push(`${at}：vocabCategory 必須是字串`)
      })
      const min = level.minWeeks
      if (typeof min !== 'number' || !Number.isInteger(min) || min < 2 || min > weeks.length) {
        errors.push(`${where}：minWeeks 必須介於 2 與 weeks 數量（${weeks.length}）之間`)
      }
      if (!isPositive(level.stretchWeight)) errors.push(`${where}：stretchWeight 必須大於 0`)
    })
  }

  if (!Array.isArray(pack.dailyTemplates) || pack.dailyTemplates.length !== 7) {
    errors.push('dailyTemplates 必須恰好 7 個（星期一到星期日）')
  }
  if (Array.isArray(pack.dailyTemplates)) {
    pack.dailyTemplates.forEach((t: unknown, i) => checkTemplate(t, `dailyTemplates[${i}]`, errors))
    const keys = pack.dailyTemplates.map((t: unknown) => (isObj(t) ? t.key : undefined))
    if (new Set(keys).size !== keys.length) errors.push('dailyTemplates 的 key 不可重複')
  }

  if (!isObj(pack.bossDayOverrides)) {
    errors.push('bossDayOverrides 必須是物件（可為空）')
  } else {
    for (const [k, t] of Object.entries(pack.bossDayOverrides)) {
      if (!/^[0-6]$/.test(k)) errors.push(`bossDayOverrides 的鍵只能是 "0"～"6"，收到 "${k}"`)
      checkTemplate(t, `bossDayOverrides["${k}"]`, errors)
    }
  }

  if (pack.lightDayTemplate === undefined) errors.push('lightDayTemplate 必須存在')
  else checkTemplate(pack.lightDayTemplate, 'lightDayTemplate', errors)

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

/** 給引擎用：通過檢查就把型別收窄成 ContentPack */
export function isValidPack(pack: unknown): pack is ContentPack {
  return validatePack(pack).ok
}

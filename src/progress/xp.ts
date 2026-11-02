// 任務經驗值（D1：經驗值寫在內容包，程式只負責依 key 查詢）
import type { ContentPack } from '../plan/types'

/** 最低限度日（今天只做 5 分鐘單字卡）的紀錄 key 與經驗值（D5） */
export const MINIMUM_KEY = 'minimum'
export const MINIMUM_XP = 5

const NOVICE_KEY = /^novice-(\d+)$/

export function taskXp(pack: ContentPack, key: string): number {
  if (key === MINIMUM_KEY) return MINIMUM_XP
  const novice = NOVICE_KEY.exec(key)
  if (novice) return pack.novice[Number(novice[1]) - 1]?.xp ?? 0
  const templates = [...pack.dailyTemplates, ...Object.values(pack.bossDayOverrides), pack.lightDayTemplate]
  return templates.find((t) => t.key === key)?.xp ?? 0
}

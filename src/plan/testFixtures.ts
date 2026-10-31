// 測試共用的內容包產生器（只給 *.test.ts 使用）
import { PlanError, type ContentPack, type DayTemplate, type Level } from './types'

/** 執行 fn，回傳丟出的 PlanError 代碼；沒丟錯回傳 undefined，其他錯誤照樣丟出 */
export function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    if (e instanceof PlanError) return e.code
    throw e
  }
  return undefined
}

const day = (key: string, minutes = 30): DayTemplate => ({ key, title: `任務 ${key}`, minutes })

/** 產生一關：themeCount 個一般週主題＋1 個頭目戰週主題 */
export function makeLevel(id: string, themeCount: number, minWeeks: number, stretchWeight = 1): Level {
  return {
    id,
    name: `關卡 ${id}`,
    icon: '⭐',
    goal: `${id} 目標`,
    minWeeks,
    stretchWeight,
    weeks: [
      ...Array.from({ length: themeCount }, (_, i) => ({
        title: `${id} 主題 ${i}`,
        focus: `${id} 重點 ${i}`,
        vocabCategory: `${id} 單字`,
      })),
      { title: `${id} 頭目戰`, focus: `${id} 頭目戰重點`, vocabCategory: `${id} 複習` },
    ],
  }
}

export function makePack(id: string, levels: Level[], noviceDays = 0): ContentPack {
  return {
    id,
    name: `內容包 ${id}`,
    version: 1,
    novice: Array.from({ length: noviceDays }, (_, i) => ({
      title: `新手村 ${i + 1}`,
      description: `第 ${i + 1} 天`,
      xp: 20,
      icon: '🎒',
    })),
    levels,
    dailyTemplates: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => day(k)),
    bossDayOverrides: { '4': day('boss-fri', 60), '5': day('boss-sat', 90) },
    lightDayTemplate: day('light', 5),
  }
}

/** 測試用第二內容包 B：建議 26 週、最少 20 週，結構和範例包相同 */
export function makePackB(): ContentPack {
  return makePack('pack-b', [
    makeLevel('B1', 3, 3),
    makeLevel('B2', 4, 4),
    makeLevel('B3', 3, 3),
    makeLevel('B4', 3, 3, 2),
    makeLevel('B5', 4, 4, 2),
    makeLevel('B6', 3, 3),
  ])
}

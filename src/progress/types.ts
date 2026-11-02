// 每日進度的資料型別（D2：資料庫只存完成紀錄，經驗值與連勝由紀錄重新計算）

/** 一筆完成紀錄；最低限度日也是一筆紀錄（key = minimum） */
export type TaskLog = {
  /** 任務 id（`日期:key`），也是資料表主鍵 */
  id: string
  date: string
  key: string
  xp: number
  isMinimum: boolean
  /** 完成時間，ISO 字串 */
  completedAt: string
}

export type ProgressStats = { totalXp: number; streak: number; checkedInToday: boolean }

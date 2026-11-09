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
  /** 最後修改時間，ISO 字串；同步時以較新者為準（D7：只會往前走） */
  updatedAt: string
  /** 墓碑：取消打勾時標記為 true 而不刪除，刪除才能同步到其他裝置（D6） */
  deleted: boolean
}

/** 存在本機資料庫的紀錄：多一個「尚未同步」標記（IndexedDB 不能用布林建索引，所以用 0／1） */
export type StoredLog = TaskLog & { dirty: 0 | 1 }

export type ProgressStats = { totalXp: number; streak: number; checkedInToday: boolean }

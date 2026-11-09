-- D5：登入與打勾紀錄同步用的資料表
-- 已套用的遷移檔不可修改；之後的結構變更請新增 0002_….sql

-- 打勾紀錄（和前端 TaskLog 同欄位；rev 是伺服器給的遞增版本號，前端用它當同步游標）
CREATE TABLE task_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  key TEXT NOT NULL,
  xp INTEGER NOT NULL,
  is_minimum INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL
);
CREATE INDEX idx_task_logs_rev ON task_logs (rev);

-- 工作階段：只存權杖的 SHA-256，時間為毫秒
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 登入失敗紀錄（鎖定判斷用），時間為毫秒
CREATE TABLE login_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL
);

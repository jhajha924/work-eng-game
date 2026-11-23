-- D7：單字卡狀態同步用的資料表（0001 已套用，不可修改；結構變更一律新增遷移檔）

-- 卡片狀態：state 是卡片狀態去掉 id 與 updatedAt 的 JSON 文字（伺服器不查詢裡面的欄位）；
-- rev 是伺服器給的遞增版本號，前端用它當同步游標
CREATE TABLE card_states (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  rev INTEGER NOT NULL
);
CREATE INDEX idx_card_states_rev ON card_states (rev);

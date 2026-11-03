## Purpose

打勾紀錄在瀏覽器本機資料庫與 D1 之間的雙向批次同步：D1 資料表、同步 API 的請求格式與檢查、伺服器與本機的合併規則、游標與分頁，以及前端觸發同步的時機與結果；登入驗證與畫面呈現不在本規格範圍。

## ADDED Requirements

### Requirement: D1 打勾紀錄資料表

遷移檔 `migrations/0001_auth_and_task_logs.sql` SHALL 建立 `task_logs`（`id` 主鍵、`date`、`key`、`xp`、`is_minimum`、`completed_at`、`updated_at`、`deleted`、`rev`，並為 `rev` 建立索引）、`sessions`（`token_hash` 主鍵、`created_at`、`expires_at`）與 `login_failures`（自動編號主鍵、`at`）三張資料表。已套用的遷移檔 MUST NOT 再修改，之後的結構變更 SHALL 新增下一號遷移檔。

#### Scenario: 在空資料庫套用遷移

- **WHEN** 對空的 SQLite 資料庫執行遷移檔
- **THEN** 三張資料表都存在，`task_logs` 有 `rev` 索引

### Requirement: 同步請求格式與檢查

`POST /api/sync` 的請求本文 SHALL 為 `{ "since": 整數, "changes": 紀錄陣列 }`，每筆紀錄為 `{ id, date, key, xp, isMinimum, completedAt, updatedAt, deleted }`。下列任何一項不符合時 SHALL 回 400 `{ "error": "invalid_request" }`，且 MUST NOT 寫入任何紀錄：`since` 為 0 以上的整數；`changes` 為陣列且最多 500 筆；`id` 為 `YYYY-MM-DD:key` 形式且日期部分等於 `date`；`key` 只含小寫英數與 `-`；`xp` 為 0～1000 的整數；`isMinimum`、`deleted` 為布林；`completedAt`、`updatedAt` 為可解析的 ISO 8601 時間字串。

#### Scenario: 檢查請求

- **WHEN** 以下列請求呼叫同步（已登入）
- **THEN** 回應狀態如下表

##### Example: 請求檢查

| 請求 | 狀態 |
| --- | --- |
| `since` 0、`changes` 空陣列 | 200 |
| `since` -1 | 400 |
| `since` 1.5 | 400 |
| `changes` 501 筆合法紀錄 | 400 |
| 一筆紀錄 `id` 為 `2026-11-02:new-words`、`date` 為 `2026-11-03` | 400 |
| 一筆紀錄 `xp` 為 `"10"`（字串） | 400 |
| 一筆紀錄 `updatedAt` 為 `yesterday` | 400 |
| 兩筆合法、一筆不合法 | 400，且兩筆合法的都沒寫入 |

### Requirement: 伺服器端合併：較新者為準

伺服器對每一筆送來的紀錄 SHALL 執行：資料表沒有同 `id` 的紀錄，或送來的 `updatedAt` 嚴格晚於資料表中的 `updated_at` 時，寫入並把 `rev` 設為目前資料表最大 `rev` 加 1；否則保留資料表中的版本、不改 `rev`。同一個請求的所有寫入 SHALL 在同一個批次交易中完成。

#### Scenario: 合併結果

- **WHEN** 資料表已有 `2026-11-02:new-words`（`updated_at` 為 10:00、`deleted` 為 false），送來同 `id` 的紀錄
- **THEN** 資料表結果如下表

##### Example: 伺服器合併

| 送來的 updatedAt | 送來的 deleted | 資料表結果 |
| --- | --- | --- |
| 10:05 | true | 更新為 deleted true，rev 增加 |
| 10:00 | true | 不變 |
| 09:55 | true | 不變 |

#### Scenario: 新紀錄

- **WHEN** 資料表最大 `rev` 為 7，送來兩筆資料表沒有的紀錄
- **THEN** 兩筆都寫入，`rev` 分別為 8 和 9

### Requirement: 取回變更與游標

寫入完成後，伺服器 SHALL 回傳 `rev` 大於 `since` 的紀錄（依 `rev` 由小到大，最多 500 筆），回應為 `{ "cursor": 整數, "changes": 紀錄陣列, "hasMore": 布林 }`：`cursor` 為回傳的最後一筆的 `rev`，沒有回傳任何紀錄時等於 `since`；還有更多紀錄未回傳時 `hasMore` 為 true。`since` 大於資料表目前最大 `rev` 時 SHALL 視為 `since` 為 0。

#### Scenario: 分頁取回

- **WHEN** 資料表有 `rev` 1～1200 的紀錄，依序以 `since` 0、上一次的 `cursor` 呼叫同步
- **THEN** 三次回應分別取回 500、500、200 筆，`cursor` 為 500、1000、1200，`hasMore` 為 true、true、false

#### Scenario: 游標超過伺服器

- **WHEN** 資料表最大 `rev` 為 3，以 `since` 50 呼叫同步
- **THEN** 回傳 `rev` 1～3 的三筆紀錄，`cursor` 為 3

### Requirement: 本機合併規則

純函式 `mergeRemote(local, remote)` SHALL 決定伺服器回傳的一筆紀錄是否覆蓋本機：本機沒有該筆 → 採用伺服器版本；本機該筆 `dirty` 為 0 → 採用伺服器版本；本機該筆 `dirty` 為 1 → 只有伺服器的 `updatedAt` 嚴格晚於本機時才採用伺服器版本，否則保留本機版本。採用的伺服器版本 SHALL 以 `dirty` 為 0 寫入本機。

#### Scenario: 合併決策

- **WHEN** 以下列本機狀態與伺服器紀錄呼叫 `mergeRemote`
- **THEN** 結果如下表

##### Example: 本機合併

| 本機 | 本機 updatedAt | 伺服器 updatedAt | 結果 |
| --- | --- | --- | --- |
| 沒有 | — | 10:00 | 採用伺服器 |
| dirty 0 | 10:05 | 10:00 | 採用伺服器 |
| dirty 1 | 10:05 | 10:00 | 保留本機 |
| dirty 1 | 10:05 | 10:05 | 保留本機 |
| dirty 1 | 10:05 | 10:06 | 採用伺服器 |

### Requirement: 送出後清除未同步標記

同步請求成功後，本機對這次送出的每一筆紀錄 SHALL 在 `updatedAt` 仍等於送出時的值時把 `dirty` 設為 0；送出後又被修改的紀錄 MUST 保持 `dirty` 為 1。清除標記、套用伺服器紀錄與儲存新游標 SHALL 在同一個本機資料庫交易中完成。

#### Scenario: 送出期間又打勾

- **WHEN** 送出 `2026-11-02:new-words`（updatedAt 10:00）後、回應回來前，使用者取消打勾使其 updatedAt 變成 10:00:20
- **THEN** 回應處理完後該筆仍為 `dirty` 1、`deleted` true，下一次同步會再送出

### Requirement: 同步用戶端的結果

`syncOnce()` SHALL 送出本機所有 `dirty` 為 1 的紀錄（每次最多 500 筆，超過時分多次送出）與目前游標，處理回應，並在 `hasMore` 為 true 時以新游標繼續請求，單次 `syncOnce()` 最多請求 20 次。結果 SHALL 為下列四種之一：`synced`（全部成功）、`unauthorized`（回應 401）、`offline`（`navigator.onLine` 為 false，或 `fetch` 丟出錯誤）、`error`（其他非 200 回應或回應格式不正確）。`synced` 以外的結果 MUST NOT 修改本機紀錄或游標。結果 SHALL 同時回報這次是否取回了任何伺服器紀錄。

#### Scenario: 各種結果

- **WHEN** 以模擬的 `fetch` 分別回傳 200 合法回應、401、500、丟出 TypeError，以及在 `navigator.onLine` 為 false 時呼叫 `syncOnce()`
- **THEN** 結果依序為 `synced`、`unauthorized`、`error`、`offline`、`offline`，後四種本機資料不變

#### Scenario: 離線時不發請求

- **WHEN** `navigator.onLine` 為 false 時呼叫 `syncOnce()`
- **THEN** 沒有呼叫 `fetch`，結果為 `offline`

### Requirement: 同步時機

已登入時，前端 SHALL 在下列時機執行同步：開啟頁面確認已登入後；本機寫入一筆紀錄後 30 秒（30 秒內多次寫入只同步一次）；頁面變成背景（`visibilitychange` 為 hidden）且有未同步的紀錄時立即同步；收到 `online` 事件時。同一時間 MUST 只有一個同步在執行；執行中又被觸發時，SHALL 在目前這次結束後再執行一次。未登入時 MUST NOT 呼叫 `/api/sync`。

#### Scenario: 連續打勾只同步一次

- **WHEN** 已登入，使用者在 10 秒內打勾三個任務
- **THEN** 最後一次打勾 30 秒後只發出一次同步請求，三筆一起送出

#### Scenario: 同步期間再觸發

- **WHEN** 同步執行中收到 `online` 事件
- **THEN** 目前的同步結束後再執行一次，兩次不會同時進行

### Requirement: 取消打勾也會同步

本機的墓碑紀錄（`deleted` 為 true）SHALL 和一般紀錄一樣送到伺服器；其他裝置收到墓碑後，該任務 SHALL 從畫面的已完成紀錄中消失。

#### Scenario: 兩台裝置

- **WHEN** 裝置 A 與 B 都已同步到任務 `2026-11-02:new-words` 已完成，A 取消打勾並同步，B 接著同步
- **THEN** B 的 `listLogs` 不再包含該任務，B 的總經驗值少 10

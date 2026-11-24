## MODIFIED Requirements

### Requirement: 同步用戶端的結果

`syncOnce()` SHALL 依序同步兩種資料：先打勾紀錄（`POST /api/sync`，游標存在 `meta` 的 `syncCursor`），全部成功後再同步卡片狀態（`POST /api/sync/cards`，游標存在 `meta` 的 `cardSyncCursor`）。每種資料都 SHALL 送出本機所有 `dirty` 為 1、且符合該 API 單筆規則的紀錄（每次最多 500 筆，超過時分多次送出）；不符合規則的紀錄 MUST NOT 送出（伺服器會整批拒收），留在本機並保持 `dirty` 為 1。每次請求同時送出目前游標並處理回應，並在 `hasMore` 為 true 時以新游標繼續請求，每種資料在單次 `syncOnce()` 中最多請求 20 次。結果 SHALL 為下列四種之一：`synced`（兩種資料都成功）、`unauthorized`（回應 401）、`offline`（`navigator.onLine` 為 false，或 `fetch` 丟出錯誤）、`error`（其他非 200 回應或回應格式不正確）；打勾紀錄失敗時 MUST NOT 再同步卡片狀態。失敗的那一次請求 MUST NOT 修改本機紀錄或游標（同一次 `syncOnce()` 中先前已成功的請求，其結果保留）。結果 SHALL 同時回報這次是否有本機紀錄或卡片狀態被伺服器資料改變。

#### Scenario: 各種結果

- **WHEN** 以模擬的 `fetch` 分別回傳 200 合法回應、401、500、丟出 TypeError，以及在 `navigator.onLine` 為 false 時呼叫 `syncOnce()`
- **THEN** 結果依序為 `synced`、`unauthorized`、`error`、`offline`、`offline`，後四種本機資料不變

#### Scenario: 不合格的紀錄不擋住同步

- **WHEN** 本機有三筆未同步紀錄，其中 key 為 `Bad Key` 與 xp 為 5000 的兩筆不符合單筆規則
- **THEN** 只送出合格的一筆，結果為 `synced`；兩筆不合格的仍留在本機且 `dirty` 為 1

#### Scenario: 離線時不發請求

- **WHEN** `navigator.onLine` 為 false 時呼叫 `syncOnce()`
- **THEN** 沒有呼叫 `fetch`，結果為 `offline`

#### Scenario: 先打勾紀錄、再卡片狀態

- **WHEN** 本機有一筆未同步的打勾紀錄與一筆未同步的卡片狀態，伺服器兩個 API 都回應成功
- **THEN** 依序呼叫 `/api/sync` 與 `/api/sync/cards`，兩筆的 `dirty` 都變成 0，兩個游標各自更新

#### Scenario: 打勾紀錄失敗就不同步卡片狀態

- **WHEN** `/api/sync` 回應 500
- **THEN** 結果為 `error`，沒有呼叫 `/api/sync/cards`

### Requirement: 本機合併規則

純函式 `mergeRemote(local, remote)` SHALL 決定伺服器回傳的一筆紀錄（打勾紀錄或卡片狀態）是否覆蓋本機：本機沒有該筆 → 採用伺服器版本；本機該筆 `dirty` 為 0 → 採用伺服器版本；本機該筆 `dirty` 為 1 → 只有伺服器的 `updatedAt` 嚴格晚於本機時才採用伺服器版本，否則保留本機版本。採用的伺服器版本 SHALL 以 `dirty` 為 0 寫入本機。

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

## ADDED Requirements

### Requirement: D1 卡片狀態資料表

遷移檔 `migrations/0002_card_states.sql` SHALL 建立 `card_states` 資料表：`id`（文字主鍵，卡片 id）、`state`（文字，卡片狀態去掉 `id` 與 `updatedAt` 後的 JSON）、`updated_at`（文字）、`rev`（整數），並在 `rev` 建立索引。已套用的遷移檔 0001 MUST NOT 修改。

#### Scenario: 在已有 0001 的資料庫套用

- **WHEN** 在已套用 0001 的空資料庫套用 0002
- **THEN** `card_states` 資料表存在，`task_logs` 不受影響

### Requirement: 卡片狀態同步 API

`POST /api/sync/cards` SHALL 需要登入（未登入回 401 `unauthorized`），請求為 `{ since, changes }`，回應 200 `{ cursor, changes, hasMore }`。每筆卡片狀態 SHALL 符合：`id` 為 `<內容包 id>:<v 或 p>:<代號>`（內容包 id 與代號只含小寫英數與 `-`）；`due`、`updatedAt` 為 ISO 時間；`lastReview` 為 ISO 時間或 null；`introducedOn` 為 `YYYY-MM-DD`；`state` 為 0～3 的整數；`reps`、`lapses`、`learningSteps` 為大於等於 0 的整數；`stability`、`difficulty`、`elapsedDays`、`scheduledDays` 為大於等於 0 的有限數字。`since` 為大於等於 0 的整數，`changes` 最多 500 筆；任何一項不符合 SHALL 回 400 `invalid_request` 且 MUST NOT 寫入任何資料。寫入規則與打勾紀錄相同：沒有這筆、或送來的 `updatedAt` 嚴格較新才寫入，並給它目前最大 `rev` 加 1；寫入與取回在同一個批次中完成。取回 `rev` 大於 `since` 的狀態（依 `rev` 排序、每頁 500 筆，`since` 大於最大 `rev` 時視為 0），`cursor` 為這一頁最後一筆的 `rev`（沒有新資料時等於 `since`）。

#### Scenario: 送出並取回

- **WHEN** 已登入，以 `since` 0 送出一筆合法的卡片狀態
- **THEN** 回應 200，`changes` 包含這筆狀態，`cursor` 為 1

#### Scenario: 舊狀態不覆蓋新狀態

- **WHEN** 伺服器已有 `demo:v:meeting` 的 `updatedAt` 10:05，再送來同一張卡 `updatedAt` 10:00 的狀態
- **THEN** 伺服器保留 10:05 的狀態，`rev` 不變

#### Scenario: 不合法的請求

- **WHEN** 送出的兩筆狀態中有一筆 `state` 為 7
- **THEN** 回應 400 `invalid_request`，資料表沒有變化

##### Example: 卡片狀態檢查

| 違規內容 | 結果 |
| --- | --- |
| `id` 為 `demo:x:meeting` | 400 |
| `id` 為 `Demo:v:meeting` | 400 |
| `due` 不是 ISO 時間 | 400 |
| `lastReview` 為 null | 合法 |
| `introducedOn` 為 `2026/11/16` | 400 |
| `reps` 為 -1 | 400 |
| `stability` 為字串 | 400 |
| `changes` 有 501 筆 | 400 |

### Requirement: 兩台裝置的卡片狀態一致

兩台裝置都登入並各自同步後，同一張卡的狀態 SHALL 相同，且以 `updatedAt` 較新的那一次評分為準。

#### Scenario: 手機評分、電腦同步

- **WHEN** 裝置 A 對 `demo:v:meeting` 評「良好」並同步，裝置 B 接著同步
- **THEN** 裝置 B 的 `demo:v:meeting` 狀態和裝置 A 相同，`dirty` 為 0

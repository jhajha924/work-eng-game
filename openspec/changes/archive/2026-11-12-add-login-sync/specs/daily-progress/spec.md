## MODIFIED Requirements

### Requirement: 打勾紀錄存在本機

使用者完成一個任務時，系統 SHALL 在本機資料庫 `work-eng-game` 的 `taskLogs` 資料表寫入一筆紀錄，欄位為 `id`（任務 id）、`date`、`key`、`xp`、`isMinimum`（false）、`completedAt`（完成時間）、`updatedAt`（修改時間）、`deleted`（false）與 `dirty`（1，表示尚未同步）。同一個任務重複寫入 MUST 只保留一筆。紀錄 SHALL 在重新整理頁面或重新開啟瀏覽器後仍然存在。`listLogs` SHALL 只回傳 `deleted` 為 false 的紀錄。

#### Scenario: 打勾後重新讀取

- **WHEN** 對任務 `2026-11-02:new-words` 寫入完成紀錄後重新讀取所有紀錄
- **THEN** 讀到一筆 `id` 為 `2026-11-02:new-words`、`xp` 為 10、`isMinimum` 為 false 的紀錄

#### Scenario: 重複打勾不會產生兩筆

- **WHEN** 對同一個任務連續寫入兩次完成紀錄
- **THEN** 資料表中該任務只有一筆紀錄

#### Scenario: 打勾後等待同步

- **WHEN** 對任務 `2026-11-02:new-words` 寫入完成紀錄後讀取未同步的紀錄
- **THEN** 該筆紀錄的 `dirty` 為 1、`deleted` 為 false

### Requirement: 取消打勾

使用者取消一個任務的打勾時，系統 SHALL 把該任務的紀錄標記為 `deleted` 為 true、`dirty` 為 1 並更新 `updatedAt`（墓碑），MUST NOT 直接刪除，讓刪除可以同步到其他裝置；經驗值與連勝依剩下未刪除的紀錄重新計算。任務沒有紀錄時，取消打勾 SHALL 不做任何事。再次打勾 SHALL 把同一筆紀錄改回 `deleted` 為 false。

#### Scenario: 取消後紀錄消失

- **WHEN** 任務 `2026-11-02:new-words` 已打勾，再取消打勾
- **THEN** 重新讀取時沒有該任務的紀錄

#### Scenario: 取消後留下墓碑

- **WHEN** 任務 `2026-11-02:new-words` 已打勾，再取消打勾後讀取未同步的紀錄
- **THEN** 有一筆該任務的紀錄，`deleted` 為 true、`dirty` 為 1

#### Scenario: 取消後再打勾

- **WHEN** 任務 `2026-11-02:new-words` 打勾、取消、再打勾
- **THEN** 重新讀取時有該任務的紀錄，資料表中該任務只有一筆且 `deleted` 為 false

### Requirement: 最低限度日

使用者選擇「今天只做 5 分鐘單字卡」時，系統 SHALL 寫入一筆 `id` 為 `日期:minimum`、`key` 為 `minimum`、`xp` 為 5、`isMinimum` 為 true 的紀錄；再次選擇 SHALL 依「取消打勾」的規則把該紀錄標記為已刪除。最低限度日 SHALL 算作打卡日。

#### Scenario: 標記與取消最低限度日

- **WHEN** 對 2026-11-03 標記最低限度日，接著取消
- **THEN** 標記後有一筆 `2026-11-03:minimum` 紀錄且 `isMinimum` 為 true；取消後重新讀取時該紀錄不存在

## ADDED Requirements

### Requirement: 本機資料庫升級到版本 2

本機資料庫 SHALL 升級到版本 2：`taskLogs` 以 `id` 為主鍵並建立 `date` 與 `dirty` 索引，新增以 `key` 為主鍵的 `meta` 資料表存放同步游標（`key` 為 `syncCursor`，沒有時視為 0）。從版本 1 升級時，既有紀錄 MUST 全部保留，並補上 `updatedAt` 等於 `completedAt`、`deleted` 為 false、`dirty` 為 1。

#### Scenario: 版本 1 的紀錄升級後保留

- **WHEN** 以版本 1 的結構寫入兩筆紀錄，再以版本 2 開啟同一個資料庫
- **THEN** `listLogs` 回傳這兩筆，每筆的 `updatedAt` 等於 `completedAt`、`dirty` 為 1，游標為 0

### Requirement: 修改時間只會往前走

本機每次修改一筆紀錄（打勾、取消、再打勾），`updatedAt` SHALL 為「現在」與「該筆原本的 `updatedAt` 加 1 毫秒」兩者中較晚的時間；新紀錄的 `updatedAt` 為現在。

#### Scenario: 裝置時鐘倒退

- **WHEN** 某筆紀錄的 `updatedAt` 為 2026-11-03T10:00:00.000Z，裝置時間為 2026-11-03T09:00:00.000Z 時取消打勾
- **THEN** 新的 `updatedAt` 為 2026-11-03T10:00:00.001Z

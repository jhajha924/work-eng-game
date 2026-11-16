# daily-progress Specification

## Purpose

每日進度記錄使用者完成了哪些任務，並由這些紀錄計算經驗值、連勝天數與連勝獎勵，包含最低限度日的規則與紀錄存在本機資料庫的方式；畫面呈現與跨裝置同步不在本規格範圍。

## Requirements

### Requirement: 任務經驗值

`taskXp` SHALL 依任務的 `key` 從內容包取得經驗值：`novice-N` 取新手村第 N 天的 `xp`；`minimum` 為 5；其他 `key` 取 `dailyTemplates`、`bossDayOverrides`、`lightDayTemplate` 中同 `key` 模板的 `xp`；找不到時為 0。

#### Scenario: 範例包的任務經驗值

- **WHEN** 以範例內容包查詢不同任務的經驗值
- **THEN** 結果如下表

##### Example: 任務經驗值

| key | 經驗值 |
| --- | --- |
| novice-1 | 30 |
| novice-8 | 100 |
| new-words | 10 |
| ai-talk | 20 |
| boss-battle | 100 |
| light | 10 |
| minimum | 5 |
| unknown-key | 0 |


<!-- @trace
source: add-today-tasks
updated: 2026-11-03T10:52:07+08:00
-->

---
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


<!-- @trace
source: add-login-sync
updated: 2026-11-12T16:13:07+08:00
-->

---
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


<!-- @trace
source: add-login-sync
updated: 2026-11-12T16:13:07+08:00
-->

---
### Requirement: 最低限度日

使用者選擇「今天只做 5 分鐘單字卡」時，系統 SHALL 寫入一筆 `id` 為 `日期:minimum`、`key` 為 `minimum`、`xp` 為 5、`isMinimum` 為 true 的紀錄；再次選擇 SHALL 依「取消打勾」的規則把該紀錄標記為已刪除。最低限度日 SHALL 算作打卡日。

#### Scenario: 標記與取消最低限度日

- **WHEN** 對 2026-11-03 標記最低限度日，接著取消
- **THEN** 標記後有一筆 `2026-11-03:minimum` 紀錄且 `isMinimum` 為 true；取消後重新讀取時該紀錄不存在


<!-- @trace
source: add-login-sync
updated: 2026-11-12T16:13:07+08:00
-->

---
### Requirement: 打卡日與連勝天數

排程中的某一天至少有一筆完成紀錄（含最低限度日）時，該天 SHALL 算作打卡日。`computeStats` 的連勝天數 SHALL 只看排程中的日子：不在排程中的日子 MUST NOT 中斷連勝也不計入天數。今天已打卡時，連勝為到今天為止的連續打卡日數；今天尚未打卡時，連勝為到前一個排程日為止的連續打卡日數。

#### Scenario: 以預設計畫計算連勝

- **WHEN** 以範例包、2026-11-02 開始、含新手村的排程，搭配不同的打卡日與今天日期計算
- **THEN** 連勝天數如下表

##### Example: 連勝天數

| 打卡日 | 今天 | 連勝 | 說明 |
| --- | --- | --- | --- |
| 10-24～10-30 | 10-30 | 7 | 今天已打卡 |
| 10-29、10-30、10-31、11-02 | 11-02 | 4 | 11-01 不在排程，不中斷 |
| 10-29、10-30 | 10-31 | 2 | 今天還沒打卡，算到昨天 |
| 10-28、10-30 | 10-31 | 1 | 10-29 中斷 |
| 10-29 | 10-31 | 0 | 昨天 10-30 沒打卡 |
| 無 | 10-24 | 0 | 第一天還沒打卡 |


<!-- @trace
source: add-today-tasks
updated: 2026-11-03T10:52:07+08:00
-->

---
### Requirement: 連勝獎勵

每一段連續打卡中，第 7、14、21……個打卡日 SHALL 各加 50 經驗值；連勝中斷後 SHALL 重新計數。

#### Scenario: 連續 7 天與 14 天

- **WHEN** 計算不同打卡紀錄的連勝獎勵
- **THEN** 獎勵如下表

##### Example: 連勝獎勵

| 打卡日 | 獎勵 |
| --- | --- |
| 10-24～10-30（7 天） | 50 |
| 10-24～10-31、11-02～11-07（14 個排程日） | 100 |
| 10-24～10-29（6 天） | 0 |
| 10-24～10-30、11-03～11-09（中間 10-31、11-02 未打卡，各 7 天） | 100 |


<!-- @trace
source: add-today-tasks
updated: 2026-11-03T10:52:07+08:00
-->

---
### Requirement: 總經驗值

`computeStats` 的總經驗值 SHALL 等於所有紀錄 `xp` 的總和，加上連勝獎勵。今天之後日期的紀錄 MUST NOT 計入。

#### Scenario: 經驗值加總

- **WHEN** 紀錄為 2026-10-24～10-30 新手村每天一個任務（30、30、20、20、30、20、30），今天為 10-30
- **THEN** 總經驗值為 180 加上連勝獎勵 50，共 230


<!-- @trace
source: add-today-tasks
updated: 2026-11-03T10:52:07+08:00
-->

---
### Requirement: 今天日期依裝置本機時區

`localToday` SHALL 以裝置本機時區的年、月、日組成 YYYY-MM-DD，MUST NOT 使用 UTC 日期。

#### Scenario: 不同時區的今天

- **WHEN** 現在時間為 2026-10-31T16:30:00Z
- **THEN** 本機時區為 Asia/Taipei 時回傳 2026-11-01；本機時區為 America/New_York 時回傳 2026-10-31

<!-- @trace
source: add-today-tasks
updated: 2026-11-03T10:52:07+08:00
-->

---
### Requirement: 本機資料庫升級到版本 2

本機資料庫 SHALL 升級到版本 2：`taskLogs` 以 `id` 為主鍵並建立 `date` 與 `dirty` 索引，新增以 `key` 為主鍵的 `meta` 資料表存放同步游標（`key` 為 `syncCursor`，沒有時視為 0）。從版本 1 升級時，既有紀錄 MUST 全部保留，並補上 `updatedAt` 等於 `completedAt`、`deleted` 為 false、`dirty` 為 1。

#### Scenario: 版本 1 的紀錄升級後保留

- **WHEN** 以版本 1 的結構寫入兩筆紀錄，再以版本 2 開啟同一個資料庫
- **THEN** `listLogs` 回傳這兩筆，每筆的 `updatedAt` 等於 `completedAt`、`dirty` 為 1，游標為 0

<!-- @trace
source: add-login-sync
updated: 2026-11-12T16:13:07+08:00
-->

---
### Requirement: 修改時間只會往前走

本機每次修改一筆紀錄（打勾、取消、再打勾），`updatedAt` SHALL 為「現在」與「該筆原本的 `updatedAt` 加 1 毫秒」兩者中較晚的時間；新紀錄的 `updatedAt` 為現在。

#### Scenario: 裝置時鐘倒退

- **WHEN** 某筆紀錄的 `updatedAt` 為 2026-11-03T10:00:00.000Z，裝置時間為 2026-11-03T09:00:00.000Z 時取消打勾
- **THEN** 新的 `updatedAt` 為 2026-11-03T10:00:00.001Z

<!-- @trace
source: add-login-sync
updated: 2026-11-12T16:13:07+08:00
-->
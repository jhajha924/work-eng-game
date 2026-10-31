# plan-scheduling Specification

## Purpose

計畫排程把一個或多個內容包排進使用者設定的日期區間，產生每週主題與每天任務。本規格涵蓋長度換算、週數分配、頭目戰週、新手村、輕量日與純函式性質；延長計畫與排程的儲存不在本規格範圍。

## Requirements

### Requirement: 計畫長度換算

`buildSchedule` SHALL 依計畫設定換算總週數：月數 6、9、12、18 分別為 26、39、52、78 週；自訂結束日時，總週數為（結束日 − 開始日 ＋ 1 天）除以 7 取整數。排程結束日 SHALL 為開始日 ＋ 總週數 × 7 − 1 天。結束日早於開始日時 MUST 丟出 `END_BEFORE_START`；日期字串不是合法的 YYYY-MM-DD 時 MUST 丟出 `INVALID_DATE`。

#### Scenario: 月數與自訂結束日換算

- **WHEN** 以開始日 2026-11-02 和不同長度呼叫 `buildSchedule`
- **THEN** 總週數與結束日如下表

##### Example: 長度換算

| 長度設定 | 總週數 | 結束日 |
| --- | --- | --- |
| 6 個月 | 26 | 2027-05-02 |
| 9 個月 | 39 | 2027-08-01 |
| 12 個月 | 52 | 2027-10-31 |
| 結束日 2027-04-28 | 25 | 2027-04-25 |
| 結束日 2026-10-30 | 錯誤 END_BEFORE_START | — |


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 開始日必須是星期一

`buildSchedule` SHALL 只接受星期一作為開始日；其他日子 MUST 丟出 `START_NOT_MONDAY`。

#### Scenario: 開始日不是星期一

- **WHEN** 開始日為 2026-11-04（星期三）
- **THEN** 丟出 `PlanError`，`code` 為 `START_NOT_MONDAY`


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 內容包週數分配

`allocateWeeks` SHALL 依內容包順序分配總週數：剩餘週數小於等於本包建議週數、本包是最後一包、或剩餘週數扣掉本包建議週數後少於下一包最少週數時，本包拿走全部剩餘週數；否則本包拿建議週數，剩下的交給下一包。沒有內容包時 MUST 丟出 `NO_PACKS`；任一內容包未通過結構檢查，或多個內容包的 `id` 重複時，MUST 丟出 `INVALID_PACK`。

#### Scenario: 一包與兩包的分配

- **WHEN** 以範例包 A（建議 26、最少 20）與測試用內容包 B（建議 26、最少 20）分配
- **THEN** 各包週數如下表

##### Example: 跨包分配

| 內容包 | 總週數 | A 週數 | B 週數 |
| --- | --- | --- | --- |
| 只有 A | 26 | 26 | — |
| 只有 A | 39 | 39 | — |
| A、B | 39 | 39 | 0（不排） |
| A、B | 52 | 26 | 26 |
| A、B | 78 | 26 | 52 |


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 關卡週數拉長與壓縮

一個內容包分到的週數 SHALL 依最大餘數法分配到各關。拉長時多出的週數依 `stretchWeight` 比例分配，小數相同時權重高者優先、再相同則關卡順序在前者優先。壓縮時少掉的週數依各關可壓縮量（建議週數 − 最少週數）比例扣除，小數相同時權重低者優先扣、再相同則關卡順序在後者優先扣。少掉的週數超過可壓縮量總和時 MUST 丟出 `PLAN_TOO_SHORT`。

#### Scenario: 範例包的拉長與壓縮

- **WHEN** 範例包（各關建議 4、5、4、4、5、4，最少 3、4、3、3、4、3，權重 1、1、1、2、2、1）分到不同週數
- **THEN** 各關週數如下表

##### Example: 關卡週數

| 分到週數 | 各關週數 | 說明 |
| --- | --- | --- |
| 26 | 4、5、4、4、5、4 | 建議值 |
| 39 | 6、7、6、7、8、5 | 多 13 週 |
| 22 | 3、4、3、4、5、3 | 少 4 週，權重 1 的關卡由後往前各扣 1 |
| 20 | 3、4、3、3、4、3 | 全部最少值 |
| 19 | 錯誤 PLAN_TOO_SHORT | 低於最少值總和 |


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 週主題對應與頭目戰週

每一關的最後一週 SHALL 是頭目戰週（`isBoss = true`），使用該關最後一個週主題。其餘 N 週對應 T 個一般週主題：第 j 週（從 0 起算）涵蓋索引 floor(j×T÷N) 起、到 max(floor(j×T÷N)＋1, floor((j＋1)×T÷N)) 為止（不含）的主題。每個一般週主題 SHALL 至少出現在一週，MUST NOT 被跳過。

#### Scenario: 預設 6 個月的頭目戰週

- **WHEN** 範例包、開始日 2026-11-02、6 個月
- **THEN** 頭目戰週為第 4、9、13、17、22、26 週，且第 15 週的開始日為 2027-02-08

#### Scenario: 拉長時主題重複、壓縮時主題合併

- **WHEN** 一關有 3 個一般週主題，分別分到 5 週與 3 週
- **THEN** 5 週時一般週依序對應主題 [0]、[0]、[1]、[2]，再加頭目戰週；3 週時一般週對應 [0]、[1, 2]，再加頭目戰週


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 每日任務產生

正式期的每一天 SHALL 依「週的第幾天」（星期一為 0）取 `dailyTemplates` 的任務；頭目戰週中 `bossDayOverrides` 有定義的那幾天 SHALL 改用覆寫任務。每個任務的 `id` SHALL 為 `日期:key`，同一天內不重複。

#### Scenario: 頭目戰週的星期五

- **WHEN** 範例包、6 個月，查詢第 4 週星期五 2026-11-27
- **THEN** 該天的任務是 `bossDayOverrides["4"]`，`id` 為 `2026-11-27:` 加上該任務的 `key`


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 新手村前置

`includeNovice` 為 true 時，排程 SHALL 在正式期前加入新手村：內容包有 N 天新手村，就排 N 天，最後一天是開始日前的星期六，每天一個任務（`key` 為 `novice-<第幾天>`，`kind` 為 `novice`，`weekIndex` 為 null）。`includeNovice` 為 false 時 MUST NOT 產生新手村日。

#### Scenario: 預設新手村日期

- **WHEN** 範例包、開始日 2026-11-02、含新手村
- **THEN** 新手村為 2026-10-24 到 2026-10-31 共 8 天，2026-11-01 不在排程中


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 輕量日

正式期星期一到星期五（第 0～4 天）的日期落在任一輕量區間內（含頭尾）時，該天 SHALL 只有 `lightDayTemplate` 一個任務，且 `isLight = true`；輕量 SHALL 優先於頭目戰覆寫。週末 MUST NOT 受輕量區間影響。

#### Scenario: 春節輕量區間

- **WHEN** 輕量區間為 2027-02-04 到 2027-02-10
- **THEN** 2027-02-04、02-05、02-08、02-09、02-10 只有輕量任務；2027-02-06、02-07（週末）維持原本任務


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 排程是純函式

`buildSchedule` 與 `allocateWeeks` SHALL 不修改輸入的內容包與設定，且相同輸入 SHALL 產生完全相同的輸出；結果 MUST NOT 依賴執行當下的系統時間或時區。

#### Scenario: 重複呼叫結果相同

- **WHEN** 以凍結（Object.freeze 深層凍結）的內容包與設定連續呼叫兩次 `buildSchedule`
- **THEN** 不丟出錯誤，兩次結果深度相等

<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->
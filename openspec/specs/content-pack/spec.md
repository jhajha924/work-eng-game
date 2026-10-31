# content-pack Specification

## Purpose

內容包是不含日期的學習內容：新手村、關卡與週主題、每日任務模板。本規格定義內容包的資料格式、結構檢查規則，以及公開範例包與私人包的存放界線；排程計算不在本規格範圍。

## Requirements

### Requirement: 內容包結構

內容包 SHALL 包含 `id`、`name`、`version`、`novice`、`levels`、`dailyTemplates`、`bossDayOverrides`、`lightDayTemplate` 欄位。每一關 SHALL 有 `weeks` 週主題陣列，陣列長度即建議週數，最後一個週主題 SHALL 是該關的頭目戰週。內容包 MUST NOT 含任何日期。

#### Scenario: 完整的內容包通過檢查

- **WHEN** 以符合所有欄位規則的內容包呼叫 `validatePack`
- **THEN** 回傳 `{ ok: true }`


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 結構檢查回報錯誤

`validatePack` SHALL 一次回報所有違規項目，MUST NOT 在第一個錯誤就停止。檢查規則：`id` 非空字串；`novice` 每個元素都有非空的 `title`、`description`、`icon` 與數字 `xp`；至少一關；每關的 `id`、`name` 非空且同一包內 `id` 不重複；每關 `weeks` 至少 2 個，每個週主題都有非空的 `title` 與字串 `focus`、`vocabCategory`；`minWeeks` 介於 2 與 `weeks.length` 之間；`stretchWeight` 大於 0；`dailyTemplates` 恰好 7 個且 `key` 不重複；`bossDayOverrides` 的鍵只能是 "0" 到 "6"；`lightDayTemplate` 必須存在；所有任務模板的 `minutes` 大於 0。

#### Scenario: 多個錯誤同時回報

- **WHEN** 內容包的 `dailyTemplates` 只有 6 個，且某一關 `minWeeks` 大於週主題數
- **THEN** 回傳 `{ ok: false }`，`errors` 同時包含這兩項錯誤

##### Example: 各種違規

| 違規內容 | 結果 |
| --- | --- |
| `id` 為空字串 | ok: false |
| `levels` 為空陣列 | ok: false |
| 某關 `weeks` 只有 1 個 | ok: false |
| 某關 `minWeeks` 為 1 | ok: false |
| `stretchWeight` 為 0 | ok: false |
| `bossDayOverrides` 有鍵 "7" | ok: false |
| 輸入不是物件（例如 null） | ok: false |
| `novice` 含 null 元素 | ok: false |
| 某關 `weeks` 含 null 元素 | ok: false |
| 兩關 `id` 相同 | ok: false |


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 公開範例內容包

版本庫 SHALL 提供範例內容包 `meeting-a2-b1-sample`，結構與原半年計畫相同：新手村 8 天、6 關、各關週數依序為 4、5、4、4、5、4（共 26 週）。範例包的文字 MUST NOT 含真實姓名、公司名稱、工作數據，或個人求職資訊（個人求職動機、期望薪資、離職資訊）；通用的面試英文練習（例如模擬面試、STAR 架構）不在此限。

#### Scenario: 範例包可直接使用

- **WHEN** 以範例內容包呼叫 `validatePack`
- **THEN** 回傳 `{ ok: true }`，且新手村 8 天、6 關、週數合計 26

#### Scenario: 範例包不含個人資訊

- **WHEN** 檢查範例內容包的所有文字
- **THEN** 不出現任何禁用字詞。禁用字詞由兩部分組成：測試中公開的通用清單（個人求職動機與薪資相關用語，例如「換工作」「期望薪資」「salary」「notice period」），以及本機 `content/packs/private/forbidden-terms.json` 的個人字詞清單（檔案存在時才檢查，避免把個人字詞寫進公開的測試檔）


<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->

---
### Requirement: 私人內容包不進版本庫

私人內容包 SHALL 存放在 `content/packs/private/` 底下，該資料夾 MUST 被 `.gitignore` 排除。匯出腳本 SHALL 讀取原計畫的 Python 資料檔，輸出符合內容包格式的 JSON。

#### Scenario: 匯出私人內容包

- **WHEN** 在本機以原計畫資料檔路徑執行匯出腳本
- **THEN** 產生 `content/packs/private/meeting-a2-b1/pack.json`，內容通過 `validatePack`，且 git 不會追蹤此檔案

<!-- @trace
source: add-plan-engine
updated: 2026-10-31T23:00:50+08:00
-->
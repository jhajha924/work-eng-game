## MODIFIED Requirements

### Requirement: 內容包結構

<!-- BEFORE: 任務模板只有 key、title、minutes，沒有經驗值 -->

內容包 SHALL 包含 `id`、`name`、`version`、`novice`、`levels`、`dailyTemplates`、`bossDayOverrides`、`lightDayTemplate` 欄位。每一關 SHALL 有 `weeks` 週主題陣列，陣列長度即建議週數，最後一個週主題 SHALL 是該關的頭目戰週。每個任務模板（`dailyTemplates`、`bossDayOverrides`、`lightDayTemplate` 的元素）SHALL 包含 `key`、`title`、`minutes`、`xp`，`xp` 是完成該任務得到的經驗值。內容包 MUST NOT 含任何日期。

#### Scenario: 完整的內容包通過檢查

- **WHEN** 以符合所有欄位規則的內容包呼叫 `validatePack`
- **THEN** 回傳 `{ ok: true }`

### Requirement: 結構檢查回報錯誤

<!-- BEFORE: 任務模板只檢查 key、title 非空與 minutes 大於 0 -->

`validatePack` SHALL 一次回報所有違規項目，MUST NOT 在第一個錯誤就停止。檢查規則：`id` 非空字串；`novice` 每個元素都有非空的 `title`、`description`、`icon` 與數字 `xp`；至少一關；每關的 `id`、`name` 非空且同一包內 `id` 不重複；每關 `weeks` 至少 2 個，每個週主題都有非空的 `title` 與字串 `focus`、`vocabCategory`；`minWeeks` 介於 2 與 `weeks.length` 之間；`stretchWeight` 大於 0；`dailyTemplates` 恰好 7 個且 `key` 不重複；`bossDayOverrides` 的鍵只能是 "0" 到 "6"；`lightDayTemplate` 必須存在；所有任務模板的 `minutes` 大於 0，且 `xp` 是大於等於 0 的整數。

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
| 某個任務模板 `xp` 為 -1 | ok: false |
| 某個任務模板 `xp` 為 1.5 | ok: false |
| 某個任務模板缺少 `xp` | ok: false |

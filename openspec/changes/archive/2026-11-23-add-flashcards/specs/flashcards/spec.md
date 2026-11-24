## Purpose

間隔重複單字卡：由內容包產生卡片牌組、以 FSRS 排程每張卡的下次複習時間、組出每日複習佇列、單字卡頁的複習流程，以及卡片狀態與複習紀錄的本機儲存；卡片狀態的跨裝置同步規則在 cloud-sync 規格。

## ADDED Requirements

### Requirement: 卡片牌組

純函式 `buildDeck(pack)` SHALL 依內容包的 `vocab` 與 `patterns` 產生卡片陣列，順序為所有單字（依類別、類別內順序）在前、所有句型（依情境、情境內順序）在後。每張卡片為 `{ id, kind, en, zh, example?, group }`：單字的 `kind` 為 `word`、`group` 為類別；句型的 `kind` 為 `pattern`、`group` 為情境。卡片 id SHALL 為 `<內容包 id>:<v 或 p>:<代號>`，代號由英文轉小寫、把連續的非英數字元換成一個 `-`、再去掉頭尾的 `-` 而得。內容包沒有 `vocab` 與 `patterns` 時 SHALL 回傳空陣列。

#### Scenario: 單字與句型都轉成卡片

- **WHEN** 內容包 id 為 `demo`，`vocab` 有一類「A 會議流程」含 `follow up`，`patterns` 有一個情境含 `Shall we get started?`
- **THEN** 回傳兩張卡，id 依序為 `demo:v:follow-up` 與 `demo:p:shall-we-get-started`

##### Example: 代號轉換

| 英文 | 代號 |
| --- | --- |
| `meeting` | `meeting` |
| `follow up` | `follow-up` |
| `Shall we get started?` | `shall-we-get-started` |
| `Today I'd like to talk about…` | `today-i-d-like-to-talk-about` |
| `Q3 KPI` | `q3-kpi` |

### Requirement: FSRS 評分

`reviewCard(cardId, state, rating, now)` SHALL 用 ts-fsrs 5.4.2 的預設參數、關閉隨機擾動（`enable_fuzz` 為 false）計算新的卡片狀態，並回傳 `{ state, log }`。`state` 為 null 時視為新卡，新狀態的 `introducedOn` SHALL 為 `now` 的本地日期；不是新卡時 `introducedOn` 保持原值。`rating` 為 1（重來）、2（困難）、3（良好）、4（簡單）。新狀態的 `updatedAt` SHALL 為 `now` 與原本 `updatedAt` 加 1 毫秒兩者較晚者。相同的輸入 MUST 得到相同的結果。

#### Scenario: 新卡評「良好」

- **WHEN** 對新卡在 2026-11-16 09:00（本地時間）評「良好」
- **THEN** 新狀態的 `reps` 為 1、`introducedOn` 為 `2026-11-16`、`due` 晚於 `now`，回傳的紀錄 `rating` 為 3

#### Scenario: 評「重來」比評「簡單」更早到期

- **WHEN** 同一個狀態分別評「重來」與「簡單」
- **THEN** 「重來」的 `due` 早於「簡單」的 `due`

#### Scenario: 結果可重現

- **WHEN** 以相同的狀態、評分與時間呼叫兩次
- **THEN** 兩次回傳的狀態完全相同

### Requirement: 每日複習佇列

純函式 `buildQueue(deck, states, { now, today, weekCategory, newLimit })` SHALL 回傳今天要複習的卡片，順序為：

1. 已到期的卡：有狀態且 `due` 不晚於 `now`，依 `due` 由早到晚。
2. 提前學習的卡：狀態為學習中或重新學習中，且 `due` 在 `now` 之後 20 分鐘內，依 `due` 由早到晚。
3. 新卡：沒有狀態的卡，張數上限為 `newLimit` 減去 `introducedOn` 等於 `today` 的狀態數（最少 0）；先取 `group` 等於 `weekCategory` 的單字卡，再依牌組順序取其餘的新卡。

狀態對應不到牌組中任何卡片時 MUST 忽略。`weekCategory` 由 `weekCategoryFor(pack, todayView)` 決定：今天所在週第一個週主題的 `vocabCategory` 去掉結尾的「（進階）」；新手村期間為內容包第一個單字類別；沒有對應的單字類別時為 null。

#### Scenario: 到期卡在前、新卡在後

- **WHEN** 有一張 `due` 為昨天的卡、一張 `due` 為明天的卡，以及 3 張新卡，`newLimit` 為 15
- **THEN** 佇列依序為昨天到期的卡與 3 張新卡，明天到期的卡不在佇列中

#### Scenario: 每天新卡上限

- **WHEN** `newLimit` 為 15，今天已有 12 張卡的 `introducedOn` 等於今天，還有 10 張新卡
- **THEN** 佇列中只有 3 張新卡

#### Scenario: 本週類別的新卡優先

- **WHEN** 牌組依序有「新手村 30 字」的 2 張新卡與「A 會議流程」的 2 張新卡，`weekCategory` 為「A 會議流程」
- **THEN** 新卡順序為「A 會議流程」的 2 張，再來是「新手村 30 字」的 2 張

#### Scenario: 剛評「重來」的卡會在 20 分鐘內回來

- **WHEN** 一張學習中的卡 `due` 為 `now` 之後 10 分鐘
- **THEN** 它在佇列中，排在已到期的卡之後、新卡之前

##### Example: 本週類別

| 今天所在週第一個週主題的 vocabCategory | 內容包單字類別 | weekCategory |
| --- | --- | --- |
| `A 會議流程` | 含 `A 會議流程` | `A 會議流程` |
| `A 會議流程（進階）` | 含 `A 會議流程` | `A 會議流程` |
| `複習 A、B、F` | 不含 | null |
| （新手村期間） | 第一類為 `新手村 30 字` | `新手村 30 字` |

### Requirement: 卡片狀態的本機儲存

本機資料庫 SHALL 升級到版本 3，新增 `cardStates`（主鍵為卡片 id，索引 `due`、`dirty`）與 `reviewLogs`（主鍵為 `<卡片 id>@<複習時間>`，索引 `cardId`、`reviewedAt`），`taskLogs` 與 `meta` 的資料 MUST 保留不變。評分時 SHALL 在同一個交易內寫入新的卡片狀態（`dirty` 為 1）與一筆複習紀錄。卡片狀態 MUST NOT 被刪除。

#### Scenario: 從版本 2 升級

- **WHEN** 版本 2 的資料庫有 2 筆打勾紀錄與同步游標，以版本 3 開啟
- **THEN** 2 筆打勾紀錄與游標都還在，`cardStates`、`reviewLogs` 為空

#### Scenario: 評分寫入狀態與紀錄

- **WHEN** 對卡片 `demo:v:meeting` 評「良好」
- **THEN** `cardStates` 有這張卡的狀態且 `dirty` 為 1，`reviewLogs` 多一筆 `cardId` 為 `demo:v:meeting`、`rating` 為 3 的紀錄

### Requirement: 單字卡頁

網址 hash 為 `#/cards` 時 SHALL 顯示單字卡頁，其他 hash 顯示今日任務頁。單字卡頁上方 SHALL 有「回今日任務」連結與「今天還有 N 張」（N 為佇列長度）。佇列有卡時顯示第一張的正面：中文，以及單字的類別或句型的情境，下方為「翻面」按鈕；按下後顯示英文、例句（有才顯示）與「重來」「困難」「良好」「簡單」四個按鈕；評分後 SHALL 以新的狀態重算佇列並顯示下一張的正面。佇列清空時顯示「今天的單字卡已完成！」；牌組沒有卡片時顯示「這個內容包沒有單字卡」；本機資料庫無法存取時顯示「無法存取本機資料庫，單字卡進度無法儲存」且不顯示卡片。評分寫入成功後 SHALL 通知同步排程（和打勾相同）。按鈕的可點區域 SHALL 至少 44×44px，評分中 MUST 停用評分按鈕以免連點。

#### Scenario: 翻面後評分

- **WHEN** 單字卡頁顯示第一張新卡的正面，使用者按「翻面」再按「簡單」
- **THEN** 顯示下一張卡的正面，「今天還有 N 張」減 1

#### Scenario: 學習中的卡留在今天的佇列

- **WHEN** 使用者對一張新卡評「重來」
- **THEN** 這張卡仍在佇列中（20 分鐘內到期），「今天還有 N 張」不變

#### Scenario: 今天清空

- **WHEN** 佇列只剩一張卡，使用者翻面並按「簡單」
- **THEN** 顯示「今天的單字卡已完成！」

#### Scenario: 重新整理後進度保留

- **WHEN** 評完 3 張新卡後重新整理單字卡頁
- **THEN** 那 3 張不再以新卡出現，今天還能學的新卡數少 3

## 1. 內容包的單字與句型（D1）

- [x] 1.1 實作 content-pack 規格「內容包結構」與「結構檢查回報錯誤」的新欄位（D1 內容包新增選填的 vocab 與 patterns）：src/plan/types.ts 的 `ContentPack` 加上選填的 `vocab`、`patterns` 型別；新增 src/cards/deck.ts 的 `cardSlug(en)`（D2 代號規則）；src/plan/validatePack.ts 檢查新欄位與代號重複、代號為空。驗證：src/plan/validatePack.test.ts 涵蓋「沒有單字與句型的內容包仍然有效」與 Example「各種違規」新增的 5 列；src/cards/deck.test.ts 涵蓋 Example「代號轉換」5 列。 <!-- speclink-task:tsk_01M7HF91MRJKYM5CS4TFG1NR9M -->
- [x] 1.2 公開範例包與私人包的單字內容（D1）：content/packs/meeting-a2-b1-sample/pack.json 加入 9 類各 10 個通用單字（各附例句）與 3 個情境各 4 句通用句型，類別名稱和範例包週主題的 `vocabCategory` 相同；scripts/export_private_pack.py 把原計畫 `VOCAB`、`PATTERNS` 轉成 `vocab`、`patterns`（空例句不輸出；重複的單字只保留第一次出現的並印出略過清單）。驗證：src/plan/samplePack.test.ts 涵蓋情境「公開範例包附範例單字與句型」（9 類×10、3 情境×4、通過 `validatePack`）且禁用字詞測試通過；使用者在本機重新執行匯出指令稿後，私人包結構檢查測試通過（211 字、62 句，略過 4 個重複字）。 <!-- speclink-task:tsk_01M7HF91MRCRTNSN490B7Z3GTN -->

## 2. 牌組、FSRS 與每日佇列（D2、D4、D5）

- [x] 2.1 實作 flashcards 規格「卡片牌組」（D2 卡片 id 由內容包 id、種類與英文代號組成；D3 卡片正面中文、背面英文）：src/cards/types.ts 定義 `Card`、`CardState`、`ReviewLog`；src/cards/deck.ts 的 `buildDeck(pack)` 依單字在前、句型在後產生卡片。驗證：src/cards/deck.test.ts 涵蓋情境「單字與句型都轉成卡片」（`demo:v:follow-up`、`demo:p:shall-we-get-started`）與沒有單字時回傳空陣列。 <!-- speclink-task:tsk_01M7HF91MRW4A8S4N8KCDYXZGJ -->
- [x] 2.2 實作 flashcards 規格「FSRS 評分」（D4 FSRS 用 ts-fsrs 5.4.2，關閉隨機擾動）：安裝 ts-fsrs@5.4.2（package.json 固定版本）；src/cards/fsrs.ts 的 `reviewCard(cardId, state, rating, now)` 回傳 `{ state, log }`，新卡記錄 `introducedOn`，`updatedAt` 用 `nextUpdatedAt`。驗證：src/cards/fsrs.test.ts 涵蓋情境「新卡評良好」「評重來比評簡單更早到期」「結果可重現」。 <!-- speclink-task:tsk_01M7HF91MRVPM9YJBKGQFD7315 -->
- [x] 2.3 實作 flashcards 規格「每日複習佇列」（D5 每日佇列：到期複習卡在前，新卡在後，每天最多 15 張新卡）：src/cards/queue.ts 的 `buildQueue(deck, states, options)` 與 `weekCategoryFor(pack, todayView)`。驗證：src/cards/queue.test.ts 涵蓋情境「到期卡在前、新卡在後」「每天新卡上限」「本週類別的新卡優先」「剛評重來的卡會在 20 分鐘內回來」、忽略對應不到牌組的狀態，以及 Example「本週類別」4 列。 <!-- speclink-task:tsk_01M7HF91MRDNYFT6F8AW3832S7 -->

## 3. 本機儲存（D6）

- [x] 3.1 實作 flashcards 規格「卡片狀態的本機儲存」（D6 本機資料庫版本 3 新增 cardStates 與 reviewLogs）：src/progress/db.ts 定義版本 3；src/cards/cardRepo.ts 提供 `listStates()`、`saveReview(state, log)`（同一交易寫入狀態與紀錄）、`pendingChanges()`、`getCursor()`、`applySyncResult(sent, remote, cursor)`（游標 key `cardSyncCursor`）。驗證：src/cards/cardRepo.test.ts 在 fake-indexeddb 上涵蓋情境「從版本 2 升級」「評分寫入狀態與紀錄」，以及送出後又評分的卡保持 `dirty` 1。 <!-- speclink-task:tsk_01M7HF91MRVSHM3NX9KN55FBNT -->

## 4. 伺服器與同步（D7）

- [x] 4.1 實作 cloud-sync 規格「D1 卡片狀態資料表」與「卡片狀態同步 API」（D7 卡片狀態用獨立的同步 API 與游標）：新增 migrations/0002_card_states.sql；worker/cards/validate.ts 檢查請求；worker/cards/cardSyncRepo.ts 的 UPSERT 與 PULL；worker/cards/routes.ts 掛在 `/api/sync/cards` 並套用登入檢查（worker/app.ts）。驗證：worker/cards/validate.test.ts 涵蓋 Example「卡片狀態檢查」8 列；worker/cards/cardSyncRepo.test.ts 涵蓋「送出並取回」「舊狀態不覆蓋新狀態」；worker/app.test.ts 涵蓋未登入 401、「不合法的請求」資料表不變、套用 0002 後 `card_states` 存在。 <!-- speclink-task:tsk_01M7HF91MRAQRFMFVCDGGD53QR -->
- [x] 4.2 實作 cloud-sync 規格「同步用戶端的結果」「本機合併規則」的兩階段同步與「兩台裝置的卡片狀態一致」（D7）：src/sync/merge.ts 的 `mergeRemote` 改為通用型別；src/sync/syncClient.ts 的 `syncOnce()` 先同步打勾紀錄、成功後同步卡片狀態，合併 `received`；src/sync/syncController.ts 的 `hasPending` 一併檢查卡片狀態。驗證：src/sync/syncClient.test.ts 涵蓋情境「先打勾紀錄、再卡片狀態」「打勾紀錄失敗就不同步卡片狀態」，既有的「各種結果」「不合格的紀錄不擋住同步」「離線時不發請求」仍通過；worker/cards/twoDevices.test.ts 以兩個本機資料庫與 sqliteD1 涵蓋「手機評分、電腦同步」。 <!-- speclink-task:tsk_01M7HF91MRNB5TMEBYB3V26BEZ -->

## 5. 畫面（D3、D8）

- [x] 5.1 實作 flashcards 規格「單字卡頁」（D8 前端用網址 hash 切換頁面；D3）：src/app/useHashRoute.ts 監聽 `hashchange`；src/App.tsx 依 hash 顯示今日任務頁或單字卡頁；src/cards/useFlashcards.ts 讀取狀態、算佇列、評分（寫入成功後呼叫同步排程，評分中停用按鈕）；src/cards/CardsPage.tsx 與 src/cards/CardsPage.css 顯示正面、翻面、四個評分按鈕、完成與錯誤訊息，按鈕至少 44×44px。驗證：`npm run lint`、`npm run build` 通過；手動驗收 6.2 確認情境「翻面後評分」「學習中的卡留在今天的佇列」「今天清空」「重新整理後進度保留」。 <!-- speclink-task:tsk_01M7HF91MR7FY0FZSDFBTJZJRW -->
- [x] 5.2 實作 today-page 規格「單字卡入口」（D8）：src/app/TodayPage.tsx 在「今天的任務」區塊顯示「複習單字卡（今天 N 張）」或「複習單字卡（今天已完成）」，牌組沒有卡片時不顯示；src/app/TodayPage.css 讓連結至少 44×44px。驗證：佇列張數與文字由 src/cards/queue.test.ts 的 `todayEntryLabel(queueLength, deckSize)` 測試涵蓋三種文字；手動驗收 6.2 確認情境「顯示今天的張數」「從單字卡頁回來後張數更新」。 <!-- speclink-task:tsk_01M7HF91MRHRA7GPBF77ASQH3D -->

## 6. 文件與驗收

- [x] 6.1 撰寫學習筆記 docs/learning-notes/04-單字卡與FSRS.md（間隔重複、FSRS 的穩定度與難度、卡片 id 設計、每日佇列、兩種資料的同步），並在 docs/專案規範.md 補上：固定版本的第三方演算法套件升級要另開提案並以測試確認結果。驗證：內容審查，學習筆記五個段落齊全且不含個人資訊。 <!-- speclink-task:tsk_01M7HF91MRR9CA92AFRAR5XYQZ -->
- [x] [M] 6.2 使用者本機驗收：`npx wrangler d1 migrations apply work-eng-game --local`；重新執行 `python scripts/export_private_pack.py <原計畫路徑>` 後 `npm test`、`npm run lint`、`npm run build` 通過；`npm run dev` 後從今日任務頁進入單字卡頁，翻面、評分、評「重來」後卡片留在佇列、清空後看到完成訊息、重新整理後進度保留、回今日任務張數更新；Chrome 與 Edge 登入後互相看到相同的卡片進度。驗證：截圖回報。 <!-- speclink-task:tsk_01M7HF91MRRRY22YA02HG2PSMN -->
- [x] [M] 6.3 使用者部署驗收：`npx wrangler d1 migrations apply work-eng-game --remote`，再 commit、push；GitHub Actions 成功後，在電腦與手機打開正式網站，一邊評分、另一邊同步後看到相同的待複習張數。驗證：截圖回報。 <!-- speclink-task:tsk_01M7HF91MRV90993KN8HNKFAG4 -->

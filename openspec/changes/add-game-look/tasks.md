## 1. 素材與授權（D2、D7、D9）

- [ ] [M] 1.1 使用者挑選背景音樂一首：到 incompetech.com（CC BY 4.0）或 opengameart.org（只挑標示 CC0 的曲子）試聽，選一首輕鬆、可循環、不搶戲的曲子，回報曲名、曲目頁網址與頁面上的授權文字截圖。驗證：回報內容包含曲名、網址與授權，授權屬於 CC BY 4.0 或 CC0。 <!-- speclink-task:tsk_01M85W07R22DA9TRQ60ZTPCRHQ -->
- [ ] 1.2 下載圖片素材（D2 圖片用 Fluent Emoji 3D PNG）：從 microsoft/fluentui-emoji 取得 design.md 列出的 16 個表情的 3D PNG，存成 public/assets/emoji/ 下的代號檔名；資料夾不存在時換最接近的表情；合計超過 1.5 MB 時用 Pillow 縮成 128×128；MIT 授權全文存成 public/licenses/fluent-emoji-LICENSE.txt；src/game/emojiAssets.ts 的 `emojiAsset(char)` 提供對照，src/game/Emoji.tsx 依字元顯示圖片、找不到時顯示 emoji 文字。驗證：src/game/emojiAssets.test.ts 確認對照表每個檔案都存在、未知字元回傳 null；記下全部圖檔的總大小。 <!-- speclink-task:tsk_01M85W07R2RA82QCVB3R0CMX1P -->
- [ ] 1.3 下載音效素材（D7 音效檔格式統一成 MP3）：從 Kenney Interface Sounds 挑出 check、uncheck、flip、correct、wrong、click 六個音效，從 Kenney Music Jingles 挑出 clear 樂句；只有 Ogg 時以 npx 執行 ffmpeg-static 轉成 MP3；存成 public/assets/sounds/ 下以音效名稱命名的 MP3，每個不超過 100 KB。驗證：七個檔案都存在且大小在限制內（列出檔名與大小），本機 `npm run dev` 時在瀏覽器分別播放確認有聲音。 <!-- speclink-task:tsk_01M85W07R21H3YD5KD58TEVBJ8 -->
- [ ] 1.4 背景音樂與授權清單（D9 製作名單頁與授權紀錄）：依 1.1 使用者的選擇下載 MP3 存成 public/assets/music/bgm.mp3（不超過 5 MB）；src/app/credits.ts 列出 Fluent Emoji、Kenney 音效、粉圓 Huninn、背景音樂四組素材（名稱、作者、來源網址、授權名稱與網址、用途、CC BY 的完整標註文字）；docs/素材授權.md 記錄同樣資訊與每個檔案的原始檔名、是否轉檔或縮圖。驗證：src/app/credits.test.ts 確認每一項欄位非空、授權屬於 CC0 1.0、MIT、SIL OFL 1.1、CC BY 4.0，CC BY 項目有標註文字；docs/素材授權.md 內容審查。 <!-- speclink-task:tsk_01M85W07R2NWAJ35ASRHERRZRG -->

## 2. 卡通主題（D1、D8）

- [ ] 2.1 實作 game-feel 規格「卡通主題與字體」（D1 主題用 CSS 變數，字體用 Google Fonts 載入粉圓；D8 動畫用 Motion，彩帶用 canvas-confetti，版本固定）：安裝 motion@14.11.1、canvas-confetti@1.9.4、@types/canvas-confetti@1.9.0（package.json 不用 ^）；src/index.css 定義主題變數、天空漸層背景、圓角卡片、`.game-button` 立體按鈕（深色模式各一份，按下位移放在 prefers-reduced-motion: no-preference 內）；index.html 載入 Huninn；src/app/TodayPage.css、src/app/SyncBar.css、src/cards/CardsPage.css 改用主題變數；src/App.tsx 外層包 MotionConfig（reducedMotion 設為 user）。驗證：`npm run build` 通過；`npm test` 既有測試全部通過（介面文字不變）；手動驗收 8.1 確認情境「手機寬度的遊戲主題」。 <!-- speclink-task:tsk_01M85W07R27D7MRCEEY0T9KB8H -->

## 3. 聲音（D5、D6）

- [ ] 3.1 實作 game-feel 規格「聲音設定」的設定與播放（D5 聲音模組不依賴 React，用 HTMLAudioElement；D6 聲音設定存 localStorage，每台裝置各自記住）：src/game/soundSettings.ts 的 `parseSoundSettings`、`loadSoundSettings`、`saveSoundSettings`（localStorage key `weg.sound`，例外時回預設值）；src/game/sound.ts 的 `createSoundPlayer`（音效複製播放、背景音樂循環且 preload none、音量為設定乘以 0.4、`handleVisibility(true)` 暫停、play 被拒絕時安靜忽略）。驗證：src/game/soundSettings.test.ts 涵蓋 Example「聲音設定的讀取」5 列與 localStorage 丟出例外；src/game/sound.test.ts 以假 Audio 涵蓋：音效關閉時不播放、音樂開啟時以 0.32 音量播放（音量 0.8）、情境「切到背景」暫停與回來繼續、play 被拒絕不丟出例外。 <!-- speclink-task:tsk_01M85W07R2EW53EVC8T73A3PDM -->
- [ ] 3.2 聲音選單（D10 路由擴充中的「聲音選單放在 App 層」）：src/game/useSound.ts 在 App 層建立一次播放器並監聽 visibilitychange；src/game/SoundMenu.tsx 與 src/game/SoundMenu.css 在右上角顯示 🔊／🔇 按鈕（至少 44×44px），選單內有「音效」「背景音樂」開關與「音量」滑桿，變更時立即儲存並套用。驗證：`npm run lint`、`npm run build` 通過；手動驗收 8.1 確認情境「打開背景音樂後重新整理」與「切到背景」。 <!-- speclink-task:tsk_01M85W07R2X66D176Q9BW8BJQP -->

## 4. 今日任務頁（D3、D4）

- [ ] 4.1 經驗值條與地圖位置的純函式（D4 經驗值條以獎勵門檻為目標；D3 冒險地圖：純函式算位置，SVG 畫路徑）：src/game/progressBar.ts 的 `xpProgress(totalXp)`；src/game/mapProgress.ts 的 `mapProgress(schedule, pack, today)`。驗證：src/game/progressBar.test.ts 涵蓋 Example「經驗值區段」8 列與情境「剛開始的經驗值條」；src/game/mapProgress.test.ts 以範例包排程涵蓋 Example「地圖位置」6 列與情境「正式期第一天」，以及沒有新手村日的排程不出現新手村節點。 <!-- speclink-task:tsk_01M85W07R2AQSFDRKJXMK1G3M9 -->
- [ ] 4.2 實作 game-feel 規格「遊戲狀態列」：src/game/GameHud.tsx 與 src/game/GameHud.css 顯示 🧑‍💻 頭像、目前地點（地圖目前節點名稱，計畫未開始「準備出發」、結束「國際會議室」）、經驗值條（「總經驗值 N」與「下一個獎勵：M XP」或「所有獎勵都達成了！」）與 🔥「N 天」；src/app/TodayPage.tsx 用它取代原本的兩個數字卡片，四種計畫狀態都顯示。驗證：`npm run build` 通過；手動驗收 8.1 確認經驗值條與連勝天數和打勾前後的數值一致。 <!-- speclink-task:tsk_01M85W07R2H058C2PT59E1BEME -->
- [ ] 4.3 實作 game-feel 規格「冒險地圖」：src/game/AdventureMap.tsx 與 src/game/AdventureMap.css 以 SVG 畫天空、山丘與小路，節點用 `Emoji` 顯示關卡圖示與名稱，已完成顯示 ✓、目前節點脈動，小路以 Motion 描繪到目前節點（400 毫秒）；放在今日任務頁的狀態列下方。驗證：`npm run build` 通過；手動驗收 8.1 確認 360px 寬完整顯示、目前節點與 Example「地圖位置」相符。 <!-- speclink-task:tsk_01M85W07R2YGPGG8K3AT4122R2 -->
- [ ] 4.4 實作 game-feel 規格「打勾回饋」：勾選寫入成功後該任務列彈跳一次並播放 check，取消勾選成功後播放 uncheck，寫入失敗不播放；狀態列總經驗值以 Motion 從舊值跳到新值；今日任務頁底部加上「製作名單」連結。驗證：`npm run lint`、`npm run build` 通過；手動驗收 8.1 確認情境「勾選任務」。 <!-- speclink-task:tsk_01M85W07R2Q1EYQVZXWT0QNYYW -->

## 5. 單字卡頁（D8）

- [ ] 5.1 實作 game-feel 規格「單字卡回饋」：src/cards/CardsPage.tsx 用 Motion 做 3D 翻卡並播放 flip；評分寫入成功後評「重來」播放 wrong、其他播放 correct；src/game/celebrate.ts 在這次開啟期間佇列由有卡變空時放彩帶（減少動態效果時不放）並播放 clear；頁面原本的文字與流程不變。驗證：`npm test` 既有單字卡測試全部通過；手動驗收 8.1 確認情境「評到清空」與「打開時已完成」。 <!-- speclink-task:tsk_01M85W07R2RCR2ZRX8WGTQAX5H -->

## 6. 製作名單與減少動態效果（D9、D10）

- [ ] 6.1 實作 game-feel 規格「製作名單與素材授權」（D10 路由擴充）：src/app/useHashRoute.ts 的 `routeFromHash` 新增 `#/credits`；src/app/CreditsPage.tsx 與 src/app/CreditsPage.css 依 src/app/credits.ts 顯示每組素材的名稱、作者、來源與授權連結、CC BY 完整標註，Fluent Emoji 連到 public/licenses/fluent-emoji-LICENSE.txt。驗證：src/app/useHashRoute.test.ts 新增 `#/credits` 案例；手動驗收 8.1 確認情境「打開製作名單」。 <!-- speclink-task:tsk_01M85W07R2N7QVXSNGDAKQMZ52 -->
- [ ] 6.2 確認 game-feel 規格「減少動態效果」：所有 Motion 動畫經由 MotionConfig 尊重系統設定，CSS 脈動與按鈕位移只在 prefers-reduced-motion: no-preference 時生效，`celebrate` 在減少動態效果時不放彩帶；所有動畫時間介於 150～400 毫秒（脈動除外）。驗證：程式內容審查列出每個動畫的時間；手動驗收 8.1 在系統開啟「減少動態效果」後確認情境「減少動態效果時評到清空」。 <!-- speclink-task:tsk_01M85W07R2F6WJ6YCD3573YMJX -->

## 7. 文件

- [ ] 7.1 撰寫學習筆記 docs/learning-notes/05-遊戲外觀與音效.md（遊戲回饋的設計、CSS 變數主題、Motion 與減少動態效果、瀏覽器自動播放限制、素材授權種類），並更新 docs/專案規劃書.md 第 9 節（加入圖片、音效、背景音樂與素材來源）與第 14 節（遊戲外觀插隊、之後依序為角色卡＋徽章、內容庫與語音、跟讀錄音、PWA、建立計畫設定頁，日期順延）。驗證：內容審查，學習筆記五個段落齊全且不含個人資訊。 <!-- speclink-task:tsk_01M85W07R27Q59VR8GNV3P14XZ -->

## 8. 驗收

- [ ] [M] 8.1 使用者本機驗收：`npm test`、`npm run lint`、`npm run build` 通過；`npm run dev` 後在手機寬度（Chrome 開發者工具 360px）與一般寬度檢查：遊戲狀態列與冒險地圖、打勾彈跳與音效、單字卡翻卡與音效、清空時彩帶、聲音選單與重新整理後保留、切到背景時音樂暫停、製作名單頁；開啟系統「減少動態效果」後再檢查一次。驗證：截圖回報。 <!-- speclink-task:tsk_01M85W07R259XXXH94JW12E5PG -->
- [ ] [M] 8.2 使用者部署驗收：commit、push，GitHub Actions 成功後在電腦與手機打開正式網站，確認遊戲畫面、手機能聽到音效、背景音樂可開關。驗證：截圖回報。 <!-- speclink-task:tsk_01M85W07R2ZRGRG29R49PZSH44 -->

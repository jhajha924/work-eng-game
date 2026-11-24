## Context

目前 App 是功能骨架：今日任務頁只有文字卡片與打勾框，單字卡頁是純文字卡片，沒有任何圖片、聲音或動畫，`package.json` 也還沒有動畫套件，`public/` 只有 favicon。半年計畫文件的遊戲元素（冒險地圖、角色、經驗值、徽章、頭目戰）在規劃書第 9 節排在第 1 刀後段，圖片、聲音、音樂從未列入計畫。討論紀錄 game-look-and-feel 決定把遊戲外觀插隊成為下一個變更，範圍限定在每天都會看到的今日任務頁與單字卡頁。

限制：

- 主要在手機上使用，最小寬度 360px，MUST NOT 出現橫向捲動（today-page 規格「手機版面」）。
- 版本庫公開：素材只收 CC0、MIT、SIL OFL 1.1，以及逐首確認過的 CC BY 4.0 背景音樂；每個素材都要記下來源與授權。
- 已查證（2026-11-23、2026-11-24）：Kenney 素材頁標示「Creative Commons CC0」、不需標註；Microsoft Fluent Emoji 為 MIT（要保留著作權與授權聲明），每個表情有 3D、Color、Flat、High Contrast 四種樣式，3D 圖檔放在各表情資料夾的 3D 子資料夾（例如 Backpack 的 backpack_3d.png）；粉圓 Huninn 為 SIL OFL 1.1，Google Fonts 提供 chinese-traditional 子集，只有 400 一種字重；Incompetech 免費版為 CC BY 4.0，標註格式為「曲名 Kevin MacLeod (incompetech.com)」、「Licensed under Creative Commons: By Attribution 4.0」、「https://creativecommons.org/licenses/by/4.0/」三行。
- 開發電腦沒有 ffmpeg，有 Python Pillow。

## Goals / Non-Goals

**Goals:**

- 打開 App 第一眼就是遊戲畫面：卡通主題、角色與經驗值條、連勝火焰、冒險地圖。
- 每個主要操作都有回饋：打勾彈跳＋音效＋經驗值跳動；單字卡 3D 翻卡、評分音效、清空時彩帶與過關樂句。
- 聲音可控：音效預設開、背景音樂預設關，設定存在每台裝置。
- 所有素材的授權都有紀錄，App 內有製作名單頁。
- 不改既有規格的任何文字、計算規則、資料格式或同步 API。

**Non-Goals:**

- 角色卡（6 項能力值）與 8 枚徽章：下一個變更「角色卡＋徽章」。
- 頭目戰演出（開場推近、受擊震動）：第 2 刀和 AI 會話一起做。
- 單字卡做成打怪（答對扣怪物血）：討論決定先不做，看第一刀的遊戲感夠不夠再說。
- 跟讀、錄音時自動暫停背景音樂：那兩個功能還不存在，做的時候再加。
- 調整「重來」的卡在佇列中的位置、評分失敗後重試：會改 flashcards 規格，留在 add-flashcards 的審查紀錄。
- Lottie 動畫、3D 模型、像素風素材、game-icons.net、OpenMoji、Pixabay（討論時已排除）。

## Decisions

### D1 主題用 CSS 變數，字體用 Google Fonts 載入粉圓

在 `src/index.css` 的 `:root` 定義遊戲主題變數（天空背景漸層、草地綠、主色紫、強調橘、金色經驗值、卡片陰影、圓角 16px），深色模式各自覆寫一份。遊戲按鈕共用 `.game-button`：底部 4px 深色實心陰影形成立體感，按下時往下位移 2px。`index.html` 以 link 標籤載入 Google Fonts 的 Huninn（display=swap），字體堆疊為 Huninn，再接原本的系統字體；粉圓只有一種字重，所以標題靠字級與顏色區分，不用粗體。

放棄的做法：自己放字型檔（中文字型數 MB，Google Fonts 會依實際用到的字切片下載）；CSS 框架（多一層依賴，只為了配色不值得）；Kenney UI Pack 的按鈕圖（查不到樣式與格式，而且圖片按鈕在不同寬度下容易變形）。

### D2 圖片用 Fluent Emoji 3D PNG，自己畫地圖背景

角色、關卡地標、火焰、星星、獎盃、聲音圖示都用 Fluent Emoji 的 3D PNG，存在 `public/assets/emoji/` 下，檔名為表情的代號加 .png；`src/game/emojiAssets.ts` 維護「emoji 字元 → 檔名代號」對照表，元件 `Emoji`（`src/game/Emoji.tsx`）依字元找圖，找不到時直接顯示原本的 emoji 文字（內容包裡未來出現新圖示也不會壞）。冒險地圖的天空、山丘與小路是自己畫的 SVG，不需要授權。

使用的 16 個表情（字元／Fluent 資料夾名稱／檔名代號）：🎒 Backpack／backpack、🏰 Castle／castle、🌲 Evergreen tree／evergreen-tree、⛰️ Mountain／mountain、🌋 Volcano／volcano、🏯 Japanese castle／japanese-castle、🏛️ Classical building／classical-building、🧑‍💻 Technologist／technologist、🔥 Fire／fire、⭐ Star／star、⚔️ Crossed swords／crossed-swords、🎉 Party popper／party-popper、🏆 Trophy／trophy、📜 Scroll／scroll、🔊 Speaker high volume／speaker-high-volume、🔇 Muted speaker／muted-speaker。下載時逐一確認資料夾存在；某個資料夾不存在時改用最接近的表情，並同步更新對照表與 docs/素材授權.md。全部圖檔合計超過 1.5 MB 時，用 Pillow 縮成 128×128 再存。

放棄的做法：Kenney Map Pack 拼地圖（風格要看預覽圖才知道，而且拼圖塊對 360px 寬的手機太細碎）；3D 模型（下載量大、舊手機會卡）。

### D3 冒險地圖：純函式算位置，SVG 畫路徑

`mapProgress(schedule, pack, today)` 是純函式，回傳地圖節點與目前位置；元件 `AdventureMap` 用 SVG 畫一條彎曲小路串起節點，用 Motion 把小路從起點描到目前節點（pathLength 動畫），目前節點用無限次的輕微放大縮小（脈動）。7 個節點的座標寫死在元件裡（viewBox 寬 360）；節點數不是 7 時，依序平均分布在同一條小路上。

規則：取「今天以前（含今天）最後一個排程日」決定位置。那天是新手村日 → 新手村是目前節點；是正式期 → 那天所在關卡是目前節點，前面的節點全部完成；今天晚於排程結束日 → 全部完成、沒有目前節點；今天早於排程第一天 → 全部鎖住。休息日沿用前一個排程日的位置。排程沒有新手村日時不顯示新手村節點。

### D4 經驗值條以獎勵門檻為目標

計畫文件的獎勵門檻是 1,000、3,000、5,000 經驗值。`xpProgress(totalXp)` 回傳目前所在的區段與比例：未滿 1,000 → 0～1,000；1,000～2,999 → 1,000～3,000；3,000～4,999 → 3,000～5,000；5,000 以上 → 全滿，文字改成「所有獎勵都達成了！」。狀態列標題顯示目前地點：地圖的目前節點名稱；計畫未開始顯示「準備出發」；計畫結束顯示「國際會議室」。

放棄的做法：自訂「角色等級」公式（計畫文件沒有，會和關卡 Lv1～Lv6 混淆）。

### D5 聲音模組不依賴 React，用 HTMLAudioElement

`src/game/sound.ts` 的 `createSoundPlayer` 不依賴 React，建立 Audio 的函式由外部注入（測試用假的 Audio）。音效每次播放時複製一個預先載入的 Audio，所以連點也能重疊播放；背景音樂只有一個 Audio、循環播放、preload 設為 none，第一次打開音樂時才下載。頁面切到背景（visibilitychange 變成 hidden）時暫停音樂，回到前景且設定仍開著才繼續。瀏覽器不允許沒有使用者操作就播放，所以 play 被拒絕時安靜忽略，等下一次點擊再試。`src/game/useSound.ts` 是 React 的薄包裝，在 App 層建立一次並往下傳。

音效對照（Kenney 檔案在實作時從套件中挑選）：check 打勾、uncheck 取消打勾、flip 翻卡、correct 評「困難／良好／簡單」、wrong 評「重來」、click 開關選單、clear 今天的單字卡清空（Music Jingles 的短樂句）。

放棄的做法：Howler.js（多數功能用不到）；Web Audio API 自己解碼（對短音效和一首背景音樂太複雜）。

### D6 聲音設定存 localStorage，每台裝置各自記住

設定為 sfx、music 兩個開關與 volume 音量，預設為音效開、音樂關、音量 0.5，存在 localStorage 的 `weg.sound`。讀取時格式不對、欄位缺少、音量不在 0～1、或 localStorage 無法使用（例如隱私模式丟出例外）一律退回預設值；寫入失敗時設定只在這次開啟期間有效。音效音量為 volume，背景音樂音量為 volume 乘以 0.4（音樂比音效小聲）。不放進 IndexedDB、不同步：手機和電腦的使用場合不同。

### D7 音效檔格式統一成 MP3

iPhone Safari 對 Ogg 的支援不穩，MP3 在所有瀏覽器都能播。Kenney 套件若只提供 Ogg，實作時用 npm 套件 ffmpeg-static 提供的 ffmpeg 執行一次轉檔（以 npx 臨時執行，不加入 package.json，轉好的 MP3 進版本庫）；CC0 允許修改，docs/素材授權.md 註明「由原始檔轉成 MP3」。背景音樂直接用 MP3 原檔。單一音效檔不超過 100 KB，背景音樂不超過 5 MB。

### D8 動畫用 Motion，彩帶用 canvas-confetti，版本固定

- `motion` 固定 14.11.1（2026-11-09 發布，滿兩週；peerDependencies 支援 React 19），`canvas-confetti` 固定 1.9.4，`@types/canvas-confetti` 固定 1.9.0（開發用）。
- App 最外層包 Motion 的 MotionConfig，reducedMotion 設為 user：系統開啟「減少動態效果」時 Motion 的位移與縮放動畫改成直接到終點。CSS 動畫（脈動、按鈕位移）放在 prefers-reduced-motion: no-preference 的媒體查詢裡。`celebrate()`（`src/game/celebrate.ts`）在減少動態效果時不放彩帶。
- 動畫時間 150～400 毫秒；地圖小路描繪 400 毫秒；動畫進行中按鈕照常可以按。

### D9 製作名單頁與授權紀錄

`src/app/credits.ts` 列出每個素材群組：名稱、作者、來源網址、授權名稱、授權網址、用在哪裡、需要的標註文字（CC BY 的完整標註與 MIT 聲明）。`#/credits` 顯示這份清單；Fluent Emoji 的 MIT 授權全文放在 `public/licenses/fluent-emoji-LICENSE.txt` 並從頁面連結。今日任務頁最下方放「製作名單」連結。docs/素材授權.md 是同一份資訊的版本庫紀錄，另外記下每個檔案的原始檔名與是否轉檔、縮圖。

### D10 路由擴充

`routeFromHash` 新增 `#/credits` 對應 credits；其他未知的 hash 仍顯示今日任務頁。聲音選單放在 App 層右上角，三個頁面共用。

## Implementation Contract

**行為（使用者看到的）：**

- 今日任務頁最上方是遊戲狀態列：🧑‍💻 頭像、目前地點名稱、經驗值條（「總經驗值 N」與「下一個獎勵：1,000 XP」或「所有獎勵都達成了！」）、🔥 連勝「N 天」；原本的日期、同步狀態列、本週主題、任務清單、單字卡入口與最低限度按鈕都保留，文字不變。
- 狀態列下方是冒險地圖，節點顯示關卡 3D 圖示與名稱；已完成的節點有 ✓，目前節點脈動。
- 勾選任務：該列彈跳一次、播放 check 音效、總經驗值從舊值跳到新值；取消勾選播放 uncheck 音效。
- 單字卡：按「翻面」卡片以 3D 方式翻到背面；評「重來」播放 wrong，其他三種播放 correct；在這次開啟期間把佇列評到清空時放彩帶並播放 clear 樂句（打開頁面時本來就已清空則不放）。
- 右上角 🔊 按鈕打開聲音選單：「音效」開關、「背景音樂」開關、「音量」滑桿；關閉音效時按鈕顯示 🔇。重新整理後設定保留。
- `#/credits` 顯示製作名單；今日任務頁底部有「製作名單」連結。

**介面：**

- `xpProgress(totalXp)` 回傳 `{ from, to, ratio }`：`to` 為 null 表示全部達成，`ratio` 介於 0～1。
- `mapProgress(schedule, pack, today)` 回傳 `{ nodes }`，每個節點為 `{ id, name, icon, state }`，state 為 done、current 或 locked。
- `parseSoundSettings(raw)`、`loadSoundSettings(storage)`、`saveSoundSettings(storage, settings)`；設定型別 `SoundSettings` 為 `{ sfx, music, volume }`。
- `createSoundPlayer(deps)` 回傳 `play(key)`、`setSettings(settings)`、`handleVisibility(hidden)`；`SoundKey` 為 check、uncheck、flip、correct、wrong、click、clear。
- `emojiAsset(char)` 回傳 `/assets/emoji/` 下的圖檔路徑，沒有對應時回傳 null。
- `routeFromHash(hash)` 回傳 today、cards 或 credits。

**失敗模式：**

- 圖片載入失敗：`Emoji` 改顯示 emoji 文字，不留破圖。
- 瀏覽器拒絕播放（沒有使用者操作、裝置靜音）：安靜忽略，不顯示錯誤。
- localStorage 無法使用：聲音設定用預設值，App 照常運作。
- Google Fonts 載入失敗：退回系統字體。

**驗收：**

- 單元測試：`xpProgress`、`mapProgress`、`parseSoundSettings`、聲音播放器（假 Audio）、`emojiAsset` 對照表的每個檔案都存在於 `public/assets/emoji/`、`credits` 每個項目的授權屬於允許清單、`routeFromHash` 的 `#/credits`。
- `npm test`、`npm run lint`、`npm run build` 通過。
- 手動驗收（任務 8.1、8.2）：360px 寬沒有橫向捲動；開啟「減少動態效果」後沒有位移與彩帶；聲音開關在重新整理後保留；手機能聽到音效。

**範圍：**

- 範圍內：主題、遊戲狀態列、冒險地圖、打勾回饋、單字卡回饋、聲音設定與選單、製作名單頁、素材與授權紀錄、規劃書第 9、14 節更新、學習筆記。
- 範圍外：Non-Goals 列出的項目；任何計算規則、資料格式、同步 API、D1 的修改。

## Risks / Trade-offs

- [Fluent Emoji 某些資料夾名稱和預期不同] → 下載時逐一確認，找不到就換最接近的表情並更新對照表；對照表的檔案存在性有測試保護。
- [Kenney 音效只有 Ogg] → D7 用 ffmpeg-static 一次轉檔；轉不成時保留 Ogg，並在手動驗收確認 iPhone 能否播放。
- [Google Fonts 是外部請求] → 字體載入失敗只會退回系統字體；之後做 PWA 離線時再評估自己放字型子集。
- [動畫在舊手機卡頓] → 動畫只用 transform 與 opacity，時間不超過 400 毫秒；地圖只在載入時描繪一次。
- [背景音樂授權] → 使用者挑選後逐首確認授權與標註文字，記進 docs/素材授權.md 與製作名單；不確定授權的曲子不用。
- [每 30 秒更新一次的 now 讓狀態列重畫] → 狀態列與地圖都是輕量元件，重畫成本可忽略；描繪動畫只在掛載時跑。

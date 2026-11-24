## Why

完成單字卡的本機驗收後，使用者發現整個 App 沒有任何圖片、聲音與遊戲感，和半年計畫文件想像的「冒險地圖、角色、經驗值、徽章、頭目戰」差很多，「這樣根本不會想學」。App 不好玩就不會每天打開，所以遊戲外觀要在新增更多功能之前先做，之後的新畫面才能直接沿用同一套主題與元件（討論紀錄 game-look-and-feel 的結論）。

## What Changes

- 全站改成 2D 卡通插畫風主題：暖色配色、圓角框、立體的遊戲按鈕、背景插畫，中文字體換成開源圓體「粉圓 Huninn」（SIL OFL 1.1）。
- 今日任務頁頂端改成遊戲狀態列：角色頭像與目前關卡、經驗值條（距離下一個獎勵門檻）、連勝火焰。
- 今日任務頁加入冒險地圖：新手村 → Lv1～Lv6 的路徑，已走過的關卡打勾、目前關卡脈動，路徑以描繪動畫出現。
- 打勾時任務會彈跳並播放音效，總經驗值數字往上跳動。
- 單字卡改成 3D 翻卡；評分時播放答對或答錯的音效；清空今天的卡時放彩帶並播放過關音樂。
- 新增聲音：音效預設開、背景音樂預設關，右上角 🔊 選單可開關並調整總音量，設定存在每台裝置；切到背景或鎖定螢幕時音樂暫停。
- 新增「製作名單」頁（`#/credits`），列出所有素材的作者、來源與授權；版本庫新增 docs/素材授權.md 記錄每個素材的網址與授權。
- 所有動畫遵守系統的「減少動態效果」設定，時間 150～400 毫秒，不擋操作。
- 新增套件 motion（MIT）與 canvas-confetti（ISC），版本固定。
- 更新 docs/專案規劃書.md 第 9 節（加入圖片與聲音）與第 14 節（遊戲外觀插隊、後續順序與日期）。

## Non-Goals

（寫在 design.md 的 Goals／Non-Goals。）

## Capabilities

### New Capabilities

- `game-feel`: 遊戲外觀與回饋——卡通主題、遊戲狀態列、冒險地圖、打勾與單字卡的動畫與音效、聲音設定、減少動態效果、製作名單與素材授權。掃描到的相關規格 today-page（今日任務頁的內容與互動）、flashcards（單字卡頁的複習流程）、daily-progress（經驗值與連勝的計算）都只規定「顯示什麼、怎麼算」，沒有任何畫面風格、動畫、聲音或素材授權的規定，所以另開一個能力，不改它們既有的需求。

### Modified Capabilities

(none)

## Impact

- Affected specs: game-feel（新增）
- Affected code:
  - New: src/game/sound.ts, src/game/sound.test.ts, src/game/soundSettings.ts, src/game/soundSettings.test.ts, src/game/useSound.ts, src/game/SoundMenu.tsx, src/game/SoundMenu.css, src/game/progressBar.ts, src/game/progressBar.test.ts, src/game/mapProgress.ts, src/game/mapProgress.test.ts, src/game/emojiAssets.ts, src/game/emojiAssets.test.ts, src/game/Emoji.tsx, src/game/GameHud.tsx, src/game/GameHud.css, src/game/AdventureMap.tsx, src/game/AdventureMap.css, src/game/celebrate.ts, src/app/CreditsPage.tsx, src/app/CreditsPage.css, src/app/credits.ts, src/app/credits.test.ts, public/assets/emoji/, public/assets/sounds/, public/assets/music/, public/licenses/fluent-emoji-LICENSE.txt, docs/素材授權.md, docs/learning-notes/05-遊戲外觀與音效.md
  - Modified: src/index.css, index.html, src/App.tsx, src/app/useHashRoute.ts, src/app/useHashRoute.test.ts, src/app/TodayPage.tsx, src/app/TodayPage.css, src/app/SyncBar.css, src/cards/CardsPage.tsx, src/cards/CardsPage.css, package.json, package-lock.json, docs/專案規劃書.md
  - Removed: (none)
- 依賴：motion 14.11.1（MIT）、canvas-confetti 1.9.4（ISC）、@types/canvas-confetti 1.9.0（開發用）。
- 素材：Microsoft Fluent Emoji 3D PNG（MIT，要附授權聲明）、Kenney Interface Sounds 與 Music Jingles（CC0）、背景音樂一首（Incompetech CC BY 4.0 或 OpenGameArt CC0，使用者挑選後逐首確認授權）、粉圓 Huninn（SIL OFL 1.1，經 Google Fonts 載入）。
- 不影響資料格式、同步 API 與 D1。

---
topic: 目前完成品沒有圖片、聲音與遊戲感，要像半年計畫文件一樣是圖片＋畫面＋聲音豐富的遊戲（素材用免費開源的精美元件）
slug: game-look-and-feel
status: promoted
created: 2026-11-23
created_by: jhajha924 <47804331+jhajha924@users.noreply.github.com>
promoted_to: add-game-look
---

# Discussion: 目前完成品沒有圖片、聲音與遊戲感，要像半年計畫文件一樣是圖片＋畫面＋聲音豐富的遊戲（素材用免費開源的精美元件）

<!--
Document rules:
- Rounds are appended by `speclink discuss add-round`; never rewrite an earlier round.
  A changed position gets a new round that names what changed and why.
- Each round distills one focus question: **Focus** / **Position** / **Ruled out** / **Open**.
- The conclusion must resolve or explicitly defer every open question left by the rounds.
-->

## Context

使用者在 add-flashcards 本機驗收（6.2）通過後暫停 6.3 部署驗收：整個驗收下來沒有任何圖片、聲音或遊戲感，和半年計畫文件（冒險地圖、角色卡、經驗值、徽章、頭目戰，每節附插圖）想像的不一致，「這樣根本不會想學」。需求原本偏模糊（「要有遊戲感」沒有門檻），所以先跑追問，從美術風格開始。
掃描結果：正式規格 today-page、daily-progress、content-pack 只規定功能，沒有提到畫面風格、圖片或聲音；進行中的 add-flashcards（delta：cloud-sync、content-pack、flashcards、today-page）也沒有。docs/專案規劃書.md 第 9 節已經規劃遊戲化與 Motion 動畫清單，但排在第 1 刀後段（角色卡／徽章／地圖動畫），圖片、音效、音樂完全沒列；package.json 還沒有任何動畫套件，public/ 只有 favicon。
Prior discussions: english-quest-app

## Rounds

<!-- `### Round N — <mode> (<date>)` entries are appended here by the CLI. -->

### Round 1 — interview (2026-11-23)

**Focus**: 遊戲感的美術風格要選哪一種（決定後面所有素材的來源）
**Position**: 採用 2D 卡通插畫風（像手機休閒 RPG）。
- 決策樹：1 美術風格 → 2 素材來源與授權 → 3 先遊戲化哪些畫面 → 4 音效與音樂 → 5 動畫技術 → 6 優先順序 → 7 add-flashcards 的 6.3 怎麼處理
- 理由：主要在手機上每天用 5～50 分鐘，要的是打開就開心、操作有回饋；2D 素材最多，也最容易做到整套風格一致
- 落差的原因：規劃書第 9 節把遊戲化排在第 1 刀後段，圖片、聲音、音樂從未列入計畫
**Ruled out**: 像素風復古 RPG — 不同作者的像素大小常不一致，整體容易顯得拼湊；3D 低多邊形 — 下載量大、耗電，舊手機會卡，角色動作與材質要自己整合，成本和學習目的不成比例
**Open**: 2 素材來源與授權（要查證）；3 先遊戲化哪些畫面；4 音效、背景音樂與預設開關；5 動畫技術；6 優先順序；7 add-flashcards 的 6.3 怎麼處理

### Round 2 — interview (2026-11-23)

**Focus**: 素材從哪裡找、接受哪些授權
**Position**: 只收 CC0、MIT、Lottie Simple License，以及逐首確認過的 CC BY 背景音樂；每個素材都記下來源與授權。
- 主力：Kenney（CC0，不必標註，有介面、地圖、角色、音效，同一位作者風格統一）＋Microsoft Fluent Emoji（MIT，要保留授權聲明，立體卡通風，用在徽章、頭像、任務圖示）
- 少量：LottieFiles 免費動畫（Lottie Simple License，可商用、不必標註，散布時要附同樣的授權條款），用在慶祝演出
- 背景音樂備選：Incompetech（免費版要標註，CC 版本要逐首確認）、OpenGameArt 的 CC0 曲目（自動抓取被網站拒絕，由使用者用瀏覽器確認）
- 版本庫放 docs/素材授權.md 記錄每個素材的網址與授權；App 內放「製作名單」頁，呈現 CC BY 與 MIT 的標註
- 中文圓體（例如 Huninn 粉圓）這次沒讀到授權頁，到字體那一步再查證，沒確認前不採用
- 證據：2026-11-23 讀過 kenney.nl/support、fluentui-emoji LICENSE、lottiefiles.com/page/license、incompetech 授權頁、pixabay 條款、openmoji FAQ、game-icons.net about
**Ruled out**: game-icons.net — CC BY 3.0 要逐個圖示標註作者，風格是單色剪影，和卡通插畫不搭；OpenMoji — CC BY-SA 4.0，修改過的圖也得用同樣授權公開；Pixabay — 條款禁止原樣單獨散布，放進公開版本庫屬於灰色地帶
**Open**: 3 先遊戲化哪些畫面；4 音效、背景音樂與預設開關；5 動畫技術；6 優先順序；7 add-flashcards 的 6.3 怎麼處理

### Round 3 — interview (2026-11-23)

**Focus**: 第一個遊戲化變更要包含哪些畫面
**Position**: 第一刀「遊戲外觀」先把每天都會看到的地方變成遊戲。
- 整體主題：卡通風配色、圓角框、遊戲按鈕、背景插畫
- 今日任務頁：角色頭像與目前關卡、經驗值條、連勝火焰、冒險地圖（目前關卡脈動）、任務卷軸
- 打勾：彈跳動畫＋音效＋經驗值數字往上跳
- 單字卡頁：3D 翻卡、答對或答錯的音效、清空時的慶祝動畫
- 聲音：音效＋背景音樂，附開關
- 製作名單頁一起做（素材規則的要求）
- 之後的變更：角色卡（6 項能力值）與 8 枚徽章是下一刀；頭目戰演出放第 2 刀，和 AI 會話一起做
**Ruled out**: 第一刀就把單字卡做成打怪（答對扣怪物血）— 要怪物圖、血條、受擊動畫，範圍會變大一倍；先確認基本遊戲感夠不夠，再決定要不要加
**Open**: 4 音效、背景音樂與預設開關；5 動畫技術；6 優先順序；7 add-flashcards 的 6.3 怎麼處理；（之後）單字卡要不要做成打怪

### Round 4 — interview (2026-11-23)

**Focus**: 音效與背景音樂預設要開還是關
**Position**: 音效預設開、背景音樂預設關，每台裝置各自記住設定。
- 瀏覽器限制：網頁要等使用者點過一次才能播聲音，所以背景音樂不可能一打開就響
- 音效（打勾、翻卡、答對或答錯、升級）是使用者點了才出聲，短而小聲，是遊戲感主要來源
- 背景音樂由右上角 🔊 選單打開；切到背景或鎖定螢幕時自動暫停；之後的跟讀與錄音期間也自動暫停
- 預設音量偏小，選單裡有總音量滑桿；設定存在本機，不跨裝置同步
**Ruled out**: 背景音樂預設開 — 上班或通勤時突然出聲很尷尬，也會干擾跟讀與錄音；聲音設定跨裝置同步 — 手機和電腦的使用場合不同，各自記住才合理
**Open**: 5 動畫與聲音的技術選擇；6 優先順序；7 add-flashcards 的 6.3 怎麼處理；（之後）單字卡要不要做成打怪

### Round 5 — interview (2026-11-23)

**Focus**: 動畫與聲音用什麼技術做
**Position**: 動畫用 Motion、彩帶用 canvas-confetti、聲音自己寫小模組，第一刀不用 Lottie。
- Motion（MIT，peerDependencies 支援 React 19）：翻卡、彈跳、經驗值跳動、地圖脈動、頁面過場，規劃書第 7、9 節原本就選它
- canvas-confetti（ISC）：慶祝的彩帶，不必為彩帶載入整套 Lottie 播放器
- 聲音：用瀏覽器內建的音訊功能自己寫小模組（播放、開關、音量、切到背景時暫停），不加套件
- 版本固定、不寫 ^，並挑發布超過兩週的版本（npm 上 motion 14.14.0 是 2026-11-13 發布，提案時改挑更早的穩定版）
- 動畫遵守系統的「減少動態效果」設定，時間 150～400 毫秒，不擋操作
**Ruled out**: Howler.js — 功能完整但多數用不到；Lottie 播放器 — 檔案較大，第一刀有彩帶加 Motion 已足夠；全部手寫 CSS 動畫 — 翻卡與彈跳要手調的地方太多
**Open**: 6 優先順序；7 add-flashcards 的 6.3 怎麼處理；（之後）單字卡要不要做成打怪

### Round 6 — interview (2026-11-23)

**Focus**: 遊戲化要排在什麼時候做
**Position**: 遊戲外觀插隊成為 add-flashcards 之後的下一個變更，角色卡與徽章接在它後面。
- 新順序：① add-flashcards 收尾 → ② 遊戲外觀（含冒險地圖）→ ③ 角色卡＋8 枚徽章 → ④ 內容庫與語音 → ⑤ 跟讀錄音 → ⑥ PWA → ⑦ 建立計畫設定頁
- 理由：App 不好玩就不會打開，遊戲感是每天打開的動力；先有主題與元件，④⑤ 的新畫面一做出來就是遊戲風格，不用之後再換皮
- 代價：規劃書第 14 節寫第 1 刀在 2026-11-29 完成，④～⑦ 一定會延後；依規劃書「進度落後時，優先保住英文學習照常」，英文練習照計畫走
- 提案時一併更新 docs/專案規劃書.md 第 14 節的順序與日期
**Ruled out**: 維持原本順序（遊戲化在第 1 刀後段）— 這段期間 App 不好玩、不想打開，而且 ④⑤ 的新畫面之後還要再換皮一次
**Open**: 7 add-flashcards 的 6.3 怎麼處理；（之後）單字卡要不要做成打怪

### Round 7 — interview (2026-11-23)

**Focus**: add-flashcards 的 6.3 部署驗收怎麼處理
**Position**: 先照原計畫完成 add-flashcards 的 6.3、品質檢查與封存，再開始做遊戲外觀。
- 暫停 6.3 的原因是產品方向和想像不一致，不是功能有問題；方向定案後，單字卡的排程與同步邏輯本身是對的
- W4 是頭目戰週，要複習 A、B、F，單字卡先上線就能每天在手機上複習
- 遊戲外觀只換皮，不改單字卡的排程與同步，所以 add-flashcards 現在封存，之後不需要再改它的規格
**Ruled out**: 先不部署、和遊戲外觀一起上線 — 30 多個檔案長時間沒 commit，有遺失風險；兩個變更的檔案混在一起難以審查；add-flashcards 也一直無法封存
**Open**: （之後）單字卡要不要做成打怪

## Conclusion

**Decision**: 新開一個變更 add-game-look，把 App 做成 2D 卡通插畫風的遊戲外觀，在 add-flashcards 封存之後立刻插隊進行。
- 美術風格：2D 卡通插畫（像手機休閒 RPG）
- 素材規則：只收 CC0、MIT、Lottie Simple License，以及逐首確認過的 CC BY 背景音樂；主力是 Kenney（CC0）與 Microsoft Fluent Emoji（MIT）；版本庫用 docs/素材授權.md 記錄每個素材的網址與授權，App 內有「製作名單」頁呈現 CC BY 與 MIT 的標註
- 中文圓體（例如 Huninn 粉圓）要先查證授權才採用
- 範圍：卡通風主題（配色、圓角框、遊戲按鈕、背景插畫）；今日任務頁加角色頭像與目前關卡、經驗值條、連勝火焰、冒險地圖（新手村 → Lv1～Lv6，目前關卡脈動）、任務卷軸；打勾時彈跳＋音效＋經驗值數字往上跳；單字卡 3D 翻卡、答對或答錯的音效、清空時的慶祝彩帶；製作名單頁
- 聲音：音效預設開、背景音樂預設關（由右上角 🔊 選單打開，附總音量滑桿）；設定每台裝置各自存在本機；切到背景或鎖定螢幕時音樂暫停，之後的跟讀與錄音期間也暫停
- 技術：Motion（MIT）負責動畫；canvas-confetti（ISC）負責彩帶；聲音用瀏覽器內建的音訊功能自己寫小模組；第一刀不用 Lottie；版本固定，挑發布超過兩週的版本；動畫遵守「減少動態效果」設定，時間 150～400 毫秒
- 不改單字卡的排程、同步與資料格式
- 新順序：add-flashcards 收尾（6.3、品質檢查、封存）→ add-game-look → 角色卡＋8 枚徽章 → 內容庫與語音 → 跟讀錄音 → PWA → 建立計畫設定頁；提案時同步更新 docs/專案規劃書.md 第 9 節（加入圖片與聲音）與第 14 節（順序與日期）
**Rationale**: 使用者說「這樣根本不會想學」：App 不好玩就不會每天打開，遊戲感是使用的動力，不是錦上添花。先把每天都會看到的今日任務頁與單字卡做成遊戲，再讓後續的新畫面直接沿用主題與元件；2D 素材多、容易做到整套風格一致，手機負擔也輕。
**Rejected alternatives**:
- 像素風復古 RPG — 不同作者的像素大小常不一致，整體容易顯得拼湊
- 3D 低多邊形 — 下載量大、耗電，舊手機會卡，角色動作與材質要自己整合
- game-icons.net — CC BY 3.0 要逐個圖示標註作者，單色剪影風格和卡通插畫不搭
- OpenMoji — CC BY-SA 4.0，修改過的圖也得用同樣授權公開
- Pixabay 音樂與音效 — 條款禁止原樣單獨散布，放進公開版本庫屬於灰色地帶
- Howler.js 與 Lottie 播放器 — 多數功能用不到、檔案較大
- 背景音樂預設開 — 上班或通勤時突然出聲很尷尬，也會干擾跟讀與錄音
- 第一刀就把單字卡做成打怪 — 範圍會變大一倍
- 維持原本順序 — App 一直不好玩，新畫面之後還要再換皮
- add-flashcards 先不部署、和遊戲外觀一起上線 — 大量檔案長時間沒 commit，兩個變更混在一起難以審查
**Deferred**:
- 單字卡要不要做成打怪（答對扣怪物血）— 先確認第一刀的遊戲感夠不夠再決定
- 背景音樂選哪幾首 — 提案或實作時從 Incompetech、OpenGameArt 的 CC0 曲目逐首確認授權；OpenGameArt 拒絕自動抓取，要使用者用瀏覽器確認
- Lottie 動畫 — 第一刀用不到，之後的演出需要再評估
**Capture to**: proposal
**Next**: add-flashcards 完成 6.3、品質檢查與封存後，執行 /speclink-propose --from-discussion game-look-and-feel

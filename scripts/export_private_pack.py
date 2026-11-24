# -*- coding: utf-8 -*-
"""把原半年計畫的 Python 資料轉成私人內容包 JSON（只留本機，不進版本庫）。

用法：
    python scripts/export_private_pack.py <原計畫 build_plan.py 的路徑>
    python scripts/export_private_pack.py --slugs   （測試用：從標準輸入讀英文 JSON 陣列，輸出代號 JSON 陣列）

輸出：content/packs/private/meeting-a2-b1/pack.json（content/packs/private/ 已列在 .gitignore）
"""
import importlib.util
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "packs" / "private" / "meeting-a2-b1" / "pack.json"

# 原計畫沒有的引擎參數：各關最少週數與拉長權重（和公開範例包相同）
MIN_WEEKS = [3, 4, 3, 3, 4, 3]
STRETCH_WEIGHT = [1, 1, 1, 2, 2, 1]
# 每日模板的 key 和公開範例包相同，方便兩個內容包的打勾紀錄互相對應
DAILY_KEYS = ["new-words", "shadowing", "reading", "ai-talk", "recording", "review", "role-play"]
BOSS_KEYS = {4: "boss-battle", 5: "boss-retry"}
# 每個任務的經驗值（和公開範例包相同）
XP = {"new-words": 10, "shadowing": 10, "reading": 15, "ai-talk": 20, "recording": 15, "review": 10,
      "role-play": 20, "boss-battle": 100, "boss-retry": 15, "light": 10}
LIGHT = {"key": "light", "title": "輕量日：單字卡＋跟讀 5 分鐘", "minutes": 10, "xp": XP["light"]}


def load_plan(path: pathlib.Path):
    """只載入資料，不執行原腳本的 main()（不會產生 PDF）"""
    spec = importlib.util.spec_from_file_location("build_plan", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def xp_of(text: str) -> int:
    m = re.search(r"\d+", text)
    return int(m.group()) if m else 0


def card_slug(en: str) -> str:
    """和 App 的 cardSlug 相同：轉小寫、連續的非英數字元換成 -、去掉頭尾的 -
    （src/cards/slugParity.test.ts 用 --slugs 確認兩邊結果一致）"""
    return re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-")


def first_seen(seen: set, skipped: list, group: str, en: str) -> bool:
    """同一種卡片的代號第一次出現才保留；重複的記在 skipped（App 的結構檢查不接受重複代號）"""
    slug = card_slug(en)
    if slug in seen:
        skipped.append(f"{group}：{en}")
        return False
    seen.add(slug)
    return True


def build_vocab(plan, skipped: list) -> list:
    """VOCAB：類別 → (英文, 中文, 例句)；空字串的例句不輸出。
    同一個字在多個類別出現（例如新手村的字在主題類別再出現一次）時只保留第一次"""
    groups = []
    seen: set = set()
    for category, words in plan.VOCAB.items():
        items = []
        for en, zh, example in words:
            if not first_seen(seen, skipped, category, en):
                continue
            word = {"en": en, "zh": zh}
            if example:
                word["example"] = example
            items.append(word)
        groups.append({"category": category, "words": items})
    return groups


def build_patterns(plan, skipped: list) -> list:
    """PATTERNS：[(情境, [(英文, 中文)])]；重複的句型只保留第一次"""
    seen: set = set()
    return [{"scenario": scenario,
             "items": [{"en": en, "zh": zh} for en, zh in items if first_seen(seen, skipped, scenario, en)]}
            for scenario, items in plan.PATTERNS]


def build_pack(plan, skipped: dict) -> dict:
    levels = []
    for i, (lv_id, name, icon, goal, week_nos) in enumerate(plan.LEVELS):
        weeks = [{"title": plan.WEEKS[w][0], "focus": plan.WEEKS[w][1], "vocabCategory": plan.WEEKS[w][2]}
                 for w in week_nos]
        levels.append({"id": lv_id.lower(), "name": name, "icon": icon, "goal": goal,
                       "minWeeks": MIN_WEEKS[i], "stretchWeight": STRETCH_WEIGHT[i], "weeks": weeks})
    return {
        "id": "meeting-a2-b1",
        "name": "英文冒險：從新手村到國際會議室",
        "version": 1,
        "novice": [{"title": t, "description": d, "xp": xp_of(xp), "icon": icon} for t, d, xp, icon in plan.NOVICE],
        "levels": levels,
        "dailyTemplates": [{"key": DAILY_KEYS[k], "title": plan.DAILY[k][0], "minutes": plan.DAILY[k][1],
                            "xp": XP[DAILY_KEYS[k]]}
                           for k in range(7)],
        "bossDayOverrides": {str(k): {"key": BOSS_KEYS[k], "title": t, "minutes": m, "xp": XP[BOSS_KEYS[k]]}
                             for k, (t, m) in plan.BOSS_DAILY.items()},
        "lightDayTemplate": LIGHT,
        "vocab": build_vocab(plan, skipped["vocab"]),
        "patterns": build_patterns(plan, skipped["patterns"]),
    }


def main() -> None:
    if sys.argv[1:] == ["--slugs"]:
        print(json.dumps([card_slug(en) for en in json.load(sys.stdin)], ensure_ascii=False))
        return
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    if not src.is_file():
        sys.exit(f"找不到原計畫檔案：{src}")
    skipped: dict = {"vocab": [], "patterns": []}
    pack = build_pack(load_plan(src), skipped)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    weeks = sum(len(lv["weeks"]) for lv in pack["levels"])
    words = sum(len(g["words"]) for g in pack["vocab"])
    patterns = sum(len(g["items"]) for g in pack["patterns"])
    print(f"ok {OUT.relative_to(ROOT)}：新手村 {len(pack['novice'])} 天、{len(pack['levels'])} 關、{weeks} 週、"
          f"單字 {words} 個、句型 {patterns} 句")
    for kind, label in (("vocab", "單字"), ("patterns", "句型")):
        if skipped[kind]:
            print(f"略過重複的{label} {len(skipped[kind])} 個（保留第一次出現的）：" + "、".join(skipped[kind]))


if __name__ == "__main__":
    main()

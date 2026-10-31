# -*- coding: utf-8 -*-
"""把原半年計畫的 Python 資料轉成私人內容包 JSON（只留本機，不進版本庫）。

用法：
    python scripts/export_private_pack.py <原計畫 build_plan.py 的路徑>

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
LIGHT = {"key": "light", "title": "輕量日：單字卡＋跟讀 5 分鐘", "minutes": 10}


def load_plan(path: pathlib.Path):
    """只載入資料，不執行原腳本的 main()（不會產生 PDF）"""
    spec = importlib.util.spec_from_file_location("build_plan", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def xp_of(text: str) -> int:
    m = re.search(r"\d+", text)
    return int(m.group()) if m else 0


def build_pack(plan) -> dict:
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
        "dailyTemplates": [{"key": DAILY_KEYS[k], "title": plan.DAILY[k][0], "minutes": plan.DAILY[k][1]}
                           for k in range(7)],
        "bossDayOverrides": {str(k): {"key": BOSS_KEYS[k], "title": t, "minutes": m}
                             for k, (t, m) in plan.BOSS_DAILY.items()},
        "lightDayTemplate": LIGHT,
    }


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    if not src.is_file():
        sys.exit(f"找不到原計畫檔案：{src}")
    pack = build_pack(load_plan(src))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    weeks = sum(len(lv["weeks"]) for lv in pack["levels"])
    print(f"ok {OUT.relative_to(ROOT)}：新手村 {len(pack['novice'])} 天、{len(pack['levels'])} 關、{weeks} 週")


if __name__ == "__main__":
    main()

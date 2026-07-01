#!/usr/bin/env python3
"""
Re-classifies already-downloaded activity JSON files without re-syncing from Garmin.
Uses the same title-based keywords as normalizer.py to fix activities stuck as 'other'.

Usage:
    python fix_sports.py
"""
import json
from pathlib import Path

TITLE_CYCLING  = ["ciclismo", "cycling", " bici", "bike", "gravel", "mtb"]
TITLE_RUNNING  = ["running", "correr", "carrera", "trail", "maratón", "marathon"]
TITLE_SWIMMING = ["natación", "swimming", "nadar", "piscina", "swim"]
TITLE_WALKING  = ["caminar", "caminata", "senderismo", "hiking", "trekking", "marcha"]
TITLE_STRENGTH = ["fuerza", "strength", "gym", "crossfit", "musculación", "pesas"]
TITLE_PADEL    = ["pádel", "padel", "tenis", "tennis", "squash"]


def classify_by_title(title: str) -> str | None:
    t = title.lower()
    if any(k in t for k in TITLE_CYCLING):  return "cycling"
    if any(k in t for k in TITLE_RUNNING):  return "running"
    if any(k in t for k in TITLE_SWIMMING): return "swimming"
    if any(k in t for k in TITLE_WALKING):  return "walking"
    if any(k in t for k in TITLE_STRENGTH): return "strength"
    if any(k in t for k in TITLE_PADEL):    return "padel"
    return None


def fix_item(item: dict) -> bool:
    if item.get("sport") != "other":
        return False
    new_sport = classify_by_title(item.get("title", ""))
    if new_sport:
        item["sport"] = new_sport
        return True
    return False


def fix_file(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    if isinstance(data, list):
        for item in data:
            if fix_item(item):
                changed += 1
    elif isinstance(data, dict):
        if fix_item(data):
            changed = 1
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return changed


def main():
    data_dir = Path(__file__).parent.parent / "public" / "data"
    total = 0
    for path in sorted(data_dir.glob("*.json")):
        n = fix_file(path)
        if n:
            print(f"  Fixed {n} item(s) in {path.name}")
            total += n
    print(f"\nDone. {total} activities re-classified.")


if __name__ == "__main__":
    main()

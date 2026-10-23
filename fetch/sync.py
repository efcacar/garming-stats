#!/usr/bin/env python3
from __future__ import annotations
"""
Garmin Connect → local JSON sync script.

Usage:
    python sync.py                  # sync all activities
    python sync.py --limit 20       # only fetch 20 (for testing)
    python sync.py --since 2024-01-01  # only activities after this date

Credentials are read from ../.env (GARMIN_EMAIL, GARMIN_PASSWORD).
Auth tokens are cached in ~/.garth/ so login only happens once.

Output: ../public/data/activities.json + ../public/data/activity_{id}.json
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (parent of fetch/)
load_dotenv(Path(__file__).parent.parent / ".env")


def get_api():
    """Authenticate and return a Garmin Connect API client."""
    try:
        import garminconnect
    except ImportError:
        print("ERROR: garminconnect not installed. Run: pip install -r requirements.txt")
        sys.exit(1)

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        print("ERROR: Set GARMIN_EMAIL and GARMIN_PASSWORD in .env (copy from .env.example)")
        sys.exit(1)

    api = garminconnect.Garmin(email, password)
    try:
        api.login()
    except garminconnect.GarminConnectAuthenticationError as e:
        print(f"Authentication failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Login error: {e}")
        sys.exit(1)

    print(f"Logged in as {email}")
    return api


def fetch_activities(api, limit: int | None, since: str | None) -> list:
    """Download the activity list from Garmin Connect."""
    print("Fetching activity list...")

    if limit:
        raw = api.get_activities(0, limit)
    else:
        # Paginate through all activities in chunks of 100
        raw = []
        start = 0
        chunk = 100
        while True:
            batch = api.get_activities(start, chunk)
            if not batch:
                break
            raw.extend(batch)
            print(f"  Fetched {len(raw)} activities so far...")
            if len(batch) < chunk:
                break
            start += chunk
            time.sleep(0.3)

    # Filter by date if requested
    if since:
        raw = [a for a in raw if (a.get("startTimeLocal") or "") >= since]

    print(f"Total activities: {len(raw)}")
    return raw


def _try(fn, *args, label="", **kwargs):
    """Call fn(*args, **kwargs) with retries, return {} / [] / None on failure."""
    for attempt in range(3):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                if label:
                    print(f"  WARNING: {label}: {e}")
    return None


def fetch_activity_details(api, activity_id: int) -> dict:
    """Download core details for a single activity (garminconnect 0.2.x API)."""
    result = _try(api.get_activity_details, activity_id, label=f"details {activity_id}")
    return result or {}


def restore_summary_temperatures(summaries: list, output_dir: Path):
    for summary in summaries:
        detail_path = output_dir / f"activity_{summary['id']}.json"
        if not detail_path.exists():
            continue
        try:
            cached = json.loads(detail_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            print(f"  WARNING: Could not restore temperature for {summary['id']}: {error}")
            continue
        if cached.get("avgTemperature") is not None:
            summary["avgTemperature"] = cached["avgTemperature"]
        if cached.get("temperatureSynced"):
            summary["temperatureSynced"] = True


def fetch_activity_temperature(api, activity_id: int) -> dict | None:
    raw = _try(api.get_activity, activity_id, label=f"temperature {activity_id}")
    if raw is None:
        return None
    if not isinstance(raw, dict) or not isinstance(raw.get("summaryDTO"), dict):
        print(f"  WARNING: Unexpected activity summary for temperature {activity_id}")
        return None
    return {
        "avgTemperature": raw["summaryDTO"].get("averageTemperature"),
        "temperatureSynced": True,
    }


def fetch_activity_hr_zones(api, activity_id: int) -> list:
    """Fetch HR zone breakdown (seconds per zone) for a single activity."""
    result = _try(api.get_activity_hr_in_timezones, activity_id, label=f"hr_zones {activity_id}")
    return result or []


def fetch_activity_splits(api, activity_id: int) -> dict:
    """Fetch lap/split data for a single activity."""
    result = _try(api.get_activity_splits, activity_id, label=f"splits {activity_id}")
    return result or {}


def fetch_workout_blocks(api, activity_id: int) -> list | None:
    from normalizer import normalize_workout_blocks

    raw = _try(api.get_activity_typed_splits, activity_id, label=f"workout blocks {activity_id}")
    if raw is None:
        return None
    if not isinstance(raw, dict) or not isinstance(raw.get("splits"), list):
        print(f"  WARNING: Unexpected workout block response for activity {activity_id}")
        return None
    return normalize_workout_blocks(raw)


def fetch_gpx_coords(api, activity_id: int) -> list:
    """Return [[lat, lon, ele?], ...] from GPX download, or [] on failure."""
    import re
    import xml.etree.ElementTree as ET
    import garminconnect
    try:
        gpx_data = api.download_activity(
            activity_id,
            dl_fmt=garminconnect.Garmin.ActivityDownloadFormat.GPX,
        )
        if not gpx_data:
            return []
        text = gpx_data.decode("utf-8", errors="ignore")
        coords = []

        # Primary parser: namespace-safe XML parsing for trkpt/ele.
        try:
            root = ET.fromstring(text)
            for trkpt in root.iter():
                if not trkpt.tag.endswith("trkpt"):
                    continue
                lat = trkpt.attrib.get("lat")
                lon = trkpt.attrib.get("lon")
                if lat is None or lon is None:
                    continue
                point: list = [float(lat), float(lon)]
                ele_val = None
                for child in trkpt:
                    if child.tag.endswith("ele") and child.text:
                        ele_val = child.text
                        break
                if ele_val is not None:
                    point.append(round(float(ele_val), 1))
                coords.append(point)
        except Exception:
            # Fallback regex parser for malformed GPX payloads.
            blocks = re.findall(
                r'<trkpt lat="([\d.\-]+)" lon="([\d.\-]+)"[^>]*>(.*?)</trkpt>',
                text,
                re.DOTALL,
            )
            for lat, lon, inner in blocks:
                point: list = [float(lat), float(lon)]
                ele_m = re.search(r'<ele>([\d.\-]+)</ele>', inner)
                if ele_m:
                    point.append(round(float(ele_m.group(1)), 1))
                coords.append(point)

        if len(coords) > 500:
            step = len(coords) // 500
            coords = coords[::step]
        return coords
    except Exception as e:
        print(f"  WARNING: gpx {activity_id}: {e}")
        return []


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def _needs_gpx_backfill(detail_path: Path) -> bool:
    """True when cached detail exists but misses route or elevation in route points."""
    if not detail_path.exists():
        return False
    try:
        cached = json.loads(detail_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    coords = cached.get("gpxCoords") or []
    if not coords:
        return True

    # Some old files may have [lat, lon] only; consider that as missing altimetry.
    return not any(isinstance(c, list) and len(c) >= 3 for c in coords)


BEST_EFFORT_KMS = [
    (1,      "1 km"),
    (5,      "5 km"),
    (10,     "10 km"),
    (21,     "Media Maratón"),
]

def _compute_running_best_efforts(output_dir: Path) -> list:
    """Sliding-window best effort over per-km auto-laps in all cached detail files."""
    import glob as _glob

    bests: dict[int, dict] = {}

    for fpath in _glob.glob(str(output_dir / "activity_*.json")):
        try:
            d = json.loads(Path(fpath).read_text(encoding="utf-8"))
        except Exception:
            continue

        if d.get("sport") != "running":
            continue

        # Only use auto-laps of ~1 km (distance within 10% of 1 km)
        km_laps = [
            l for l in d.get("laps", [])
            if abs(l.get("distance", 0) - 1) < 0.1 and l.get("duration", 0) > 0
        ]
        if not km_laps:
            continue

        for km, label in BEST_EFFORT_KMS:
            n = km
            if len(km_laps) < n:
                continue
            for i in range(len(km_laps) - n + 1):
                window_time = sum(l["duration"] for l in km_laps[i : i + n])
                prev = bests.get(km)
                if prev is None or window_time < prev["duration"]:
                    bests[km] = {
                        "km": km,
                        "label": label,
                        "activityId": d["id"],
                        "date": d["startTime"][:10],
                        "duration": window_time,
                        "pace": round(window_time / km),
                        "title": d.get("title", ""),
                    }

    return sorted(bests.values(), key=lambda x: x["km"])


def _fetch_garmin_personal_records(api, output_dir: Path) -> tuple:
    """Fetch official personal records from Garmin Connect.
    Returns (running_efforts, cycling_records)."""
    # Running typeId → (km, label)
    RUNNING_TYPE_MAP = {
        1:  (1,       "1 km"),
        3:  (5,       "5 km"),
        4:  (10,      "10 km"),
        5:  (21.097,  "Media Maratón"),
        6:  (42.195,  "Maratón"),
    }
    # Cycling typeId → label and whether value is distance(m) or time(s)
    CYCLING_TYPE_MAP = {
        8:  ("Ruta más larga",  "distance"),
        9:  ("Mayor ascenso",     "elevation"),
        11: ("40 km",             "time"),
    }

    try:
        raw = api.get_personal_record() or []
    except Exception as e:
        print(f"  WARNING: Could not fetch personal records: {e}")
        return [], []

    if not isinstance(raw, list):
        return [], []

    def parse_date(val):
        if isinstance(val, (int, float)):
            import datetime as _dt
            return _dt.datetime.fromtimestamp(val / 1000).strftime("%Y-%m-%d")
        return str(val or "")[:10]

    running, cycling = [], []

    for pr in raw:
        type_id = pr.get("typeId")
        duration = pr.get("value")
        activity_id = pr.get("activityId")
        date_str = parse_date(pr.get("activityStartDateTimeLocal") or pr.get("prStartTimeLocal"))
        title = pr.get("activityName") or ""

        if type_id in RUNNING_TYPE_MAP and duration and activity_id:
            km, label = RUNNING_TYPE_MAP[type_id]
            running.append({
                "km": km, "label": label,
                "activityId": int(activity_id), "date": date_str,
                "duration": int(float(duration)),
                "pace": round(float(duration) / km) if km else 0,
                "title": title,
            })

        elif type_id in CYCLING_TYPE_MAP and duration and activity_id:
            label, kind = CYCLING_TYPE_MAP[type_id]
            val = float(duration)
            cycling.append({
                "typeId": type_id, "label": label, "kind": kind,
                "activityId": int(activity_id), "date": date_str,
                "value": round(val, 1),
                "title": title,
            })

    running.sort(key=lambda x: x["km"])
    cycling.sort(key=lambda x: x["typeId"])
    return running, cycling


CYCLING_BEST_EFFORT_KMS = [
    (30,  "30 km",   1.5),
    (40,  "40 km",   2.0),
    (50,  "50 km",   2.5),
    (100, "100 km",  5.0),
]

# Keywords that suggest a recovery/easy ride (not a PR effort)
_RECOVERY_KEYWORDS = ("activación", "activacion", "recupera", "easy", "regenera", "suave", "rodaje suave")

def _compute_cycling_best_efforts(output_dir: Path) -> list:
    """Best time for each cycling distance bracket across all cached activities."""
    import glob as _glob

    bests: dict[int, dict] = {}

    for fpath in _glob.glob(str(output_dir / "activity_*.json")):
        try:
            d = json.loads(Path(fpath).read_text(encoding="utf-8"))
        except Exception:
            continue

        if d.get("sport") != "cycling":
            continue

        # Skip recovery/easy rides
        title_lower = (d.get("title") or "").lower()
        if any(kw in title_lower for kw in _RECOVERY_KEYWORDS):
            continue

        dist = d.get("distance", 0)   # km
        duration = d.get("duration", 0)  # seconds
        if not dist or not duration:
            continue

        speed = dist / (duration / 3600)
        # Skip unrealistically slow rides (< 15 km/h avg suggests indoor/MTB/interrupted)
        if speed < 15:
            continue

        for km, label, tolerance in CYCLING_BEST_EFFORT_KMS:
            if abs(dist - km) > tolerance:
                continue
            prev = bests.get(km)
            if prev is None or speed > prev["speed"]:
                bests[km] = {
                    "km": km,
                    "label": label,
                    "activityId": d["id"],
                    "date": d["startTime"][:10],
                    "duration": duration,
                    "distance": round(dist, 2),
                    "speed": round(speed, 2),
                    "title": d.get("title", ""),
                }

    return sorted(bests.values(), key=lambda x: x["km"])


def _normalize_gear_item(g: dict) -> dict:
    return {
        "uuid": g.get("uuid") or "",
        "name": g.get("customMakeModel") or g.get("displayName") or "",
        "type": g.get("gearTypeName", ""),
        "status": g.get("gearStatusName", ""),
        "dateBegin": (g.get("dateBegin") or "")[:10],
        "dateEnd": (g.get("dateEnd") or "")[:10] or None,
        "maxMeters": g.get("maximumMeters"),
        "totalDistance": g.get("totalDistance"),
        "totalActivities": g.get("totalActivities"),
    }


def fetch_activity_gear(api, activity_id: int) -> list | None:
    raw = _try(api.get_activity_gear, activity_id, label=f"gear {activity_id}")
    if raw is None:
        return None
    if not isinstance(raw, list) or any(
        not isinstance(item, dict) or not item.get("uuid") for item in raw
    ):
        print(f"  WARNING: Unexpected gear response for activity {activity_id}")
        return None
    return [_normalize_gear_item(item) for item in raw]


def _fetch_gear_data(api) -> list:
    """Fetch all gear items with usage stats from Garmin Connect."""
    try:
        profile = api.get_user_profile()
        pk = profile.get('id') or profile.get('userProfileId')
        if not pk:
            # Try from garmin profile stats
            try:
                summary = api.get_user_summary(__import__('datetime').date.today().isoformat())
                pk = summary.get('userProfileId')
            except Exception:
                pass
        if not pk:
            print("  WARNING: Could not get userProfileId for gear")
            return []
        raw_list = api.get_gear(str(pk)) or []
    except Exception as e:
        print(f"  WARNING: Could not fetch gear list: {e}")
        return []

    gear_items = []
    for g in raw_list:
        uuid = g.get('uuid') or ''
        name = g.get('customMakeModel') or g.get('displayName') or ''
        if not name:
            continue

        item = _normalize_gear_item(g)

        # Try to get stats
        if uuid:
            try:
                stats = api.get_gear_stats(uuid) or {}
                item['totalDistance']   = stats.get('totalDistance')
                item['totalActivities'] = stats.get('totalActivities')
                time.sleep(0.15)
            except Exception:
                pass

        gear_items.append(item)

    # Sort: active first, then by type, then by name
    gear_items.sort(key=lambda x: (x['status'] != 'active', x['type'], x['name']))
    return gear_items


def _fetch_sleep_data(api, output_dir: Path, days_initial: int = 90) -> list:
    """Fetch sleep data incrementally: only fetch days not already cached."""
    import datetime as _dt

    sleep_path = output_dir / "sleep.json"

    # Load existing data
    existing: dict[str, dict] = {}
    if sleep_path.exists():
        try:
            for entry in json.loads(sleep_path.read_text(encoding="utf-8")):
                existing[entry["date"]] = entry
        except Exception:
            pass

    # Determine start date: day after the most recent cached entry, or N days back
    today = _dt.date.today()
    if existing:
        latest_cached = max(existing.keys())
        start = _dt.date.fromisoformat(latest_cached) + _dt.timedelta(days=1)
        print(f"  Incremental sleep sync from {start} (already have {len(existing)} days)")
    else:
        start = today - _dt.timedelta(days=days_initial - 1)
        print(f"  Initial sleep sync: fetching {days_initial} days")

    # Fetch missing days
    new_count = 0
    cur = start
    while cur <= today:
        date = cur.isoformat()
        if date not in existing:
            try:
                raw = api.get_sleep_data(date) or {}
                dto = raw.get("dailySleepDTO") or {}
                if dto and dto.get("sleepTimeSeconds"):
                    existing[date] = {
                        "date": date,
                        "durationSeconds": dto.get("sleepTimeSeconds", 0),
                        "deepSeconds": dto.get("deepSleepSeconds", 0),
                        "lightSeconds": dto.get("lightSleepSeconds", 0),
                        "remSeconds": dto.get("remSleepSeconds", 0),
                        "awakeSeconds": dto.get("awakeSleepSeconds", 0),
                        "score": (dto.get("sleepScores") or {}).get("overall", {}).get("value")
                                 or dto.get("sleepScore"),
                        "startGMT": dto.get("sleepStartTimestampGMT"),
                        "endGMT": dto.get("sleepEndTimestampGMT"),
                        "avgHRV": dto.get("averageHrvValue"),
                        "avgSpO2": dto.get("averageSpO2Value"),
                        "restingHR": dto.get("restingHeartRate"),
                    }
                    new_count += 1
                time.sleep(0.2)
            except Exception as e:
                print(f"  WARNING: sleep {date}: {e}")
        cur += _dt.timedelta(days=1)

    print(f"  Fetched {new_count} new sleep entries")
    return sorted(existing.values(), key=lambda x: x["date"])


def _to_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_weight_kg(value) -> float | None:
    f = _to_float(value)
    if f is None or f <= 0:
        return None

    if 20 <= f <= 250:
        return round(f, 2)

    if f > 250:
        for div in (1000, 100, 10):
            cand = f / div
            if 20 <= cand <= 250:
                return round(cand, 2)
    return None


def _normalize_bone_mass_kg(value) -> float | None:
    f = _to_float(value)
    if f is None or f <= 0:
        return None

    if 1 <= f <= 15:
        return round(f, 2)

    if 15 < f <= 150:
        return round(f / 10, 2)

    if 1000 <= f <= 15_000:
        return round(f / 1000, 2)

    return None


def _to_iso_date(value) -> str | None:
    import datetime as _dt
    import re as _re

    if value is None:
        return None

    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 10_000_000_000:
            ts = ts / 1000
        try:
            return _dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
        except Exception:
            return None

    s = str(value).strip()
    if not s:
        return None

    m = _re.match(r"^(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)

    try:
        return _dt.datetime.fromisoformat(s.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        return None


def _pick_number(d: dict, keys: list[str]) -> float | None:
    for k in keys:
        if k not in d:
            continue
        v = d.get(k)
        if isinstance(v, dict):
            for sub in ("value", "weight", "kg", "kgs", "amount"):
                if sub in v:
                    f = _to_float(v.get(sub))
                    if f is not None:
                        return f
        else:
            f = _to_float(v)
            if f is not None:
                return f
    return None


def _extract_weight_entries(raw) -> list[dict]:
    """Extract daily weight entries from Garmin weight/body payloads."""
    if not isinstance(raw, (dict, list)):
        return []

    out: dict[str, dict] = {}

    def walk(node):
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return

        date = (
            _to_iso_date(node.get("calendarDate"))
            or _to_iso_date(node.get("date"))
            or _to_iso_date(node.get("measurementDate"))
            or _to_iso_date(node.get("startDate"))
            or _to_iso_date(node.get("day"))
            or _to_iso_date(node.get("dateTimestamp"))
            or _to_iso_date(node.get("measurementTimeGMT"))
        )

        weight_kg = _normalize_weight_kg(_pick_number(node, [
            "weight", "weightInKg", "weightKg", "bodyWeight", "mass",
        ]))

        if date and weight_kg is not None:
            timestamp = _to_float(
                node.get("measurementTimeGMT")
                or node.get("dateTimestamp")
                or node.get("calendarDateTime")
            )
            if timestamp is not None and timestamp < 10_000_000_000:
                timestamp = timestamp * 1000

            entry = {
                "date": date,
                "weightKg": weight_kg,
                "bmi": _to_float(node.get("bmi")),
                "bodyFatPct": _to_float(node.get("bodyFat")),
                "muscleMassKg": _normalize_weight_kg(_pick_number(node, ["muscleMass", "muscleMassInKg"])),
                "bodyWaterPct": _to_float(node.get("bodyWater")),
                "boneMassKg": _normalize_bone_mass_kg(_pick_number(node, ["boneMass", "boneMassInKg"])),
                "visceralFat": _to_float(node.get("visceralFat")),
                "metabolicAge": _to_float(node.get("metabolicAge")),
                "timestamp": int(timestamp) if timestamp else None,
            }

            prev = out.get(date)
            prev_ts = prev.get("timestamp") if prev else None
            curr_ts = entry.get("timestamp")
            if prev is None or (curr_ts is not None and (prev_ts is None or curr_ts >= prev_ts)):
                out[date] = entry

        for v in node.values():
            if isinstance(v, (dict, list)):
                walk(v)

    walk(raw)
    return sorted(out.values(), key=lambda x: x["date"])


def _merge_weight_entries(existing_by_date: dict[str, dict], new_entries: list[dict]):
    for entry in new_entries:
        date = entry.get("date")
        if not date:
            continue
        prev = existing_by_date.get(date)
        if not prev:
            existing_by_date[date] = entry
            continue

        prev_ts = prev.get("timestamp")
        curr_ts = entry.get("timestamp")
        if curr_ts is not None and (prev_ts is None or curr_ts >= prev_ts):
            merged = {**prev, **entry}
        else:
            merged = {**entry, **prev}

        for k, v in merged.items():
            if v is None:
                merged[k] = prev.get(k) if prev.get(k) is not None else entry.get(k)
        existing_by_date[date] = merged


def _fetch_weight_data(api, output_dir: Path, days_initial: int = 365) -> list:
    """Fetch weight/body composition incrementally."""
    import datetime as _dt

    weight_path = output_dir / "weight.json"

    existing: dict[str, dict] = {}
    if weight_path.exists():
        try:
            for entry in json.loads(weight_path.read_text(encoding="utf-8")):
                if isinstance(entry, dict) and entry.get("date"):
                    bone_mass = _to_float(entry.get("boneMassKg"))
                    if bone_mass is not None and 15 < bone_mass <= 150:
                        entry["boneMassKg"] = round(bone_mass / 10, 2)
                    elif bone_mass is not None and not 1 <= bone_mass <= 15:
                        entry["boneMassKg"] = None
                    existing[entry["date"]] = entry
        except Exception:
            pass

    today = _dt.date.today()
    if existing:
        latest_cached = max(existing.keys())
        missing_bone_mass = any(entry.get("boneMassKg") is None for entry in existing.values())
        if missing_bone_mass:
            start = _dt.date.fromisoformat(min(existing.keys()))
            print(f"  Backfilling weight composition from {start} (bone mass missing in cached data)")
        else:
            start = _dt.date.fromisoformat(latest_cached) + _dt.timedelta(days=1)
            print(f"  Incremental weight sync from {start} (already have {len(existing)} days)")
    else:
        start = today - _dt.timedelta(days=days_initial - 1)
        # Try full backfill using Garmin's oldest available weigh-in.
        try:
            first_raw = api.get_first_weight() or {}
            first_entries = _extract_weight_entries(first_raw)
            if first_entries:
                first_date = _dt.date.fromisoformat(first_entries[0]["date"])
                if first_date < start:
                    start = first_date
        except Exception:
            pass
        print(f"  Initial weight sync from {start}")

    if start > today:
        return sorted(existing.values(), key=lambda x: x["date"])

    start_s = start.isoformat()
    end_s = today.isoformat()
    total_new = 0

    payloads = []
    for method_name, args in [
        ("get_weight_snapshot", [start_s, end_s]),
        ("get_weigh_ins", [start_s, end_s]),
        ("get_body_composition", [start_s, end_s]),
    ]:
        method = getattr(api, method_name, None)
        if not method:
            continue
        try:
            payloads.append(method(*args) or {})
            time.sleep(0.2)
        except Exception as e:
            print(f"  WARNING: {method_name} failed: {e}")

    for raw in payloads:
        entries = _extract_weight_entries(raw)
        before = len(existing)
        _merge_weight_entries(existing, entries)
        total_new += max(0, len(existing) - before)

    if not existing:
        cur = start
        while cur <= today:
            date_s = cur.isoformat()
            try:
                raw = api.get_daily_weigh_ins(date_s) or {}
                entries = _extract_weight_entries(raw)
                before = len(existing)
                _merge_weight_entries(existing, entries)
                total_new += max(0, len(existing) - before)
                time.sleep(0.15)
            except Exception:
                pass
            cur += _dt.timedelta(days=1)

    print(f"  Fetched {total_new} new weight entries")
    return sorted(existing.values(), key=lambda x: x["date"])


def main():
    parser = argparse.ArgumentParser(description="Sync Garmin activities to local JSON")
    parser.add_argument("--limit", type=int, default=None, help="Max activities to sync (for testing)")
    parser.add_argument("--since", type=str, default=None, help="Only sync activities after this date (YYYY-MM-DD)")
    parser.add_argument("--no-gpx", action="store_true", help="Skip GPS data download (faster)")
    parser.add_argument("--force", action="store_true", help="Re-download and overwrite already-cached activity files")
    args = parser.parse_args()

    from normalizer import normalize_summary, normalize_detail

    output_dir = Path(__file__).parent.parent / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    api = get_api()

    # Step 1: Get activity list
    raw_activities = fetch_activities(api, args.limit, args.since)

    # Step 2: Normalize summaries
    summaries = []
    for raw in raw_activities:
        try:
            s = normalize_summary(raw)
            if s.get("id"):
                summaries.append(s)
        except Exception as e:
            print(f"  WARNING: Failed to normalize activity {raw.get('activityId')}: {e}")

    # Save summary list immediately so the app can start loading
    restore_summary_temperatures(summaries, output_dir)
    save_json(output_dir / "activities.json", summaries)
    print(f"Saved {len(summaries)} activity summaries -> public/data/activities.json")

    # Step 3: Fetch and save details for each activity
    print(f"\nFetching details for {len(summaries)} activities (rate-limited)...")
    for i, summary in enumerate(summaries):
        activity_id = summary["id"]
        detail_path = output_dir / f"activity_{activity_id}.json"
        cached = json.loads(detail_path.read_text(encoding="utf-8")) if detail_path.exists() else {}
        if cached.get("temperatureSynced") and not args.force:
            summary["avgTemperature"] = cached.get("avgTemperature")
        else:
            temperature = fetch_activity_temperature(api, activity_id)
            if temperature is not None:
                cached.update(temperature)
                summary.update(temperature)
                save_json(output_dir / "activities.json", summaries)
                if detail_path.exists():
                    save_json(detail_path, cached)
            time.sleep(0.3)

        if detail_path.exists() and not args.force:
            cached = json.loads(detail_path.read_text(encoding="utf-8"))
            if "samples" not in cached:
                details = fetch_activity_details(api, activity_id)
                if isinstance(details.get("activityDetailMetrics"), list):
                    from normalizer import normalize_activity_samples
                    cached["samples"] = normalize_activity_samples(details)
                    save_json(detail_path, cached)
                time.sleep(0.3)
            if "avgTemperature" not in cached or summary.get("avgTemperature") is not None:
                cached["avgTemperature"] = summary.get("avgTemperature")
                save_json(detail_path, cached)
            if any("intensityType" not in lap for lap in cached.get("laps", [])):
                splits = fetch_activity_splits(api, activity_id)
                if isinstance(splits.get("lapDTOs"), list) or isinstance(splits.get("splits"), list):
                    cached["laps"] = normalize_detail(summary, {}, [], splits, [])["laps"]
                    save_json(detail_path, cached)
                    print(f"    Updated Garmin split classifications for {activity_id}")
                time.sleep(0.3)
            if "gear" not in cached:
                activity_gear = fetch_activity_gear(api, activity_id)
                if activity_gear is not None:
                    cached["gear"] = activity_gear
                    save_json(detail_path, cached)
                time.sleep(0.3)
            if args.no_gpx or not _needs_gpx_backfill(detail_path):
                print(f"  [{i+1}/{len(summaries)}] {activity_id} — already cached, skipping")
                continue
            print(f"  [{i+1}/{len(summaries)}] {activity_id} — cached without map/altimetry, backfilling GPX...")
            try:
                cached = json.loads(detail_path.read_text(encoding="utf-8"))
            except Exception:
                cached = {}
            gpx_coords = fetch_gpx_coords(api, activity_id)
            if gpx_coords:
                cached["gpxCoords"] = gpx_coords
                save_json(detail_path, cached)
                print(f"    Backfilled {len(gpx_coords)} GPX points")
            else:
                print("    WARNING: GPX still unavailable")
            time.sleep(0.3)
            continue

        print(f"  [{i+1}/{len(summaries)}] Fetching {activity_id} ({summary.get('title', '')})...")

        details = fetch_activity_details(api, activity_id)
        hr_zones = fetch_activity_hr_zones(api, activity_id)
        splits = fetch_activity_splits(api, activity_id)
        gpx_coords = [] if args.no_gpx else fetch_gpx_coords(api, activity_id)
        activity_gear = fetch_activity_gear(api, activity_id)

        try:
            full = normalize_detail(summary, details, hr_zones, splits, gpx_coords)
            blocks = fetch_workout_blocks(api, activity_id)
            if blocks is not None:
                full["workoutBlocks"] = blocks
            if activity_gear is not None:
                full["gear"] = activity_gear
            save_json(detail_path, full)
        except Exception as e:
            print(f"  WARNING: Failed to process detail for {activity_id}: {e}")

        # Rate limiting — critical to avoid Garmin banning the account
        time.sleep(0.5)

    save_json(output_dir / "activities.json", summaries)

    # Step 4: Compute and save global stats
    stats = compute_stats(summaries)

    # Fetch current VO2max from Garmin
    today = __import__("datetime").date.today().isoformat()
    current_vo2 = None

    def _extract_vo2(d):
        """Try to extract a VO2max value from a dict."""
        if not isinstance(d, dict):
            return None
        # First try: mostRecentVO2Max is a nested dict
        mrv = d.get("mostRecentVO2Max")
        if isinstance(mrv, dict):
            # Recurse into nested dict
            v = _extract_vo2(mrv)
            if v:
                return v
        elif mrv is not None:
            try:
                f = float(mrv)
                if 20 < f < 100:
                    return round(f, 1)
            except (TypeError, ValueError):
                pass
        # Then try specific VO2max field names (plausible range 20-100)
        for key in ("vo2MaxPreciseValue", "vo2MaxValue", "vO2MaxValue",
                    "vo2Max", "currentVo2Max", "generic"):
            v = d.get(key)
            if v is None:
                continue
            if isinstance(v, dict):
                nested = _extract_vo2(v)
                if nested:
                    return nested
            else:
                try:
                    f = float(v)
                    if 20 < f < 100:
                        return round(f, 1)
                except (TypeError, ValueError):
                    pass
        return None

    # Try training status (most likely to have current VO2max)
    for method_name, method_args in [
        ("get_training_status", [today]),
        ("get_max_metrics",     [today]),
        ("get_user_summary",    [today]),
    ]:
        try:
            result = getattr(api, method_name)(*method_args) or {}
            if isinstance(result, list):
                result = result[0] if result else {}
            print(f"  {method_name} keys: {list(result.keys())[:8]}")
            # Search top-level and one level deep
            v = _extract_vo2(result)
            if not v:
                for sub in result.values():
                    if isinstance(sub, dict):
                        v = _extract_vo2(sub)
                        if v:
                            break
            if v:
                current_vo2 = v
                print(f"  Found VO2max via {method_name}: {current_vo2}")
                break
        except Exception as e:
            print(f"  WARNING: {method_name} failed: {e}")

    # Fallback: max VO2max from last 30 activities (more accurate than just latest)
    if not current_vo2:
        recent_vo2 = sorted(
            [s["vo2max"] for s in summaries[:30] if s.get("vo2max") and s["vo2max"] > 20],
            reverse=True
        )
        if recent_vo2:
            current_vo2 = round(float(recent_vo2[0]), 1)
            print(f"  Using max VO2max from recent activities: {current_vo2}")

    if current_vo2:
        stats["currentVo2max"] = current_vo2

    save_json(output_dir / "stats.json", stats)
    print(f"\nDone! Saved stats -> public/data/stats.json")

    # Step 5: Fetch Garmin race predictions (current fitness estimates)
    print("Fetching race predictions from Garmin...")
    race_preds = {}
    try:
        race_preds = api.get_race_predictions() or {}
        print("  Fetched race predictions OK")
    except Exception as e:
        print(f"  WARNING: Could not fetch race predictions: {e}")

    # Step 6: Fetch official personal records from Garmin + cycling best efforts
    print("Fetching personal records from Garmin Connect...")
    running_efforts, garmin_cycling = _fetch_garmin_personal_records(api, output_dir)
    if running_efforts:
        print(f"  Fetched {len(running_efforts)} official running PRs from Garmin")
    else:
        print("  No official PRs found, falling back to lap-based calculation...")
        running_efforts = _compute_running_best_efforts(output_dir)
    if garmin_cycling:
        print(f"  Fetched {len(garmin_cycling)} cycling records from Garmin")
    cycling_efforts = garmin_cycling if garmin_cycling else _compute_cycling_best_efforts(output_dir)

    records = {
        "racePredictions": race_preds,
        "bestEfforts": running_efforts,
        "cyclingBestEfforts": cycling_efforts,
    }
    save_json(output_dir / "records.json", records)
    print("  Saved records -> public/data/records.json")

    # Step 7: Fetch sleep data incrementally
    print("Fetching sleep data (incremental)...")
    sleep_entries = _fetch_sleep_data(api, output_dir)
    save_json(output_dir / "sleep.json", sleep_entries)
    print(f"  Saved {len(sleep_entries)} sleep entries -> public/data/sleep.json")

    # Step 8: Fetch gear
    print("Fetching gear...")
    gear_items = _fetch_gear_data(api)
    save_json(output_dir / "gear.json", gear_items)
    print(f"  Saved {len(gear_items)} gear items -> public/data/gear.json")

    # Step 9: Fetch weight/body composition data incrementally
    print("Fetching weight data (incremental)...")
    weight_entries = _fetch_weight_data(api, output_dir)
    save_json(output_dir / "weight.json", weight_entries)
    print(f"  Saved {len(weight_entries)} weight entries -> public/data/weight.json")

    print("Run 'npm run dev' to open the app.")


def compute_stats(summaries: list) -> dict:
    """Compute global stats that don't change per-activity."""
    by_sport = {}
    for s in summaries:
        sport = s.get("sport", "other")
        by_sport.setdefault(sport, []).append(s)

    vo2max_history = [
        {"date": s["startTime"][:10], "value": s["vo2max"]}
        for s in summaries
        if s.get("vo2max")
    ]
    vo2max_history.sort(key=lambda x: x["date"])

    return {
        "totalActivities": len(summaries),
        "byType": {sport: len(acts) for sport, acts in by_sport.items()},
        "vo2maxHistory": vo2max_history,
        "syncedAt": __import__("datetime").datetime.now().isoformat(),
    }


if __name__ == "__main__":
    main()

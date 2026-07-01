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


def fetch_activity_hr_zones(api, activity_id: int) -> list:
    """Fetch HR zone breakdown (seconds per zone) for a single activity."""
    result = _try(api.get_activity_hr_in_timezones, activity_id, label=f"hr_zones {activity_id}")
    return result or []


def fetch_activity_splits(api, activity_id: int) -> dict:
    """Fetch lap/split data for a single activity."""
    result = _try(api.get_activity_splits, activity_id, label=f"splits {activity_id}")
    return result or {}


def fetch_gpx_coords(api, activity_id: int) -> list:
    """Return [[lat, lon, ele?], ...] from GPX download, or [] on failure."""
    import re
    import garminconnect
    try:
        gpx_data = api.download_activity(
            activity_id,
            dl_fmt=garminconnect.Garmin.ActivityDownloadFormat.GPX,
        )
        if not gpx_data:
            return []
        text = gpx_data.decode("utf-8", errors="ignore")
        # Extract full trkpt blocks to capture lat, lon and optional ele
        blocks = re.findall(
            r'<trkpt lat="([\d.\-]+)" lon="([\d.\-]+)"[^>]*>(.*?)</trkpt>',
            text, re.DOTALL
        )
        coords = []
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
    except Exception:
        return []


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


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

        item = {
            'uuid':       uuid,
            'name':       name,
            'type':       g.get('gearTypeName', ''),
            'status':     g.get('gearStatusName', ''),
            'dateBegin':  (g.get('dateBegin') or '')[:10],
            'dateEnd':    (g.get('dateEnd') or '')[:10] or None,
            'maxMeters':  g.get('maximumMeters'),
            'totalDistance': None,
            'totalActivities': None,
        }

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
    save_json(output_dir / "activities.json", summaries)
    print(f"Saved {len(summaries)} activity summaries -> public/data/activities.json")

    # Step 3: Fetch and save details for each activity
    print(f"\nFetching details for {len(summaries)} activities (rate-limited)...")
    for i, summary in enumerate(summaries):
        activity_id = summary["id"]
        detail_path = output_dir / f"activity_{activity_id}.json"

        if detail_path.exists() and not args.force:
            print(f"  [{i+1}/{len(summaries)}] {activity_id} — already cached, skipping")
            continue

        print(f"  [{i+1}/{len(summaries)}] Fetching {activity_id} ({summary.get('title', '')})...")

        details = fetch_activity_details(api, activity_id)
        hr_zones = fetch_activity_hr_zones(api, activity_id)
        splits = fetch_activity_splits(api, activity_id)
        gpx_coords = [] if args.no_gpx else fetch_gpx_coords(api, activity_id)

        try:
            full = normalize_detail(summary, details, hr_zones, splits, gpx_coords)
            save_json(detail_path, full)
        except Exception as e:
            print(f"  WARNING: Failed to process detail for {activity_id}: {e}")

        # Rate limiting — critical to avoid Garmin banning the account
        time.sleep(0.5)

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

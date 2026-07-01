#!/usr/bin/env python3
"""
Fetch physiological settings from Garmin Connect.
Strategy:
  1. Try user profile for maxHR
  2. Fallback: take max(maxHR) across the last 100 activities
  3. Estimate LTHR = 89% of maxHR (standard formula)

Outputs JSON to stdout: { maxHR?, lthrRunning?, warnings? }
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")


def main():
    try:
        import garminconnect
    except ImportError:
        _exit_err("garminconnect not installed. Run: pip install -r requirements.txt")

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")
    if not email or not password:
        _exit_err("Missing GARMIN_EMAIL or GARMIN_PASSWORD in .env")

    api = garminconnect.Garmin(email, password)
    try:
        api.login()
    except Exception as e:
        _exit_err(f"Login failed: {e}")

    result: dict = {}
    warnings: list[str] = []
    max_hr: int | None = None

    # ── Strategy 1: user profile ──────────────────────────────────────────
    try:
        profile = api.get_user_profile()
        if isinstance(profile, dict):
            # Garmin stores maxHR at different paths depending on account type
            max_hr = (
                _safe(profile, "maxHeartRate")
                or _safe(profile, "heartRate", "maxHeartRate")
                or _safe(profile, "biometricProfile", "maxHeartRate")
            )
    except Exception as e:
        warnings.append(f"Profile fetch skipped: {e}")

    # ── Strategy 2: derive from activity history ──────────────────────────
    if not max_hr:
        try:
            activities = api.get_activities(0, 100)
            hrs = [int(a["maxHR"]) for a in activities if a.get("maxHR")]
            if hrs:
                max_hr = max(hrs)
                warnings.append(
                    f"maxHR derived from activity history ({len(hrs)} activities)"
                )
        except Exception as e:
            warnings.append(f"Activity fallback failed: {e}")

    # ── Build result ──────────────────────────────────────────────────────
    if max_hr and int(max_hr) > 100:
        result["maxHR"] = int(max_hr)
        result["lthrRunning"] = round(int(max_hr) * 0.89)
    else:
        warnings.append("Could not determine Max HR")

    if warnings:
        result["warnings"] = warnings

    print(json.dumps(result))


def _safe(d: dict, *keys):
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d if isinstance(d, (int, float)) and d > 0 else None


def _exit_err(msg: str):
    print(json.dumps({"error": msg}))
    sys.exit(1)


if __name__ == "__main__":
    main()

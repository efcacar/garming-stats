import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sync


class StopAfterActivities(Exception):
    pass


class SyncOrderTests(unittest.TestCase):
    def test_global_sync_processes_newest_first_and_announces_each_update(self):
        raw = [
            {"activityId": 1, "startTimeLocal": "2023-01-01 10:00:00"},
            {"activityId": 2, "startTimeLocal": "2025-01-01 10:00:00"},
            {"activityId": 3, "startTimeLocal": "2024-01-01 10:00:00"},
        ]
        processed = []
        output = io.StringIO()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with (
                patch.object(sync, "__file__", str(root / "fetch" / "sync.py")),
                patch.object(sys, "argv", ["sync.py"]),
                patch.object(sync, "get_api", return_value=object()),
                patch.object(sync, "fetch_activities", return_value=raw),
                patch.object(sync, "fetch_activity_temperature", return_value=None),
                patch.object(sync, "sync_activity_detail", side_effect=lambda api, summary, output_dir, **kwargs: processed.append(summary["id"]) or True),
                patch.object(sync.time, "sleep"),
                patch.object(sync, "compute_stats", side_effect=StopAfterActivities),
                contextlib.redirect_stdout(output),
            ):
                with self.assertRaises(StopAfterActivities):
                    sync.main()

            summaries = json.loads((root / "public" / "data" / "activities.json").read_text())

        self.assertEqual(processed, [2, 3, 1])
        self.assertEqual([summary["id"] for summary in summaries], [2, 3, 1])
        self.assertEqual(output.getvalue().splitlines().count("SYNC_DATA_UPDATED"), 4)

    def test_single_activity_keeps_history_and_announces_update(self):
        existing = [
            {"id": 1, "startTime": "2023-01-01 10:00:00"},
            {"id": 2, "startTime": "2025-01-01 10:00:00"},
        ]
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "public" / "data"
            data.mkdir(parents=True)
            (data / "activities.json").write_text(json.dumps(existing))
            with (
                patch.object(sync, "__file__", str(root / "fetch" / "sync.py")),
                patch.object(sys, "argv", ["sync.py", "--activity-id", "1", "--force"]),
                patch.object(sync, "get_api", return_value=object()),
                patch.object(sync, "fetch_activity_temperature", return_value=None),
                patch.object(sync, "sync_activity_detail", return_value=True) as detail,
                patch.object(sync.time, "sleep"),
                contextlib.redirect_stdout(output),
            ):
                sync.main()
            self.assertEqual(json.loads((data / "activities.json").read_text()), existing)

        self.assertEqual(detail.call_args.args[1]["id"], 1)
        self.assertTrue(detail.call_args.kwargs["force"])
        self.assertEqual(output.getvalue().splitlines().count("SYNC_DATA_UPDATED"), 2)


if __name__ == "__main__":
    unittest.main()

"""
Run lightweight benchmark pipeline and export metrics.

Usage:
  python scripts/benchmark.py
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.models import CandidateProfile, Event, Job
from app.services.evaluation import compare_baseline_vs_improved, engagement_metrics, precision_recall_at_k
from app.services.events import process_next_event


def main() -> None:
    out_dir = Path("reports")
    out_dir.mkdir(exist_ok=True)
    db = SessionLocal()
    try:
        pending = db.query(Event).filter(Event.status == "PENDING").count()
        processed = 0
        while True:
            event = process_next_event(db)
            if not event:
                break
            processed += 1

        summary = {
            "job_count": db.query(Job).count(),
            "candidate_profile_count": db.query(CandidateProfile).count(),
            "pending_events_before": pending,
            "processed_events": processed,
            "quality": precision_recall_at_k(db, k=5),
            "engagement": engagement_metrics(db),
            "comparison": compare_baseline_vs_improved(db, k=5),
        }
    finally:
        db.close()

    with (out_dir / "benchmark_metrics.json").open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    with (out_dir / "benchmark_metrics.csv").open("w", encoding="utf-8") as f:
        f.write("metric,value\n")
        f.write(f"precision_at_5,{summary['quality']['precision_at_k']}\n")
        f.write(f"recall_at_5,{summary['quality']['recall_at_k']}\n")
        f.write(f"ctr,{summary['engagement']['ctr']}\n")
        f.write(f"apply_rate,{summary['engagement']['apply_rate']}\n")
        f.write(f"ignore_rate,{summary['engagement']['ignore_rate']}\n")
        f.write(f"delta_precision_at_5,{summary['comparison']['delta']['precision_at_k']}\n")
        f.write(f"delta_recall_at_5,{summary['comparison']['delta']['recall_at_k']}\n")

    print("Benchmark completed. Output in reports/benchmark_metrics.json and .csv")


if __name__ == "__main__":
    main()

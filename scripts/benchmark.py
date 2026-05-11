"""
Run benchmark pipeline: evaluate recommendation quality across strategies.

Usage:
  python scripts/benchmark.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Force fast local matching for benchmark (no external API calls)
os.environ["MATCHING_STRATEGY"] = "proficiency"
# Disable email sending during benchmark
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASS"] = ""

from app.database import SessionLocal
from app.models import CandidateProfile, Event, Job, Recommendation
from app.services.evaluation import compare_baseline_vs_improved, engagement_metrics, precision_recall_at_k
from app.services.events import process_next_event


def main() -> None:
    out_dir = Path("reports")
    out_dir.mkdir(exist_ok=True)
    db = SessionLocal()
    try:
        # --- Process any pending events ---
        pending = db.query(Event).filter(Event.status == "PENDING").count()
        processed = 0
        t0 = time.time()
        while True:
            event = process_next_event(db)
            if not event:
                break
            processed += 1
        processing_time = time.time() - t0

        # --- Gather counts ---
        job_count = db.query(Job).count()
        candidate_count = db.query(CandidateProfile).count()
        rec_count = db.query(Recommendation).count()
        active_candidates = db.query(CandidateProfile).filter(CandidateProfile.status == "ACTIVE").count()
        passive_candidates = db.query(CandidateProfile).filter(CandidateProfile.status == "PASSIVE").count()
        inactive_candidates = db.query(CandidateProfile).filter(CandidateProfile.status == "INACTIVE").count()

        done_events = db.query(Event).filter(Event.status == "DONE").count()
        failed_events = db.query(Event).filter(Event.status == "FAILED").count()

        # --- Evaluation metrics ---
        quality_k5 = precision_recall_at_k(db, k=5)
        quality_k10 = precision_recall_at_k(db, k=10)
        engagement = engagement_metrics(db)
        comparison = compare_baseline_vs_improved(db, k=5)

        summary = {
            "dataset": {
                "job_count": job_count,
                "candidate_count": candidate_count,
                "recommendation_count": rec_count,
                "candidate_status": {
                    "active": active_candidates,
                    "passive": passive_candidates,
                    "inactive": inactive_candidates,
                },
            },
            "events": {
                "pending_before": pending,
                "processed": processed,
                "done_total": done_events,
                "failed_total": failed_events,
                "processing_time_seconds": round(processing_time, 2),
            },
            "recommendation_quality": {
                "precision_at_5": round(quality_k5["precision_at_k"], 4),
                "recall_at_5": round(quality_k5["recall_at_k"], 4),
                "precision_at_10": round(quality_k10["precision_at_k"], 4),
                "recall_at_10": round(quality_k10["recall_at_k"], 4),
            },
            "engagement": {
                "ctr": round(engagement["ctr"], 4),
                "apply_rate": round(engagement["apply_rate"], 4),
                "ignore_rate": round(engagement["ignore_rate"], 4),
            },
            "model_comparison": {
                "baseline": {
                    "precision_at_5": round(comparison["baseline"]["precision_at_k"], 4),
                    "recall_at_5": round(comparison["baseline"]["recall_at_k"], 4),
                },
                "improved": {
                    "precision_at_5": round(comparison["improved"]["precision_at_k"], 4),
                    "recall_at_5": round(comparison["improved"]["recall_at_k"], 4),
                },
                "delta": {
                    "precision_at_5": round(comparison["delta"]["precision_at_k"], 4),
                    "recall_at_5": round(comparison["delta"]["recall_at_k"], 4),
                },
            },
        }
    finally:
        db.close()

    # --- Write JSON ---
    with (out_dir / "benchmark_metrics.json").open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # --- Write CSV ---
    with (out_dir / "benchmark_metrics.csv").open("w", encoding="utf-8") as f:
        f.write("metric,value\n")
        f.write(f"precision_at_5,{summary['recommendation_quality']['precision_at_5']}\n")
        f.write(f"recall_at_5,{summary['recommendation_quality']['recall_at_5']}\n")
        f.write(f"precision_at_10,{summary['recommendation_quality']['precision_at_10']}\n")
        f.write(f"recall_at_10,{summary['recommendation_quality']['recall_at_10']}\n")
        f.write(f"ctr,{summary['engagement']['ctr']}\n")
        f.write(f"apply_rate,{summary['engagement']['apply_rate']}\n")
        f.write(f"ignore_rate,{summary['engagement']['ignore_rate']}\n")
        f.write(f"baseline_precision_at_5,{summary['model_comparison']['baseline']['precision_at_5']}\n")
        f.write(f"baseline_recall_at_5,{summary['model_comparison']['baseline']['recall_at_5']}\n")
        f.write(f"improved_precision_at_5,{summary['model_comparison']['improved']['precision_at_5']}\n")
        f.write(f"improved_recall_at_5,{summary['model_comparison']['improved']['recall_at_5']}\n")
        f.write(f"delta_precision_at_5,{summary['model_comparison']['delta']['precision_at_5']}\n")
        f.write(f"delta_recall_at_5,{summary['model_comparison']['delta']['recall_at_5']}\n")
        f.write(f"candidate_active,{summary['dataset']['candidate_status']['active']}\n")
        f.write(f"candidate_passive,{summary['dataset']['candidate_status']['passive']}\n")
        f.write(f"candidate_inactive,{summary['dataset']['candidate_status']['inactive']}\n")

    print("\n📊 Benchmark Results:")
    print(f"   Dataset: {summary['dataset']['job_count']} jobs, {summary['dataset']['candidate_count']} candidates")
    print(f"   Recommendations generated: {summary['dataset']['recommendation_count']}")
    print(f"   Events processed: {summary['events']['processed']} in {summary['events']['processing_time_seconds']}s")
    print(f"\n   Precision@5:  {summary['recommendation_quality']['precision_at_5']}")
    print(f"   Recall@5:    {summary['recommendation_quality']['recall_at_5']}")
    print(f"   Precision@10: {summary['recommendation_quality']['precision_at_10']}")
    print(f"   Recall@10:   {summary['recommendation_quality']['recall_at_10']}")
    print(f"\n   CTR:          {summary['engagement']['ctr']}")
    print(f"   Apply Rate:   {summary['engagement']['apply_rate']}")
    print(f"   Ignore Rate:  {summary['engagement']['ignore_rate']}")
    print(f"\n   Baseline  P@5={summary['model_comparison']['baseline']['precision_at_5']}  R@5={summary['model_comparison']['baseline']['recall_at_5']}")
    print(f"   Improved  P@5={summary['model_comparison']['improved']['precision_at_5']}  R@5={summary['model_comparison']['improved']['recall_at_5']}")
    print(f"   Delta     P@5={summary['model_comparison']['delta']['precision_at_5']}  R@5={summary['model_comparison']['delta']['recall_at_5']}")
    print(f"\n   Candidate States: ACTIVE={summary['dataset']['candidate_status']['active']}, PASSIVE={summary['dataset']['candidate_status']['passive']}, INACTIVE={summary['dataset']['candidate_status']['inactive']}")
    print(f"\n✅ Output saved to reports/benchmark_metrics.json and .csv")


if __name__ == "__main__":
    main()

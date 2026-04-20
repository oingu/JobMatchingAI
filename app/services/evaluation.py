from sqlalchemy.orm import Session

from app.models import InteractionLog, Recommendation


def precision_recall_at_k(db: Session, k: int = 5) -> dict[str, float]:
    recs = db.query(Recommendation).all()
    if not recs:
        return {"precision_at_k": 0.0, "recall_at_k": 0.0}

    by_candidate: dict[int, list[Recommendation]] = {}
    for rec in recs:
        by_candidate.setdefault(rec.candidate_id, []).append(rec)

    precision_values = []
    recall_values = []
    for candidate_id, candidate_recs in by_candidate.items():
        sorted_recs = sorted(candidate_recs, key=lambda rec: rec.final_score, reverse=True)
        top_k = sorted_recs[:k]
        top_k_job_ids = {rec.job_id for rec in top_k}

        applied_job_ids = {
            row.job_id
            for row in db.query(InteractionLog)
            .filter(
                InteractionLog.user_id == candidate_id,
                InteractionLog.event_type == "apply",
                InteractionLog.job_id.isnot(None),
            )
            .all()
        }
        if not top_k_job_ids:
            continue
        relevant_hits = len(top_k_job_ids.intersection(applied_job_ids))
        precision_values.append(relevant_hits / len(top_k_job_ids))
        recall_values.append(relevant_hits / len(applied_job_ids) if applied_job_ids else 0.0)

    if not precision_values:
        return {"precision_at_k": 0.0, "recall_at_k": 0.0}
    return {
        "precision_at_k": sum(precision_values) / len(precision_values),
        "recall_at_k": sum(recall_values) / len(recall_values),
    }


def engagement_metrics(db: Session) -> dict[str, float]:
    views = db.query(InteractionLog).filter(InteractionLog.event_type == "view").count()
    clicks = db.query(InteractionLog).filter(InteractionLog.event_type == "click").count()
    applies = db.query(InteractionLog).filter(InteractionLog.event_type == "apply").count()

    ctr = clicks / views if views else 0.0
    apply_rate = applies / clicks if clicks else 0.0
    ignore_rate = 1.0 - ctr if views else 0.0
    return {
        "ctr": ctr,
        "apply_rate": apply_rate,
        "ignore_rate": ignore_rate,
    }


def _quality_from_ranked_items(
    db: Session,
    by_candidate: dict[int, list[tuple[int, float]]],
    k: int = 5,
) -> dict[str, float]:
    precision_values = []
    recall_values = []
    for candidate_id, scored_jobs in by_candidate.items():
        top_k_job_ids = {job_id for job_id, _ in sorted(scored_jobs, key=lambda item: item[1], reverse=True)[:k]}
        if not top_k_job_ids:
            continue
        applied_job_ids = {
            row.job_id
            for row in db.query(InteractionLog)
            .filter(
                InteractionLog.user_id == candidate_id,
                InteractionLog.event_type == "apply",
                InteractionLog.job_id.isnot(None),
            )
            .all()
        }
        hits = len(top_k_job_ids.intersection(applied_job_ids))
        precision_values.append(hits / len(top_k_job_ids))
        recall_values.append(hits / len(applied_job_ids) if applied_job_ids else 0.0)

    if not precision_values:
        return {"precision_at_k": 0.0, "recall_at_k": 0.0}
    return {
        "precision_at_k": sum(precision_values) / len(precision_values),
        "recall_at_k": sum(recall_values) / len(recall_values),
    }


def compare_baseline_vs_improved(db: Session, k: int = 5) -> dict[str, dict[str, float]]:
    recs = db.query(Recommendation).all()
    improved: dict[int, list[tuple[int, float]]] = {}
    baseline: dict[int, list[tuple[int, float]]] = {}
    for rec in recs:
        improved.setdefault(rec.candidate_id, []).append((rec.job_id, rec.final_score))
        baseline_score = (0.7 * rec.skill_match) + (0.3 * rec.preference_match)
        baseline.setdefault(rec.candidate_id, []).append((rec.job_id, baseline_score))

    improved_quality = _quality_from_ranked_items(db, improved, k=k)
    baseline_quality = _quality_from_ranked_items(db, baseline, k=k)
    return {
        "baseline": baseline_quality,
        "improved": improved_quality,
        "delta": {
            "precision_at_k": improved_quality["precision_at_k"] - baseline_quality["precision_at_k"],
            "recall_at_k": improved_quality["recall_at_k"] - baseline_quality["recall_at_k"],
        },
    }

"""Recommendation engine with proficiency-weighted skill matching.

Strategies (controlled by ``MATCHING_STRATEGY`` env var):

- **proficiency** — (default) Each skill has a proficiency level 1-5.
  Vectors are weighted by ``level / max_level`` per dimension, then
  ``cosine(skill_vector_user, skill_vector_job)`` is computed.
- **tfidf** — TF-IDF on skill names as text tokens (ignores proficiency).
- **embedding** — Dense semantic vectors via sentence-transformers.
- **gemini** — Dense semantic vectors via Google Gemini Embedding API.
- **set** — Binary set-intersection cosine (legacy).
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CandidateProfile, Job, Recommendation
from app.services.vectorizer import (
    ProficiencyVectorizer,
    SkillList,
    TfidfSkillVectorizer,
    skills_to_csv,
)
from app.utils.time import now_utc

logger = logging.getLogger(__name__)


@dataclass
class MatchScore:
    candidate_id: int
    job_id: int
    skill_match: float
    preference_match: float
    activity_score: float
    final_score: float


# ---------------------------------------------------------------------------
# Helpers to normalise stored skills  (JSON list or legacy CSV string)
# ---------------------------------------------------------------------------

def _parse_skills(raw) -> SkillList:
    """Accept both new JSON ``[{name, level}]`` and legacy CSV ``'a,b,c'``."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str) and raw.strip():
        return [{"name": s.strip().lower(), "level": 3} for s in raw.split(",") if s.strip()]
    return []


def _tokenize_csv(value: str) -> set[str]:
    if not value:
        return set()
    return {t.strip().lower() for t in value.split(",") if t.strip()}


# ---------------------------------------------------------------------------
# Skill-match functions — one per strategy
# ---------------------------------------------------------------------------

def _skill_scores_proficiency(
    job_skills: SkillList, candidates: list[CandidateProfile],
) -> list[float]:
    """Proficiency-weighted cosine similarity."""
    if not candidates:
        return []
    vectorizer = ProficiencyVectorizer()
    candidate_skills = [_parse_skills(c.skills) for c in candidates]
    return vectorizer.batch_compare(job_skills, candidate_skills)


def _skill_scores_tfidf(
    job_skills: SkillList, candidates: list[CandidateProfile],
) -> list[float]:
    if not candidates:
        return []
    vectorizer = TfidfSkillVectorizer()
    job_csv = skills_to_csv(job_skills)
    candidate_csvs = [skills_to_csv(_parse_skills(c.skills)) for c in candidates]
    return vectorizer.batch_compare(job_csv, candidate_csvs)


def _skill_scores_embedding(
    job_skills: SkillList, candidates: list[CandidateProfile],
) -> list[float]:
    from app.services.vectorizer import EmbeddingVectorizer
    if not candidates:
        return []
    job_csv = skills_to_csv(job_skills)
    candidate_csvs = [skills_to_csv(_parse_skills(c.skills)) for c in candidates]
    return EmbeddingVectorizer.batch_compare(job_csv, candidate_csvs)


def _skill_scores_gemini(
    job_skills: SkillList, candidates: list[CandidateProfile],
) -> list[float]:
    """Compute skill match using Gemini Embedding API."""
    from app.services.cv_parser_gemini import batch_cosine_with_gemini_embeddings
    if not candidates:
        return []
    candidate_skills = [_parse_skills(c.skills) for c in candidates]
    return batch_cosine_with_gemini_embeddings(job_skills, candidate_skills)


def _skill_scores_cohere(
    job_skills: SkillList, candidates: list[CandidateProfile],
) -> list[float]:
    """Compute skill match using Cohere Embed API."""
    from app.services.cv_parser_cohere import batch_cosine_with_cohere_embeddings
    if not candidates:
        return []
    candidate_skills = [_parse_skills(c.skills) for c in candidates]
    return batch_cosine_with_cohere_embeddings(job_skills, candidate_skills)

def cosine_from_sets(a: set[str], b: set[str]) -> float:
    """Legacy binary-vector cosine (set intersection)."""
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    denom = math.sqrt(len(a)) * math.sqrt(len(b))
    return intersection / denom if denom else 0.0


def _skill_scores_set(
    job_skills: SkillList, candidates: list[CandidateProfile],
) -> list[float]:
    job_names = {s.get("name", "").lower() for s in job_skills if s.get("name")}
    return [
        cosine_from_sets(
            {s.get("name", "").lower() for s in _parse_skills(c.skills) if s.get("name")},
            job_names,
        )
        for c in candidates
    ]


_STRATEGY_FN = {
    "proficiency": _skill_scores_proficiency,
    "tfidf": _skill_scores_tfidf,
    "embedding": _skill_scores_embedding,
    "gemini": _skill_scores_gemini,
    "cohere": _skill_scores_cohere,
    "set": _skill_scores_set,
}


def _get_skill_scores(job_skills: SkillList, candidates: list[CandidateProfile]) -> list[float]:
    strategy = settings.matching_strategy
    fn = _STRATEGY_FN.get(strategy)
    if fn is None:
        logger.warning("Unknown MATCHING_STRATEGY '%s', falling back to proficiency.", strategy)
        fn = _skill_scores_proficiency
    return fn(job_skills, candidates)


# ---------------------------------------------------------------------------
# Preference & final score
# ---------------------------------------------------------------------------

def preference_match(profile: CandidateProfile, job: Job) -> float:
    location_score = 1.0 if job.location.lower() in _tokenize_csv(profile.preferred_locations) else 0.0
    salary_score = 1.0 if profile.preferred_salary_min <= job.salary_max else 0.0
    level_score = 1.0 if profile.experience_level.lower() == job.experience_level.lower() else 0.5
    return (location_score * 0.4) + (salary_score * 0.4) + (level_score * 0.2)


def compute_final_score(skill_match: float, pref_match: float, activity: float) -> float:
    w1, w2, w3 = settings.score_w1, settings.score_w2, settings.score_w3
    return (w1 * skill_match) + (w2 * pref_match) + (w3 * activity)


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def rank_candidates_for_job(db: Session, job: Job, top_k: int = 5) -> list[MatchScore]:
    candidates = [c for c in db.query(CandidateProfile).all() if c.status != "INACTIVE"]
    job_skills = _parse_skills(job.required_skills)
    skill_scores = _get_skill_scores(job_skills, candidates)

    ranked: list[MatchScore] = []
    for profile, skill in zip(candidates, skill_scores):
        pref = preference_match(profile, job)
        activity = profile.activity_score
        ranked.append(
            MatchScore(
                candidate_id=profile.user_id,
                job_id=job.id,
                skill_match=skill,
                preference_match=pref,
                activity_score=activity,
                final_score=compute_final_score(skill, pref, activity),
            )
        )
    ranked.sort(key=lambda m: m.final_score, reverse=True)
    return ranked[:top_k]


def rank_jobs_for_candidate(db: Session, profile: CandidateProfile, top_k: int = 5) -> list[MatchScore]:
    jobs = db.query(Job).all()
    if not jobs:
        return []

    candidate_skills = _parse_skills(profile.skills)
    strategy = settings.matching_strategy

    if strategy == "proficiency":
        vectorizer = ProficiencyVectorizer()
        job_skills_list = [_parse_skills(j.required_skills) for j in jobs]
        scores = vectorizer.batch_compare(candidate_skills, job_skills_list)
    elif strategy == "tfidf":
        vectorizer_t = TfidfSkillVectorizer()
        c_csv = skills_to_csv(candidate_skills)
        j_csvs = [skills_to_csv(_parse_skills(j.required_skills)) for j in jobs]
        scores = vectorizer_t.batch_compare(c_csv, j_csvs)
    elif strategy == "embedding":
        from app.services.vectorizer import EmbeddingVectorizer
        c_csv = skills_to_csv(candidate_skills)
        j_csvs = [skills_to_csv(_parse_skills(j.required_skills)) for j in jobs]
        scores = EmbeddingVectorizer.batch_compare(c_csv, j_csvs)
    elif strategy == "gemini":
        from app.services.cv_parser_gemini import batch_cosine_with_gemini_embeddings
        job_skills_list = [_parse_skills(j.required_skills) for j in jobs]
        scores = batch_cosine_with_gemini_embeddings(candidate_skills, job_skills_list)
    elif strategy == "cohere":
        from app.services.cv_parser_cohere import batch_cosine_with_cohere_embeddings
        job_skills_list = [_parse_skills(j.required_skills) for j in jobs]
        scores = batch_cosine_with_cohere_embeddings(candidate_skills, job_skills_list)
    else:
        c_names = {s.get("name", "").lower() for s in candidate_skills if s.get("name")}
        scores = [
            cosine_from_sets(
                c_names,
                {s.get("name", "").lower() for s in _parse_skills(j.required_skills) if s.get("name")},
            )
            for j in jobs
        ]

    ranked: list[MatchScore] = []
    for job, skill in zip(jobs, scores):
        pref = preference_match(profile, job)
        activity = profile.activity_score
        ranked.append(
            MatchScore(
                candidate_id=profile.user_id,
                job_id=job.id,
                skill_match=skill,
                preference_match=pref,
                activity_score=activity,
                final_score=compute_final_score(skill, pref, activity),
            )
        )
    ranked.sort(key=lambda m: m.final_score, reverse=True)
    return ranked[:top_k]


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def persist_recommendations(
    db: Session,
    source_event_id: int,
    scores: list[MatchScore],
    *,
    replace_for_candidate: int | None = None,
    replace_for_job: int | None = None,
) -> None:
    """Save recommendation scores, replacing stale entries.

    When ``replace_for_candidate`` is set, **all** previous recommendations
    for that candidate are removed first (candidate updated their profile →
    old scores are obsolete).  Likewise ``replace_for_job`` removes all
    previous recommendations for that job.
    """
    if replace_for_candidate is not None:
        db.query(Recommendation).filter(
            Recommendation.candidate_id == replace_for_candidate,
        ).delete()
    if replace_for_job is not None:
        db.query(Recommendation).filter(
            Recommendation.job_id == replace_for_job,
        ).delete()

    for score in scores:
        db.add(
            Recommendation(
                source_event_id=source_event_id,
                job_id=score.job_id,
                candidate_id=score.candidate_id,
                skill_match=score.skill_match,
                preference_match=score.preference_match,
                activity_score=score.activity_score,
                final_score=score.final_score,
                created_at=now_utc(),
            )
        )
    db.commit()


def get_candidate_feed(db: Session, candidate_id: int, limit: int = 10) -> list[Recommendation]:
    return (
        db.query(Recommendation)
        .filter(Recommendation.candidate_id == candidate_id)
        .order_by(desc(Recommendation.final_score), desc(Recommendation.created_at))
        .limit(limit)
        .all()
    )

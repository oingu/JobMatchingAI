from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import AuthToken, CandidateProfile, Event, InteractionLog, Job, User
from app.services.auth import authenticate, issue_token
from app.services.behavior import reset_no_response_streak, update_user_behavior_state
from app.services.events import enqueue_event, process_next_event, retry_failed_event
from app.services.notifications import send_notification
from app.services.cv_parser import (
    _extract_skills, _extract_experience_level, _extract_locations, _extract_salary,
    _detect_percentage, _detect_fraction, _detect_star_rating, _pct_to_level,
)
from app.services.recommendation import rank_candidates_for_job, cosine_from_sets
from app.services.vectorizer import ProficiencyVectorizer, TfidfSkillVectorizer
from app.utils.time import now_utc


def setup_db() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal()


def test_matching_returns_ranked_candidates():
    db = setup_db()
    recruiter = User(name="Rec", email="rec@test.com", role="recruiter", is_online=False)
    candidate = User(name="Cand", email="cand@test.com", role="candidate", is_online=False)
    db.add_all([recruiter, candidate])
    db.commit()
    db.refresh(recruiter)
    db.refresh(candidate)

    profile = CandidateProfile(
        user_id=candidate.id,
        skills=[{"name": "python", "level": 5}, {"name": "fastapi", "level": 4}, {"name": "sql", "level": 3}],
        experience_level="junior",
        preferred_locations="hanoi",
        preferred_salary_min=1000,
        activity_score=0.9,
        status="ACTIVE",
        last_login_at=now_utc(),
        updated_at=now_utc(),
    )
    job = Job(
        recruiter_id=recruiter.id,
        title="Backend Engineer",
        required_skills=[{"name": "python", "level": 3}, {"name": "sql", "level": 2}],
        location="hanoi",
        salary_min=800,
        salary_max=2000,
        experience_level="junior",
    )
    db.add_all([profile, job])
    db.commit()
    db.refresh(job)

    ranked = rank_candidates_for_job(db, job, top_k=5)
    assert len(ranked) == 1
    assert ranked[0].candidate_id == candidate.id
    assert ranked[0].final_score > 0


def test_behavior_state_changes_for_inactive_candidate():
    db = setup_db()
    candidate = User(name="Cand", email="cand2@test.com", role="candidate", is_online=False)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    profile = CandidateProfile(
        user_id=candidate.id,
        skills=[{"name": "java", "level": 3}],
        experience_level="junior",
        preferred_locations="hanoi",
        preferred_salary_min=500,
        activity_score=1.0,
        status="ACTIVE",
        last_login_at=now_utc() - timedelta(days=120),
        updated_at=now_utc(),
    )
    db.add(profile)
    db.commit()

    update_user_behavior_state(db, candidate.id)
    db.refresh(profile)
    assert profile.status in {"PASSIVE", "INACTIVE"}


def test_event_processing_updates_event_status():
    db = setup_db()
    recruiter = User(name="Rec", email="rec2@test.com", role="recruiter", is_online=False)
    candidate = User(name="Cand", email="cand3@test.com", role="candidate", is_online=False)
    db.add_all([recruiter, candidate])
    db.commit()
    db.refresh(recruiter)
    db.refresh(candidate)

    db.add(
        CandidateProfile(
            user_id=candidate.id,
            skills=[{"name": "python", "level": 4}, {"name": "sql", "level": 3}],
            experience_level="junior",
            preferred_locations="hanoi",
            preferred_salary_min=1000,
            activity_score=0.8,
            status="ACTIVE",
            last_login_at=now_utc(),
            updated_at=now_utc(),
        )
    )
    db.commit()
    job = Job(
        recruiter_id=recruiter.id,
        title="Data Engineer",
        required_skills=[{"name": "python", "level": 3}],
        location="hanoi",
        salary_min=1000,
        salary_max=2500,
        experience_level="junior",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    event = enqueue_event(db, "job_created", {"job_id": job.id, "recruiter_id": recruiter.id})
    result = process_next_event(db)
    assert isinstance(result, Event)
    assert result.id == event.id
    assert result.status == "DONE"


def test_notification_idempotency_and_no_response_reset():
    db = setup_db()
    candidate = User(name="Cand", email="cand4@test.com", role="candidate", is_online=False)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    profile = CandidateProfile(
        user_id=candidate.id,
        skills=[{"name": "python", "level": 3}],
        experience_level="junior",
        preferred_locations="hanoi",
        preferred_salary_min=800,
        activity_score=0.7,
        status="ACTIVE",
        no_response_streak=0,
        last_login_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(profile)
    db.commit()

    first = send_notification(db, candidate.id, "A", "B", idempotency_key="same-key")
    second = send_notification(db, candidate.id, "A", "B", idempotency_key="same-key")
    assert first is not None
    assert second is not None
    assert first.id == second.id

    db.refresh(profile)
    assert profile.no_response_streak == 1
    reset_no_response_streak(db, candidate.id)
    db.refresh(profile)
    assert profile.no_response_streak == 0


def test_auth_token_issue_and_authenticate():
    db = setup_db()
    user = User(name="Rec", email="auth@test.com", password="secret123", role="recruiter", is_online=False)
    db.add(user)
    db.commit()
    db.refresh(user)

    found = authenticate(db, "auth@test.com", "secret123")
    assert found is not None
    assert found.id == user.id

    token = issue_token(db, user)
    token_row = db.query(AuthToken).filter(AuthToken.token == token).first()
    assert token_row is not None
    assert token_row.user_id == user.id


def test_failed_event_can_be_retried():
    db = setup_db()
    bad_event = enqueue_event(db, "unsupported_type", {"x": 1})
    for _ in range(3):
        process_next_event(db)
    db.refresh(bad_event)
    assert bad_event.status == "FAILED"

    retried = retry_failed_event(db, bad_event.id)
    assert retried is not None
    assert retried.status == "PENDING"
    assert retried.retry_count == 0


# ---------------------------------------------------------------------------
# CV parser tests  (now returns [{name, level}])
# ---------------------------------------------------------------------------

def test_cv_parser_extract_skills():
    text = "Experienced Python developer skilled in FastAPI, React, Docker and PostgreSQL."
    skills = _extract_skills(text)
    names = {s["name"] for s in skills}
    assert "python" in names
    assert "fastapi" in names
    assert "react" in names
    assert "docker" in names
    assert "postgresql" in names
    for s in skills:
        assert 1 <= s["level"] <= 5


def test_cv_parser_proficiency_detection():
    text = "Expert in Python. Basic knowledge of Java. Advanced React developer."
    skills = _extract_skills(text)
    by_name = {s["name"]: s["level"] for s in skills}
    assert by_name.get("python") == 5  # "Expert"
    assert by_name.get("java") == 2    # "Basic"
    assert by_name.get("react") == 4   # "Advanced"


def test_cv_parser_extract_experience_level():
    level, years = _extract_experience_level("Senior Software Engineer with 7 years of experience")
    assert level == "senior"
    assert years == 7

    level2, years2 = _extract_experience_level("Fresh graduate, 1 year of experience")
    assert level2 == "junior"
    assert years2 == 1

    level3, years3 = _extract_experience_level("3 years of experience in backend development")
    assert level3 == "middle"
    assert years3 == 3


def test_cv_parser_extract_locations():
    text = "Based in Hanoi, willing to relocate to Ho Chi Minh or work remote."
    locs = _extract_locations(text)
    assert any("Hanoi" in loc or "Ha Noi" in loc for loc in locs)
    assert "Remote" in locs


def test_cv_parser_extract_salary():
    assert _extract_salary("Expected salary: $2500") == 2500
    assert _extract_salary("No salary mentioned") == 0


# -- Percentage / fraction / star detection ----------------------------------

def test_detect_percentage_near_skill():
    assert _detect_percentage("python 90%") == 5
    assert _detect_percentage("sql 75%") == 4
    assert _detect_percentage("html 50%") == 3
    assert _detect_percentage("ruby 25%") == 1
    assert _detect_percentage("no numbers here") is None


def test_detect_fraction_near_skill():
    assert _detect_fraction("react 4/5") == 4
    assert _detect_fraction("docker 3/5") == 3
    assert _detect_fraction("go 2/5") == 2
    assert _detect_fraction("no fraction") is None


def test_detect_star_rating():
    assert _detect_star_rating("★★★★☆") == 4   # 4/5 = 80%
    assert _detect_star_rating("●●●○○") == 3    # 3/5 = 60%
    assert _detect_star_rating("■■■■■") == 5    # 5/5 = 100%
    assert _detect_star_rating("no stars") is None


def test_pct_to_level_boundaries():
    assert _pct_to_level(100) == 5
    assert _pct_to_level(90) == 5
    assert _pct_to_level(89) == 4
    assert _pct_to_level(70) == 4
    assert _pct_to_level(69) == 3
    assert _pct_to_level(50) == 3
    assert _pct_to_level(49) == 2
    assert _pct_to_level(30) == 2
    assert _pct_to_level(29) == 1
    assert _pct_to_level(0) == 1


def test_skill_extraction_with_percentage():
    text = "Skills: Python 90%, SQL 60%, Docker 40%"
    skills = _extract_skills(text)
    by_name = {s["name"]: s["level"] for s in skills}
    assert by_name["python"] == 5   # 90% → level 5
    assert by_name["sql"] == 3      # 60% → level 3
    assert by_name["docker"] == 2   # 40% → level 2


def test_skill_extraction_with_fraction():
    text = "Technical Skills: React 4/5, Java 2/5, Docker 5/5"
    skills = _extract_skills(text)
    by_name = {s["name"]: s["level"] for s in skills}
    assert by_name["react"] == 4    # 4/5 = 80% → level 4
    assert by_name["java"] == 2     # 2/5 = 40% → level 2
    assert by_name["docker"] == 5   # 5/5 = 100% → level 5


def test_skill_extraction_with_star_rating():
    text = "Python ★★★★★ React ★★★☆☆ Docker ★★★★☆"
    skills = _extract_skills(text)
    by_name = {s["name"]: s["level"] for s in skills}
    assert by_name["python"] == 5   # 5/5
    assert by_name["react"] == 3    # 3/5 = 60%
    assert by_name["docker"] == 4   # 4/5 = 80%


# ---------------------------------------------------------------------------
# Proficiency-weighted vector matching tests
# ---------------------------------------------------------------------------

def test_proficiency_vectorizer_exact_match():
    vec = ProficiencyVectorizer()
    s = vec.compare_pair(
        [{"name": "python", "level": 5}, {"name": "sql", "level": 3}],
        [{"name": "python", "level": 5}, {"name": "sql", "level": 3}],
    )
    assert s > 0.99


def test_proficiency_vectorizer_different_levels():
    """Same skills but different proficiency levels → similarity < 1.0."""
    vec = ProficiencyVectorizer()
    high = [{"name": "python", "level": 5}, {"name": "sql", "level": 1}]
    balanced = [{"name": "python", "level": 3}, {"name": "sql", "level": 3}]
    s = vec.compare_pair(high, balanced)
    assert 0.5 < s < 1.0


def test_proficiency_vectorizer_no_overlap():
    vec = ProficiencyVectorizer()
    s = vec.compare_pair(
        [{"name": "python", "level": 5}],
        [{"name": "java", "level": 5}],
    )
    assert s < 0.01


def test_proficiency_vectorizer_higher_level_better_match():
    """Candidate with higher proficiency in the required skill should
    match better than one with lower proficiency."""
    vec = ProficiencyVectorizer()
    job_skills = [{"name": "python", "level": 4}, {"name": "sql", "level": 3}]

    expert = [{"name": "python", "level": 5}, {"name": "sql", "level": 4}]
    beginner = [{"name": "python", "level": 1}, {"name": "sql", "level": 1}]

    scores = vec.batch_compare(job_skills, [expert, beginner])
    assert scores[0] > scores[1]


def test_proficiency_ranking_with_db():
    """End-to-end: candidates with higher proficiency rank higher."""
    db = setup_db()
    recruiter = User(name="R", email="r_prof@test.com", role="recruiter", is_online=False)
    c1 = User(name="C1", email="c1_prof@test.com", role="candidate", is_online=False)
    c2 = User(name="C2", email="c2_prof@test.com", role="candidate", is_online=False)
    db.add_all([recruiter, c1, c2])
    db.commit()
    db.refresh(recruiter)
    db.refresh(c1)
    db.refresh(c2)

    db.add(CandidateProfile(
        user_id=c1.id,
        skills=[{"name": "python", "level": 5}, {"name": "sql", "level": 4}],
        experience_level="junior", preferred_locations="hanoi",
        preferred_salary_min=1000, activity_score=1.0, status="ACTIVE",
        last_login_at=now_utc(), updated_at=now_utc(),
    ))
    db.add(CandidateProfile(
        user_id=c2.id,
        skills=[{"name": "python", "level": 1}, {"name": "sql", "level": 1}],
        experience_level="junior", preferred_locations="hanoi",
        preferred_salary_min=1000, activity_score=1.0, status="ACTIVE",
        last_login_at=now_utc(), updated_at=now_utc(),
    ))
    db.commit()

    job = Job(
        recruiter_id=recruiter.id, title="Test",
        required_skills=[{"name": "python", "level": 4}, {"name": "sql", "level": 3}],
        location="hanoi", salary_min=500, salary_max=3000, experience_level="junior",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    ranked = rank_candidates_for_job(db, job, top_k=2)
    assert len(ranked) == 2
    assert ranked[0].candidate_id == c1.id
    assert ranked[0].skill_match > ranked[1].skill_match


# ---------------------------------------------------------------------------
# TF-IDF tests (still available as a strategy)
# ---------------------------------------------------------------------------

def test_tfidf_vectorizer_basic_similarity():
    vec = TfidfSkillVectorizer()
    scores = vec.batch_compare("python,sql,react", ["python,sql,react"])
    assert len(scores) == 1
    assert scores[0] > 0.99

    scores2 = vec.batch_compare("python,sql,react", ["java,kotlin,android"])
    assert scores2[0] < 0.01


def test_tfidf_idf_weighting():
    """Rare skills should contribute more than common ones in TF-IDF."""
    vec = TfidfSkillVectorizer()
    scores = vec.batch_compare(
        "python,kubernetes",
        [
            "kubernetes",
            "python",
            "python,java",
            "python,sql",
            "python,docker",
        ],
    )
    assert scores[0] > scores[1]


# ---------------------------------------------------------------------------
# Gemini CV parser / embedding tests (mocked — no real API calls)
# ---------------------------------------------------------------------------

def test_gemini_json_to_extraction():
    """_json_to_extraction correctly maps Gemini JSON output."""
    from app.services.cv_parser_gemini import _json_to_extraction

    sample_json = {
        "skills": [
            {"name": "Python", "level": 5},
            {"name": "React", "level": 3},
            {"name": "Docker", "level": 4},
        ],
        "experience_level": "senior",
        "locations": ["Hanoi", "Remote"],
        "salary_min": 2000,
        "years_of_experience": 6,
    }
    extraction = _json_to_extraction(sample_json, b"")
    assert len(extraction.skills) == 3
    assert extraction.skills[0]["name"] == "python"
    assert extraction.skills[0]["level"] == 5
    assert extraction.skills[1]["name"] == "react"
    assert extraction.experience_level == "senior"
    assert "Hanoi" in extraction.locations
    assert extraction.salary_min == 2000
    assert extraction.years_of_experience == 6


def test_gemini_json_to_extraction_sanitises_bad_data():
    """Invalid fields are sanitised to safe defaults."""
    from app.services.cv_parser_gemini import _json_to_extraction

    bad_json = {
        "skills": [
            {"name": "python", "level": 99},
            {"name": "", "level": 3},
            {"name": "java", "level": 3},
        ],
        "experience_level": "guru",
        "locations": [],
        "salary_min": -500,
        "years_of_experience": "five",
    }
    extraction = _json_to_extraction(bad_json, b"")
    assert len(extraction.skills) == 1
    assert extraction.skills[0]["name"] == "java"
    assert extraction.experience_level == "junior"
    assert extraction.salary_min == 0
    assert extraction.years_of_experience is None


def test_gemini_embed_skills_format():
    """embed_skills converts skill list to natural-language text."""
    from app.services.cv_parser_gemini import embed_skills
    from unittest.mock import patch, MagicMock

    fake_embedding_obj = MagicMock()
    fake_embedding_obj.values = [0.1] * 768
    fake_result = MagicMock()
    fake_result.embeddings = [fake_embedding_obj]

    fake_client = MagicMock()
    fake_client.models.embed_content.return_value = fake_result

    with patch("app.services.cv_parser_gemini._get_client", return_value=fake_client):
        result = embed_skills([
            {"name": "python", "level": 5},
            {"name": "sql", "level": 2},
        ])
        assert len(result) == 768
        call_args = fake_client.models.embed_content.call_args
        content_arg = call_args.kwargs.get("contents", "")
        assert "expert python" in content_arg
        assert "elementary sql" in content_arg


def test_gemini_fallback_when_no_api_key():
    """When GEMINI_API_KEY is empty, parse_cv_with_gemini falls back to regex."""
    from app.services.cv_parser_gemini import parse_cv_with_gemini
    from app.services.cv_parser import CVExtraction
    from unittest.mock import patch

    fallback_result = CVExtraction(raw_text="fallback", skills=[{"name": "python", "level": 3}])
    with patch("app.services.cv_parser_gemini.settings") as mock_settings:
        mock_settings.gemini_api_key = ""
        with patch("app.services.cv_parser_gemini.regex_parse_cv", return_value=fallback_result) as mock_regex:
            result = parse_cv_with_gemini(b"fake-pdf-bytes")
            mock_regex.assert_called_once_with(b"fake-pdf-bytes")
            assert result.parser_used == "regex"
            assert result.gemini_error != ""
            assert result.extraction.raw_text == "fallback"
            assert result.extraction.skills[0]["name"] == "python"

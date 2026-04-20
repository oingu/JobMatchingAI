# Demo Script for Defense

## Preparation

1. `python3 -m venv .venv`
2. `source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. Start API: `uvicorn app.main:app --reload`

## Option A: Manual scenario

1. Create recruiter and 2 candidates via `POST /users`.
2. Login each account via `POST /auth/login`.
3. Recruiter creates profile via `POST /recruiter-profiles`.
4. Candidates create profiles via `POST /candidate-profiles`.
5. Recruiter creates job via `POST /jobs`.
6. Recruiter processes queue immediately via `POST /events/process?limit=20`.
7. Open:
   - recruiter dashboard: `/ui/recruiter/{recruiter_id}`
   - candidate feed: `/ui/candidate/{candidate_id}`
8. Candidate sends interactions:
   - `view`, `click`, `apply` via `POST /interactions`
9. Recruiter runs evaluation via `POST /evaluate`.

## Option B: Auto demo script

1. Start API server.
2. Run: `python scripts/demo_scenario.py`
3. Observe console output:
   - feed size
   - recommendation quality
   - engagement metrics
   - baseline vs improved comparison

## Failure handling demo

1. Query failed events: `GET /events/failed`
2. Retry one event: `POST /events/{event_id}/retry`
3. Process queue: `POST /events/process?limit=20`

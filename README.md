# Intelligent Job Matching and Recommendation System

This project implements an MVP for a graduation thesis topic:

- Recommendation System (content-based + weighted ranking)
- Event-Driven Processing (job/cv triggers)
- Behavioral Modeling (activity score + ACTIVE/PASSIVE/INACTIVE)
- Product Web Views (recruiter dashboard, candidate feed, activity history)

## Tech stack

- Python 3.11+
- FastAPI
- SQLAlchemy + SQLite

## Quick start

1. Create virtual environment and install dependencies:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
   - Copy env template if needed: `cp .env.example .env`
2. Run:
   - `uvicorn app.main:app --reload`
3. Open:
   - API docs: `http://127.0.0.1:8000/docs`
   - Recruiter dashboard UI: `http://127.0.0.1:8000/ui/recruiter/1`
   - Candidate feed UI: `http://127.0.0.1:8000/ui/candidate/1`

## Run with Docker

- Build and run:
  - `docker compose up --build`
- Stop:
  - `docker compose down`

## Frontend (Next.js + React)

- Setup:
  - `cd frontend`
  - `cp .env.local.example .env.local`
  - `npm install`
- Run:
  - `npm run dev`
- Build check:
  - `npm run lint`
  - `npm run build`
- Main pages:
  - `/login`
  - `/recruiter/dashboard`
  - `/recruiter/jobs/new`
  - `/recruiter/events`
  - `/recruiter/evaluation`
  - `/recruiter/audit`
  - `/candidate/profile`
  - `/candidate/feed`
  - `/candidate/activity`

## Database migration (Alembic)

- Apply latest schema:
  - `alembic upgrade head`
- Create new migration after model change:
  - `alembic revision -m "your message" --autogenerate`

## Make targets

- `make run` - run API
- `make test` - run tests
- `make migrate` - apply migrations
- `make seed` - generate synthetic dataset
- `make demo` - run e2e demo script
- `make benchmark` - export benchmark metrics

## Demo and dataset scripts

- Generate synthetic data: `python scripts/generate_dataset.py`
- Run end-to-end demo scenario: `python scripts/demo_scenario.py`
- Run benchmark and export JSON/CSV report: `python scripts/benchmark.py`
- Defense demo guide: `docs/demo_script.md`

## Authentication flow

- Create users with `POST /users` including `email`, `password`, `role`.
- Login via `POST /auth/login` to receive a bearer token.
- Logout via `POST /auth/logout`.
- Use header `Authorization: Bearer <token>` for protected endpoints.
- Login/register are rate-limited to reduce brute-force and abuse.
- Role enforcement:
  - Candidate: candidate profile/feed/activity/interactions for own account.
  - Recruiter: recruiter profile/jobs/dashboard/evaluation for own account.

## Project structure

- `docs/usecases.md`: use case specs + acceptance criteria
- `docs/architecture.md`: ERD, event contracts, async processing flow
- `docs/evaluation_report.md`: metric definition and experiment notes
- `app/`: API, data model, services, worker loop
- `frontend/`: Next.js React web app for recruiter/candidate use cases

## Core use cases implemented

- UC-01: New job trigger -> top-K candidates + notification
- UC-02: New/updated CV trigger -> top-K jobs + notification
- UC-03: Behavior-based state transition and notification suppression
- UC-04: Interaction tracking (view/click/apply/login)
- UC-05: Recruiter dashboard and score breakdown
- UC-06: Evaluation metrics endpoint

## Additional completion requirements implemented

- API authentication + role-based access control.
- Password stored with PBKDF2 hash (not plain text).
- Token expiry policy using configurable `TOKEN_EXPIRE_MINUTES`.
- API response envelope standardized as `{ "data": ..., "meta": ... }`.
- Notification idempotency with `idempotency_key`.
- Passive throttling (24h cap) and inactive suppression for notifications.
- N-times no-response handling via `no_response_streak`.
- Baseline vs improved metric comparison in `POST /evaluate`.
- Event dead-letter handling endpoints:
  - `GET /events/failed`
  - `POST /events/{event_id}/retry`
  - `POST /events/process?limit=20`
- Audit logging endpoint:
  - `GET /audit-logs`
- UTC time handling standardized with timezone-aware timestamps.
- Pagination and filtering added for events/feed/activity/notifications/dashboard.
- Unified JSON error envelope via global exception handlers.

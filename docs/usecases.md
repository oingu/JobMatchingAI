# Use Case Specification and Acceptance Criteria

## UC-01: Recruiter creates a new job

- **Actor**: Recruiter
- **Trigger**: Job is created via API/UI
- **Main flow**:
  1. System stores job profile.
  2. System emits `job_created` event.
  3. Worker computes top-K candidates using weighted ranking.
  4. System stores recommendation records.
  5. If candidate is offline and not INACTIVE, system sends notification.
- **Acceptance criteria**:
  - A `job_created` event is persisted.
  - Top-K recommendations exist for the new job.
  - Recruiter dashboard shows candidate ranking with score breakdown.
  - Notifications are created only for offline candidates not marked INACTIVE.

## UC-02: Candidate creates/updates CV

- **Actor**: Candidate
- **Trigger**: Candidate profile create/update
- **Main flow**:
  1. Candidate profile is stored/updated.
  2. System emits `candidate_profile_updated` event.
  3. Worker computes top-K jobs.
  4. System stores recommendation records.
  5. If recruiter is offline, recruiter receives candidate suggestion notice.
- **Acceptance criteria**:
  - Event `candidate_profile_updated` is persisted.
  - Candidate feed returns top-K job recommendations.
  - Recruiter suggestion notification exists for affected recruiters when offline.

## UC-03: No response from candidate

- **Actor**: System
- **Trigger**: Scheduled behavior update
- **Main flow**:
  1. System reads interaction logs for each candidate.
  2. Computes activity score with time decay.
  3. Updates candidate state: ACTIVE -> PASSIVE -> INACTIVE.
  4. Notification rule suppresses INACTIVE users.
- **Acceptance criteria**:
  - Activity score is updated after interactions/time changes.
  - Candidate state transitions based on thresholds.
  - INACTIVE candidates no longer receive recommendation notifications.

## UC-04: Candidate views/clicks/applies

- **Actor**: Candidate
- **Trigger**: Candidate interaction with recommendation items
- **Main flow**:
  1. System logs interaction (`view`, `click`, `apply`, `login`).
  2. Behavior feature cache is updated for future scoring.
  3. Engagement metrics consume these logs.
- **Acceptance criteria**:
  - Interaction API persists each event with timestamp.
  - Activity history page lists chronological interactions.
  - Apply funnel rates can be computed from logs.

## UC-05: Recruiter opens dashboard

- **Actor**: Recruiter
- **Trigger**: Dashboard request
- **Main flow**:
  1. System retrieves active jobs for recruiter.
  2. Fetches latest candidate recommendations per job.
  3. Shows score breakdown components.
- **Acceptance criteria**:
  - Recruiter sees jobs and ranked candidates.
  - `skill_match`, `preference_match`, `activity_score`, and final score are visible.

## UC-06: System evaluation

- **Actor**: Student/Admin
- **Trigger**: Evaluation run
- **Main flow**:
  1. System computes recommendation quality metrics.
  2. System computes engagement metrics from interaction logs.
  3. System outputs metric bundle for report.
- **Acceptance criteria**:
  - Endpoint returns Precision@K and Recall@K.
  - Endpoint returns CTR, Apply Rate, Ignore Rate.
  - Metrics are computed from persisted recommendation/interactions data.

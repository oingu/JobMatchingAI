# Evaluation Report Template

## 1. Experimental setup

- Dataset:
  - Candidate profiles with skill vectors, preference, level.
  - Job profiles with required skills, salary range, location.
  - Interaction logs (view/click/apply/login).
- Recommendation model:
  - Content-based cosine similarity.
  - Weighted ranking:
    - `score = 0.5 * skill_match + 0.3 * preference_match + 0.2 * activity_score`.
- Behavior model:
  - `activity_score = 0.7 * exp(-0.12 * days_since_last_login) + 0.3 * engagement_boost`.
  - State thresholds:
    - ACTIVE: score >= 0.5
    - PASSIVE: 0.2 <= score < 0.5
    - INACTIVE: score < 0.2

## 2. Metrics

- Recommendation Quality:
  - Precision@K
  - Recall@K
- Engagement:
  - CTR = click / view
  - Apply Rate = apply / click
- Spam reduction:
  - Ignore Rate = 1 - CTR (simplified)

## 3. Baseline vs Improved (placeholder)

| Metric | Baseline | Improved |
|---|---:|---:|
| Precision@5 | - | - |
| Recall@5 | - | - |
| CTR | - | - |
| Apply Rate | - | - |
| Ignore Rate | - | - |

## 4. Interpretation guidelines

- If Precision@K increases, ranking quality is better.
- If Apply Rate increases, recommendations are more useful.
- If Ignore Rate decreases after behavior suppression, notification quality improved.

## 5. Demo script

1. Create recruiter and candidate users.
2. Create candidate profiles.
3. Create a new job and observe event processing.
4. Check recruiter dashboard and candidate feed.
5. Submit view/click/apply interactions.
6. Trigger evaluation endpoint and capture metric output.

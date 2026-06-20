import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

_client = None

def _get_client():
    global _client
    if _client is not None:
        return _client
    from google import genai
    api_key = settings.gemini_api_key
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set. AI Career Coach will return fallback data.")
        return None
    try:
        _client = genai.Client(api_key=api_key)
        return _client
    except Exception as e:
        logger.error(f"Failed to initialize Gemini Client: {e}")
        return None

def analyze_resume_with_gemini(profile_data: dict) -> dict:
    client = _get_client()
    if not client:
        return {
            "score": 50,
            "formatting_issues": ["AI service is currently unavailable."],
            "content_suggestions": ["Please try again later."],
            "rewrites": []
        }

    prompt = f"""
You are an expert AI Career Coach and Resume Reviewer.
Analyze the following parsed resume data:
{json.dumps(profile_data, ensure_ascii=False, indent=2)}

Provide a structured analysis with:
1. An overall score (0-100) based on content depth, clarity, and keyword optimization.
2. A list of formatting or structural issues (if any, e.g., missing sections, too short).
3. A list of actionable content suggestions (e.g., "Add more quantifiable metrics").
4. Up to 3 specific rewrites of weak bullet points or summary statements. Each rewrite must have "original" and "improved".

Return ONLY a valid JSON object matching this schema exactly:
{{
  "score": integer,
  "formatting_issues": ["issue 1", "issue 2"],
  "content_suggestions": ["suggestion 1", "suggestion 2"],
  "rewrites": [
    {{
      "original": "Original text here",
      "improved": "Improved text here"
    }}
  ]
}}
Ensure the output is clean JSON without Markdown formatting blocks (e.g., do not wrap in ```json).
"""
    try:
        from google.genai import types
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        logger.error(f"Error calling Gemini API: {e}")
        return {
            "score": 50,
            "formatting_issues": ["Error connecting to AI service."],
            "content_suggestions": [str(e)],
            "rewrites": []
        }

def analyze_skill_gap_with_gemini(candidate_skills: str, job_skills: str, job_desc: str) -> dict:
    client = _get_client()
    if not client:
        return {
            "matching_skills": [],
            "missing_skills": ["AI service unavailable"],
            "learning_path": ["Please try again later"]
        }

    prompt = f"""
You are an expert AI Career Coach.
Compare the candidate's skills with the job requirements.

Candidate Skills: {candidate_skills}
Job Required Skills: {job_skills}
Job Description: {job_desc}

Identify:
1. Matching skills: Skills the candidate has that the job requires.
2. Missing skills: Crucial skills the job requires but the candidate lacks or is weak in.
3. Learning path: A short, actionable step-by-step guide (3-5 items) on how to bridge the gap quickly.

Return ONLY a valid JSON object matching this schema exactly:
{{
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"],
  "learning_path": ["Step 1...", "Step 2..."]
}}
Ensure the output is clean JSON without Markdown formatting blocks (e.g., do not wrap in ```json).
"""
    try:
        from google.genai import types
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        logger.error(f"Error calling Gemini API for Skill Gap: {e}")
        return {
            "matching_skills": [],
            "missing_skills": ["Error connecting to AI service."],
            "learning_path": [str(e)]
        }

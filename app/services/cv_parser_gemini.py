"""Gemini-powered CV parser with Vision and Embedding capabilities.

Uses the **new** ``google-genai`` SDK (replaces the deprecated
``google-generativeai`` package).

1. **Vision Analysis** — Render PDF pages to images and send to Gemini's
   multimodal model.  Gemini can understand progress bars, star ratings,
   charts, infographics, and all visual skill representations that
   text-only extraction misses.

2. **Structured Extraction** — Gemini returns a JSON object with skills
   (name + proficiency level), experience, locations, and salary.

3. **CV Embedding** — Generate a dense vector for the entire CV text using
   Gemini's embedding model for semantic similarity matching.

Falls back to the regex-based parser when the Gemini API key is not
configured or the API call fails.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from io import BytesIO

from app.config import settings
from app.services.cv_parser import CVExtraction, parse_cv as regex_parse_cv

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
You are an expert CV/Resume analyst. Analyze this CV image(s) thoroughly.

Extract the following information and return ONLY a valid JSON object:

{
  "skills": [
    {"name": "skill_name_lowercase", "level": 1-5}
  ],
  "experience_level": "junior" | "middle" | "senior",
  "locations": ["city names found"],
  "salary_min": 0,
  "years_of_experience": null or integer
}

SKILL PROFICIENCY RULES:
- Level 1 = Beginner, 2 = Elementary, 3 = Intermediate, 4 = Advanced, 5 = Expert
- If the CV uses PROGRESS BARS, estimate the fill percentage:
  >= 90% → 5, >= 70% → 4, >= 50% → 3, >= 30% → 2, < 30% → 1
- If the CV uses STAR RATINGS (★★★★☆), count filled vs total stars
- If the CV uses PERCENTAGE labels (Python 90%), convert accordingly
- If the CV uses FRACTION notation (4/5), convert: numerator/denominator * 100
- If the CV uses text keywords like "Expert", "Advanced", "Basic", map directly
- If no proficiency indicator is visible, estimate from context (years used, \
project complexity, role seniority). Default to 3 if truly ambiguous.

EXPERIENCE LEVEL:
- "junior" = 0-2 years, intern, fresher, entry-level
- "middle" = 2-5 years, mid-level
- "senior" = 5+ years, lead, principal, architect, staff

IMPORTANT:
- Skill names must be lowercase (e.g., "python", "react", "docker")
- Return ONLY the JSON object, no markdown, no explanation
- Include ALL skills you can identify, even from project descriptions
- Pay special attention to visual elements (bars, charts, icons, ratings)
"""

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------

_client = None


def _get_client():
    """Return a cached ``google.genai.Client`` instance."""
    global _client
    if _client is not None:
        return _client

    from google import genai

    api_key = settings.gemini_api_key
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    _client = genai.Client(api_key=api_key)
    return _client


def _pdf_to_images(file_bytes: bytes) -> list:
    """Render PDF pages to PIL Images for Gemini Vision."""
    from pdf2image import convert_from_bytes

    return convert_from_bytes(file_bytes, dpi=200)


# ---------------------------------------------------------------------------
# CV Parsing
# ---------------------------------------------------------------------------

@dataclass
class GeminiParseResult:
    extraction: CVExtraction
    parser_used: str       # "gemini" or "regex"
    gemini_error: str = ""


def parse_cv_with_gemini(file_bytes: bytes) -> GeminiParseResult:
    """Parse a PDF CV using Gemini Vision API.

    Falls back to regex-based parser on any failure.
    """
    if not settings.gemini_api_key:
        logger.info("GEMINI_API_KEY not set — using regex parser.")
        return GeminiParseResult(
            extraction=regex_parse_cv(file_bytes),
            parser_used="regex",
            gemini_error="GEMINI_API_KEY not configured",
        )

    try:
        from google import genai
        from google.genai import types

        client = _get_client()
        images = _pdf_to_images(file_bytes)

        contents: list = [EXTRACTION_PROMPT]
        for img in images:
            contents.append(img)

        logger.info("Sending %d page(s) to Gemini Vision for analysis...", len(images))

        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=4096,
            ),
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        parsed = json.loads(raw_text)
        extraction = _json_to_extraction(parsed, file_bytes)

        logger.info(
            "Gemini Vision extracted %d skills successfully.",
            len(extraction.skills),
        )
        return GeminiParseResult(extraction=extraction, parser_used="gemini")

    except Exception as exc:
        error_msg = str(exc)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
            short_error = (
                "Gemini API free-tier quota exceeded (429). "
                "Wait 1 minute, or enable billing at https://aistudio.google.com"
            )
        elif "403" in error_msg or "PERMISSION_DENIED" in error_msg:
            short_error = "Gemini API key invalid or API not enabled."
        else:
            short_error = f"Gemini API error: {type(exc).__name__}: {error_msg[:120]}"

        logger.warning("Gemini CV parsing failed (%s) — falling back to regex parser.", short_error)
        return GeminiParseResult(
            extraction=regex_parse_cv(file_bytes),
            parser_used="regex",
            gemini_error=short_error,
        )


def _json_to_extraction(data: dict, file_bytes: bytes) -> CVExtraction:
    """Convert Gemini's JSON output to a CVExtraction dataclass."""
    raw_text = ""
    if file_bytes:
        try:
            from app.services.cv_parser import extract_text_from_pdf
            raw_text = extract_text_from_pdf(BytesIO(file_bytes))
        except Exception:
            logger.debug("Could not extract text layer for raw_text field.")

    skills = []
    for s in data.get("skills", []):
        name = s.get("name", "").strip().lower()
        level = s.get("level", 3)
        if name and isinstance(level, int) and 1 <= level <= 5:
            skills.append({"name": name, "level": level})

    experience_level = data.get("experience_level", "junior")
    if experience_level not in ("junior", "middle", "senior"):
        experience_level = "junior"

    locations = [loc.strip() for loc in data.get("locations", []) if loc.strip()]
    salary_min = data.get("salary_min", 0)
    if not isinstance(salary_min, int) or salary_min < 0:
        salary_min = 0
    years = data.get("years_of_experience")
    if years is not None and not isinstance(years, int):
        try:
            years = int(years)
        except (ValueError, TypeError):
            years = None

    return CVExtraction(
        raw_text=raw_text,
        skills=skills,
        experience_level=experience_level,
        locations=locations,
        salary_min=salary_min,
        years_of_experience=years,
    )


def embed_skills(skills: list[dict]) -> list[float]:
    """Convert a list of skills with levels to a dense embedding vector.

    Format: level-text skill-name, e.g., 'expert python, intermediate sql'.
    """
    if not skills:
        return [0.0] * 768

    client = _get_client()

    level_map = {
        1: "beginner",
        2: "elementary",
        3: "intermediate",
        4: "advanced",
        5: "expert"
    }

    parts = []
    for s in skills:
        name = s.get("name", "").strip().lower()
        level = s.get("level", 3)
        level_text = level_map.get(level, "intermediate")
        if name:
            parts.append(f"{level_text} {name}")

    text = ", ".join(parts)

    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text
    )

    if response.embeddings:
        return response.embeddings[0].values
    return [0.0] * 768




from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass

from app.config import settings
from app.services.cv_parser import CVExtraction, extract_text_from_pdf, parse_cv as regex_parse_cv

logger = logging.getLogger(__name__)

_PROMPT = """You are an expert CV analyzer.
Return ONLY valid JSON with this exact shape:
{
  "skills": [{"name":"python","level":1}],
  "experience_level":"junior",
  "locations":["hanoi"],
  "salary_min":0,
  "years_of_experience": null
}

Rules:
- skill names lowercase
- level is integer 1..5
- experience_level one of junior|middle|senior
- if unknown use reasonable defaults
- no markdown, no explanation
"""


@dataclass
class OpenRouterParseResult:
    extraction: CVExtraction
    parser_used: str  # openrouter | regex
    openrouter_error: str = ""


def parse_cv_with_openrouter(file_bytes: bytes) -> OpenRouterParseResult:
    if not settings.openrouter_api_key:
        return OpenRouterParseResult(
            extraction=regex_parse_cv(file_bytes),
            parser_used="regex",
            openrouter_error="OPENROUTER_API_KEY not configured",
        )

    try:
        raw_text = extract_text_from_pdf(file_bytes)
        # limit payload to keep latency/cost bounded
        cv_text = raw_text[:15000] if raw_text else ""
        body = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": _PROMPT},
                {"role": "user", "content": cv_text or "No text extracted from CV."},
            ],
            "temperature": 0,
            "max_tokens": 1200,
        }

        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.frontend_origin or "http://localhost:3000",
                "X-Title": "JobMatch AI",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=40) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="ignore"))

        content = payload["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("json"):
                content = content[4:].strip()
        data = json.loads(content)

        extraction = _json_to_extraction(data, raw_text)
        logger.info("OpenRouter parsed CV with %d skills.", len(extraction.skills))
        return OpenRouterParseResult(extraction=extraction, parser_used="openrouter")

    except urllib.error.HTTPError as exc:
        msg = exc.read().decode("utf-8", errors="ignore")
        short = f"OpenRouter HTTP {exc.code}: {msg[:150]}"
    except Exception as exc:
        short = f"OpenRouter error: {type(exc).__name__}: {str(exc)[:150]}"

    logger.warning("OpenRouter CV parse failed (%s), fallback to regex.", short)
    return OpenRouterParseResult(
        extraction=regex_parse_cv(file_bytes),
        parser_used="regex",
        openrouter_error=short,
    )


def _json_to_extraction(data: dict, raw_text: str) -> CVExtraction:
    skills: list[dict] = []
    for s in data.get("skills", []):
        name = str(s.get("name", "")).strip().lower()
        try:
            level = int(s.get("level", 3))
        except Exception:
            level = 3
        level = max(1, min(5, level))
        if name:
            skills.append({"name": name, "level": level})

    exp = str(data.get("experience_level", "junior")).strip().lower()
    if exp not in {"junior", "middle", "senior"}:
        exp = "junior"
    locations = [str(x).strip() for x in data.get("locations", []) if str(x).strip()]
    try:
        salary = int(data.get("salary_min", 0))
    except Exception:
        salary = 0
    try:
        years = data.get("years_of_experience", None)
        years = int(years) if years is not None else None
    except Exception:
        years = None

    return CVExtraction(
        raw_text=raw_text or "",
        skills=skills,
        experience_level=exp,
        locations=locations,
        salary_min=max(0, salary),
        years_of_experience=years,
    )

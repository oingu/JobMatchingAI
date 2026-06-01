"""Extract structured candidate data from a PDF CV.

Three-layer extraction pipeline:

1. **Text layer** — ``pdfplumber`` extracts selectable text directly from
   the PDF.  This is the fastest and most accurate path.

2. **Percentage patterns** — regex detects notations like ``Python 90%``,
   ``SQL — 75%``, ``React (4/5)`` near skill names and converts them to
   proficiency levels 1-5.

3. **OCR layer** — if the text layer yields very little content (likely a
   graphic-heavy / image-based CV), each page is rendered to an image and
   processed with Tesseract OCR.  This captures text embedded in progress
   bars, star ratings, infographics, and scanned documents.

The OCR layer is a *fallback*: it only activates when text extraction
returns fewer than ``MIN_TEXT_LENGTH`` characters, because OCR is slower
and noisier than direct text extraction.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

import pdfplumber

logger = logging.getLogger(__name__)

# Suppress pdfminer FontBBox warnings to keep terminal logs clean
logging.getLogger("pdfminer").setLevel(logging.ERROR)

MIN_TEXT_LENGTH = 80


KNOWN_SKILLS: set[str] = {
    # Programming languages
    "python", "java", "javascript", "typescript", "c", "c++", "c#", "go",
    "golang", "rust", "ruby", "php", "swift", "kotlin", "scala", "r",
    "matlab", "perl", "lua", "dart", "elixir", "haskell", "clojure",
    # Web
    "html", "css", "sass", "less", "react", "reactjs", "react.js",
    "angular", "vue", "vuejs", "vue.js", "svelte", "nextjs", "next.js",
    "nuxtjs", "nuxt.js", "gatsby", "tailwindcss", "tailwind", "bootstrap",
    # Backend
    "nodejs", "node.js", "express", "expressjs", "fastapi", "django",
    "flask", "spring", "springboot", "spring boot", "laravel", "rails",
    "asp.net", ".net", "nestjs", "nest.js", "gin", "fiber",
    # Data & ML
    "sql", "nosql", "mongodb", "postgresql", "postgres", "mysql",
    "sqlite", "redis", "elasticsearch", "neo4j", "cassandra",
    "pandas", "numpy", "scipy", "scikit-learn", "sklearn",
    "tensorflow", "pytorch", "keras", "opencv", "spark",
    "hadoop", "airflow", "kafka", "rabbitmq", "flink",
    "machine learning", "deep learning", "nlp",
    "natural language processing", "computer vision",
    "data science", "data engineering", "data analysis",
    # DevOps & Cloud
    "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins",
    "github actions", "gitlab ci", "ci/cd", "cicd",
    "aws", "azure", "gcp", "google cloud", "heroku", "vercel",
    "linux", "bash", "shell", "powershell",
    # Mobile
    "android", "ios", "react native", "flutter", "xamarin",
    "swiftui", "jetpack compose",
    # Tools & Misc
    "git", "github", "gitlab", "bitbucket", "jira", "confluence",
    "figma", "postman", "graphql", "rest", "restful",
    "microservices", "api", "websocket", "grpc", "protobuf",
    "agile", "scrum", "kanban",
    "unit testing", "integration testing", "tdd", "bdd",
    "selenium", "cypress", "playwright",
}

SKILL_ALIASES: dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "vuejs": "vue",
    "vue.js": "vue",
    "nodejs": "node.js",
    "nextjs": "next.js",
    "nuxtjs": "nuxt.js",
    "nestjs": "nest.js",
    "golang": "go",
    "postgres": "postgresql",
    "sklearn": "scikit-learn",
    "k8s": "kubernetes",
    "cicd": "ci/cd",
}

LEVEL_PATTERNS: list[tuple[str, str]] = [
    (r"\bsenior\b", "senior"),
    (r"\blead\b", "senior"),
    (r"\bprincipal\b", "senior"),
    (r"\bstaff\b", "senior"),
    (r"\barchitect\b", "senior"),
    (r"\bjunior\b", "junior"),
    (r"\bintern\b", "junior"),
    (r"\bfresher\b", "junior"),
    (r"\bentry[\s-]?level\b", "junior"),
    (r"\bmiddle\b", "middle"),
    (r"\bmid[\s-]?level\b", "middle"),
    (r"\bintermediate\b", "middle"),
]

YEARS_PATTERN = re.compile(
    r"(\d{1,2})\+?\s*(?:years?|năm|yrs?)\s*(?:of\s+)?(?:experience|exp|kinh\s*nghiệm)?",
    re.IGNORECASE,
)

SALARY_PATTERN = re.compile(
    r"(?:salary|lương|thu\s*nhập|income|compensation|expected)\s*"
    r"[:\-]?\s*"
    r"(?:from\s+|từ\s+)?"
    r"\$?\s*([\d,\.]+)\s*"
    r"(?:usd|vnd|triệu|million|k|tr)?",
    re.IGNORECASE,
)

VIETNAM_CITIES = [
    "hà nội", "hanoi", "ha noi",
    "hồ chí minh", "ho chi minh", "hcm", "saigon", "sài gòn",
    "đà nẵng", "da nang", "danang",
    "hải phòng", "hai phong",
    "cần thơ", "can tho",
    "nha trang",
    "huế", "hue",
    "biên hòa", "bien hoa",
    "vũng tàu", "vung tau",
    "quy nhơn", "quy nhon",
    "bắc ninh", "bac ninh",
    "thái nguyên", "thai nguyen",
]

WORLD_CITIES = [
    "singapore", "tokyo", "seoul", "bangkok", "kuala lumpur",
    "jakarta", "taipei", "hong kong", "beijing", "shanghai",
    "new york", "san francisco", "london", "berlin", "paris",
    "sydney", "melbourne", "toronto", "remote",
]

ALL_LOCATIONS: list[str] = VIETNAM_CITIES + WORLD_CITIES


PROFICIENCY_KEYWORDS: dict[str, int] = {
    "expert": 5, "proficient": 5, "advanced": 4,
    "experienced": 4, "strong": 4, "solid": 4,
    "intermediate": 3, "working knowledge": 3, "familiar": 3,
    "good": 3, "competent": 3,
    "basic": 2, "beginner": 1, "learning": 1, "exposure": 2,
}

# Patterns that capture numeric proficiency: "Python 90%", "SQL: 4/5",
# "React — 80%", "Docker (85%)", "Java - 3/5"
PERCENT_NEAR_SKILL = re.compile(
    r"(\d{1,3})\s*%",
)
FRACTION_NEAR_SKILL = re.compile(
    r"(\d)\s*/\s*(\d)",
)

# Unicode/text representations of visual ratings found in some PDFs
STAR_FULL = {"★", "⬛", "●", "■", "▰", "◼"}
STAR_EMPTY = {"☆", "⬜", "○", "□", "▱", "◻"}


@dataclass
class CVExtraction:
    raw_text: str = ""
    skills: list[dict] = field(default_factory=list)  # [{name, level}]
    experience_level: str = "junior"
    locations: list[str] = field(default_factory=list)
    salary_min: int = 0
    years_of_experience: int | None = None

    def to_dict(self) -> dict:
        return {
            "skills": self.skills,
            "experience_level": self.experience_level,
            "locations": self.locations,
            "salary_min": self.salary_min,
            "years_of_experience": self.years_of_experience,
            "raw_text_length": len(self.raw_text),
        }


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Read all pages of a PDF and concatenate text.

    Uses pdfplumber for the text layer first.  If that yields very little
    content (< MIN_TEXT_LENGTH chars), falls back to OCR via Tesseract to
    handle image-based / infographic CVs.
    """
    text_parts: list[str] = []
    with pdfplumber.open(file_bytes) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    direct_text = "\n".join(text_parts)

    if len(direct_text.strip()) >= MIN_TEXT_LENGTH:
        return direct_text

    logger.info(
        "Text layer too short (%d chars) — activating OCR fallback.",
        len(direct_text.strip()),
    )
    ocr_text = _ocr_pdf(file_bytes)
    if ocr_text:
        combined = (direct_text + "\n" + ocr_text).strip()
        return combined
    return direct_text


def _ocr_pdf(file_bytes: bytes) -> str:
    """Render each PDF page to an image and run Tesseract OCR.

    Returns the concatenated OCR text, or empty string on failure.
    This handles CVs where skills/proficiency are embedded in graphics
    (progress bars with labels, star ratings rendered as images, etc.).
    """
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
    except ImportError as exc:
        logger.warning("OCR dependencies unavailable (%s) — skipping OCR.", exc)
        return ""

    try:
        images = convert_from_bytes(file_bytes, dpi=300)
    except Exception:
        logger.exception("Failed to render PDF pages to images.")
        return ""

    ocr_parts: list[str] = []
    for i, img in enumerate(images):
        try:
            page_text = pytesseract.image_to_string(img, lang="eng")
            if page_text and page_text.strip():
                ocr_parts.append(page_text.strip())
                logger.debug("OCR page %d: %d chars", i + 1, len(page_text.strip()))
        except Exception:
            logger.exception("OCR failed for page %d.", i + 1)

    return "\n".join(ocr_parts)


def _extract_skills(text: str) -> list[dict]:
    """Return ``[{name, level}]`` with proficiency estimated from context."""
    text_lower = text.lower()
    found: dict[str, int] = {}

    for skill in KNOWN_SKILLS:
        pattern = r"(?<![a-zA-Z])" + re.escape(skill) + r"(?![a-zA-Z])"
        match = re.search(pattern, text_lower)
        if not match:
            continue
        canonical = SKILL_ALIASES.get(skill, skill)
        if canonical in found:
            continue
        level = _estimate_proficiency(text_lower, match.start(), canonical)
        found[canonical] = level

    return [{"name": name, "level": lvl} for name, lvl in sorted(found.items())]


def _estimate_proficiency(text: str, skill_pos: int, skill_name: str) -> int:
    """Estimate skill proficiency from context near the skill mention.

    Detection hierarchy (first match wins):
      1. **Percentage** — ``Python 90%`` → level 5
      2. **Fraction** — ``React 4/5`` → level 4
      3. **Unicode stars/blocks** — ``★★★★☆`` → level 4
      4. **Keywords** — ``Expert in Python`` → level 5
      5. **Fallback** — 3 (Intermediate)
    """
    # Tight window: mainly what follows the skill name (where the rating
    # typically appears), with a small look-back for leading indicators.
    right_window_start = skill_pos + len(skill_name)
    right_window_end = min(len(text), right_window_start + 30)
    left_window_start = max(0, skill_pos - 15)
    right_text = text[right_window_start:right_window_end]
    near_text = text[left_window_start:right_window_end]

    pct = _detect_percentage(right_text)
    if pct is not None:
        return pct

    frac = _detect_fraction(right_text)
    if frac is not None:
        return frac

    stars = _detect_star_rating(right_text)
    if stars is not None:
        return stars

    sent_start = text.rfind(".", 0, skill_pos)
    sent_start = 0 if sent_start == -1 else sent_start
    sent_end = text.find(".", skill_pos + len(skill_name))
    sent_end = len(text) if sent_end == -1 else sent_end + 1
    sent_window = text[sent_start:sent_end]

    best_level: int | None = None
    best_dist = len(sent_window) + 1
    for keyword, level in PROFICIENCY_KEYWORDS.items():
        idx = sent_window.find(keyword)
        if idx == -1:
            continue
        dist = abs(idx - (skill_pos - sent_start))
        if dist < best_dist:
            best_dist = dist
            best_level = level
    return best_level if best_level is not None else 3


def _pct_to_level(pct: int) -> int:
    """Map a 0-100 percentage to a 1-5 proficiency level."""
    if pct >= 90:
        return 5
    if pct >= 70:
        return 4
    if pct >= 50:
        return 3
    if pct >= 30:
        return 2
    return 1


def _detect_percentage(window: str) -> int | None:
    """Detect ``90%``, ``85 %`` patterns in the window."""
    m = PERCENT_NEAR_SKILL.search(window)
    if m:
        pct = int(m.group(1))
        if 0 <= pct <= 100:
            return _pct_to_level(pct)
    return None


def _detect_fraction(window: str) -> int | None:
    """Detect ``4/5``, ``3 / 5`` patterns in the window."""
    m = FRACTION_NEAR_SKILL.search(window)
    if m:
        numerator, denominator = int(m.group(1)), int(m.group(2))
        if denominator in (5, 10) and 0 <= numerator <= denominator:
            pct = int(numerator / denominator * 100)
            return _pct_to_level(pct)
    return None


def _detect_star_rating(window: str) -> int | None:
    """Detect Unicode star/block rating like ``★★★★☆`` or ``●●●○○``.

    Counts consecutive filled + empty symbols.  If total is 4-10 and at
    least one filled symbol is found, interpret as a rating.
    """
    filled = 0
    total = 0
    in_rating = False
    for ch in window:
        if ch in STAR_FULL:
            filled += 1
            total += 1
            in_rating = True
        elif ch in STAR_EMPTY:
            total += 1
            in_rating = True
        elif in_rating:
            break

    if total >= 4 and filled > 0:
        pct = int(filled / total * 100)
        return _pct_to_level(pct)
    return None


def _extract_experience_level(text: str) -> tuple[str, int | None]:
    text_lower = text.lower()
    years_match = YEARS_PATTERN.search(text_lower)
    years = int(years_match.group(1)) if years_match else None

    for pattern, level in LEVEL_PATTERNS:
        if re.search(pattern, text_lower):
            return level, years

    if years is not None:
        if years >= 5:
            return "senior", years
        if years >= 2:
            return "middle", years
        return "junior", years

    return "junior", years


def _extract_locations(text: str) -> list[str]:
    text_lower = text.lower()
    found: list[str] = []
    for loc in ALL_LOCATIONS:
        if loc in text_lower and loc not in found:
            canonical = loc.title()
            if canonical not in found:
                found.append(canonical)
    return found


def _extract_salary(text: str) -> int:
    match = SALARY_PATTERN.search(text)
    if not match:
        return 0
    raw = match.group(1).replace(",", "").replace(".", "")
    try:
        return int(raw)
    except ValueError:
        return 0


def parse_cv(file_bytes: bytes) -> CVExtraction:
    """Main entry point: parse PDF bytes and return structured extraction."""
    from io import BytesIO

    raw_text = extract_text_from_pdf(BytesIO(file_bytes))
    if not raw_text.strip():
        return CVExtraction(raw_text="")

    skills = _extract_skills(raw_text)
    level, years = _extract_experience_level(raw_text)
    locations = _extract_locations(raw_text)
    salary_min = _extract_salary(raw_text)

    return CVExtraction(
        raw_text=raw_text,
        skills=skills,
        experience_level=level,
        locations=locations,
        salary_min=salary_min,
        years_of_experience=years,
    )

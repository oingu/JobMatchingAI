"""Skill vectorization for semantic job matching.

Strategies:

- **proficiency** (default) — Each skill dimension is weighted by the
  candidate's proficiency level (1-5, normalised to 0-1).  True cosine
  similarity captures both *which* skills match and *how well* they match.

- **tfidf** — TF-IDF sparse vectors (treats skills as text tokens; does
  NOT account for proficiency levels).

- **embedding** — Dense semantic vectors via *sentence-transformers*.

- **gemini** — Dense semantic vectors via Google Gemini Embedding API.
  Captures semantic similarity between skills (e.g. "django" ↔ "flask")
  with proficiency expressed in natural language.

- **set** — Legacy binary set-intersection cosine.
"""

from __future__ import annotations

import logging
import math
from typing import Sequence

import numpy as np
from numpy.typing import NDArray
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

logger = logging.getLogger(__name__)

MAX_PROFICIENCY = 5

SkillList = list[dict]  # [{name: str, level: int}, ...]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalise(skills_csv: str) -> str:
    """``'Python, FastAPI, SQL'`` → ``'python fastapi sql'``."""
    return " ".join(
        tok.strip().lower()
        for tok in skills_csv.replace(",", " ").split()
        if tok.strip()
    )


def skills_to_csv(skills: SkillList) -> str:
    """Convert JSON skill list to comma-separated names (for TF-IDF compat)."""
    return ",".join(s.get("name", "") for s in skills if s.get("name"))


def skills_to_map(skills: SkillList) -> dict[str, int]:
    """Convert ``[{name, level}]`` to ``{name: level}`` dict."""
    return {
        s["name"].strip().lower(): s.get("level", 3)
        for s in skills
        if s.get("name")
    }


# ---------------------------------------------------------------------------
# Proficiency vectoriser  (primary strategy)
# ---------------------------------------------------------------------------

class ProficiencyVectorizer:
    """Build weighted vectors from structured skill lists and compute cosine
    similarity in the proficiency-weighted vector space.

    For candidate skills ``[{name: "python", level: 5}, {name: "sql", level: 2}]``
    and vocabulary ``["python", "sql", "react"]``, the vector is::

        [5/5, 2/5, 0/5] = [1.0, 0.4, 0.0]

    Cosine similarity on these vectors naturally captures:
    - *which* skills overlap  (non-zero dimensions)
    - *how proficient* the candidate is  (magnitude in each dimension)
    - *how aligned* the proficiency profile is with the job requirement  (angle)
    """

    def __init__(self, vocabulary: list[str] | None = None) -> None:
        self._vocab: list[str] = vocabulary or []
        self._vocab_index: dict[str, int] = {s: i for i, s in enumerate(self._vocab)}

    @property
    def vocabulary(self) -> list[str]:
        return self._vocab

    def _build_vocab(self, *skill_maps: dict[str, int]) -> None:
        all_names: set[str] = set()
        for m in skill_maps:
            all_names.update(m.keys())
        self._vocab = sorted(all_names)
        self._vocab_index = {s: i for i, s in enumerate(self._vocab)}

    def _to_vector(self, skill_map: dict[str, int]) -> NDArray[np.floating]:
        vec = np.zeros(len(self._vocab), dtype=np.float64)
        for name, level in skill_map.items():
            idx = self._vocab_index.get(name)
            if idx is not None:
                vec[idx] = level / MAX_PROFICIENCY
        return vec

    @staticmethod
    def _cosine(a: NDArray[np.floating], b: NDArray[np.floating]) -> float:
        dot = float(np.dot(a, b))
        norm_a = float(np.linalg.norm(a))
        norm_b = float(np.linalg.norm(b))
        if norm_a < 1e-10 or norm_b < 1e-10:
            return 0.0
        return dot / (norm_a * norm_b)

    def compare_pair(self, skills_a: SkillList, skills_b: SkillList) -> float:
        """Cosine similarity between two skill lists."""
        map_a = skills_to_map(skills_a)
        map_b = skills_to_map(skills_b)
        self._build_vocab(map_a, map_b)
        if not self._vocab:
            return 0.0
        return self._cosine(self._to_vector(map_a), self._to_vector(map_b))

    def batch_compare(
        self,
        target_skills: SkillList,
        candidate_skills_list: list[SkillList],
    ) -> list[float]:
        """Cosine of one target against multiple candidates."""
        target_map = skills_to_map(target_skills)
        candidate_maps = [skills_to_map(s) for s in candidate_skills_list]

        self._build_vocab(target_map, *candidate_maps)
        if not self._vocab:
            return [0.0] * len(candidate_skills_list)

        target_vec = self._to_vector(target_map)
        return [self._cosine(target_vec, self._to_vector(cm)) for cm in candidate_maps]


# ---------------------------------------------------------------------------
# TF-IDF vectoriser  (ignores proficiency, uses token frequency)
# ---------------------------------------------------------------------------

class TfidfSkillVectorizer:
    """Fit a TF-IDF model on a corpus of skill documents and compute cosine
    similarities in the resulting vector space.
    """

    def __init__(self) -> None:
        self._tfidf = TfidfVectorizer(
            analyzer="word",
            token_pattern=r"[a-zA-Z0-9+#._]+",
            lowercase=True,
            norm="l2",
        )
        self._matrix: np.ndarray | None = None
        self._fitted = False

    def fit(self, documents: Sequence[str]) -> None:
        if not documents:
            return
        self._matrix = self._tfidf.fit_transform(documents)
        self._fitted = True

    @property
    def vocabulary(self) -> dict[str, int]:
        if not self._fitted:
            return {}
        return dict(self._tfidf.vocabulary_)

    def cosine_one_vs_many(self, target_idx: int, other_indices: list[int]) -> list[float]:
        if self._matrix is None or not other_indices:
            return [0.0] * len(other_indices)
        sims = sklearn_cosine(
            self._matrix[target_idx: target_idx + 1],
            self._matrix[other_indices],
        ).flatten()
        return [float(s) for s in sims]

    def batch_compare(self, target_skills: str, candidate_skills_list: list[str]) -> list[float]:
        norm_target = _normalise(target_skills)
        norm_candidates = [_normalise(s) for s in candidate_skills_list]
        docs = [norm_target] + norm_candidates
        self.fit(docs)
        return self.cosine_one_vs_many(0, list(range(1, len(docs))))


# ---------------------------------------------------------------------------
# Sentence-transformer vectoriser  (optional heavy dependency)
# ---------------------------------------------------------------------------

class EmbeddingVectorizer:
    """Dense semantic embeddings via ``sentence-transformers``."""

    _model = None
    MODEL_NAME = "all-MiniLM-L6-v2"

    @classmethod
    def _ensure_model(cls) -> None:
        if cls._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]
            cls._model = SentenceTransformer(cls.MODEL_NAME)
            logger.info("Loaded sentence-transformer model: %s", cls.MODEL_NAME)
        except ImportError:
            raise RuntimeError(
                "sentence-transformers is not installed. "
                "Run:  pip install sentence-transformers  "
                "or switch MATCHING_STRATEGY to 'tfidf' or 'proficiency'."
            )

    @classmethod
    def batch_compare(cls, target_skills: str, candidate_skills_list: list[str]) -> list[float]:
        cls._ensure_model()
        all_texts = [_normalise(target_skills)] + [_normalise(s) for s in candidate_skills_list]
        vecs: NDArray[np.floating] = cls._model.encode(all_texts, convert_to_numpy=True)  # type: ignore[union-attr]
        norms = np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-10
        vecs = vecs / norms
        sims = vecs[1:] @ vecs[0]
        return [float(s) for s in sims]

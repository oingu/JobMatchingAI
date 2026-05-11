from __future__ import annotations

import logging

import numpy as np

from app.config import settings
from app.services.vectorizer import skills_to_csv

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.cohere_api_key:
        raise RuntimeError("COHERE_API_KEY is not configured.")
    import cohere

    # Cohere Python SDK 6.x
    _client = cohere.ClientV2(api_key=settings.cohere_api_key)
    return _client


def embed_text(text: str, *, input_type: str) -> list[float]:
    """Generate a dense embedding vector using Cohere Embed API."""
    client = _get_client()
    res = client.embed(
        model=settings.cohere_embed_model,
        texts=[text],
        input_type=input_type,
        embedding_types=["float"],
    )
    # Cohere V2 response shape: res.embeddings.float -> list[list[float]]
    return list(res.embeddings.float[0])


def embed_skills(skills: list[dict], *, input_type: str) -> list[float]:
    # Keep consistent with other strategies: embed a normalised skill string.
    csv = skills_to_csv(skills)
    text = (csv or "").replace(",", " ").strip().lower() or "no skills"
    return embed_text(text, input_type=input_type)


def batch_cosine_with_cohere_embeddings(
    target_skills: list[dict],
    candidate_skills_list: list[list[dict]],
) -> list[float]:
    """Compute cosine similarity using Cohere embeddings.

    Uses input_type:
    - search_query: for the target
    - search_document: for candidates (documents)
    """
    if not candidate_skills_list:
        return []

    target_vec = np.array(embed_skills(target_skills, input_type="search_query"), dtype=np.float64)
    target_norm = float(np.linalg.norm(target_vec))
    if target_norm < 1e-10:
        return [0.0] * len(candidate_skills_list)
    target_vec = target_vec / target_norm

    scores: list[float] = []
    for cand_skills in candidate_skills_list:
        cand_vec = np.array(embed_skills(cand_skills, input_type="search_document"), dtype=np.float64)
        cand_norm = float(np.linalg.norm(cand_vec))
        if cand_norm < 1e-10:
            scores.append(0.0)
        else:
            cand_vec = cand_vec / cand_norm
            scores.append(float(np.dot(target_vec, cand_vec)))
    return scores


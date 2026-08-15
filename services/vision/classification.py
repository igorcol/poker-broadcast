"""Classificação de glifos de índice contra um banco de templates."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

SUIT_COLORS = {"s": "black", "c": "black", "h": "red", "d": "red"}


def load_templates(directory: Path, prefix: str) -> dict[str, np.ndarray]:
    templates: dict[str, np.ndarray] = {}
    for path in sorted(directory.glob(f"{prefix}_*.png")):
        image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if image is not None:
            templates[path.stem.removeprefix(f"{prefix}_")] = image
    return templates


def similarity(glyph: np.ndarray, template: np.ndarray) -> float:
    """IoU entre as áreas de tinta — invariante à espessura do traço de cada glifo."""
    glyph_mask = glyph > 127
    template_mask = template > 127
    union = int(np.logical_or(glyph_mask, template_mask).sum())
    if union == 0:
        return 0.0
    return float(np.logical_and(glyph_mask, template_mask).sum()) / union


def rank_candidates(
    glyph: np.ndarray,
    templates: dict[str, np.ndarray],
    allowed: set[str] | None = None,
) -> list[tuple[str, float]]:
    """Candidatos ordenados — a margem entre 1º e 2º é o que diz se a decisão é sólida."""
    scores = [
        (name, similarity(glyph, template))
        for name, template in templates.items()
        if allowed is None or name in allowed
    ]
    return sorted(scores, key=lambda item: item[1], reverse=True)


def suits_for_ink(ink: str) -> set[str] | None:
    """Naipes compatíveis com a cor lida — None quando a cor não pôde ser determinada."""
    if ink not in {"red", "black"}:
        return None
    return {suit for suit, color in SUIT_COLORS.items() if color == ink}


def describe(candidates: list[tuple[str, float]]) -> str:
    if not candidates:
        return "? 0.00"
    best = f"{candidates[0][0]} {candidates[0][1]:.2f}"
    if len(candidates) < 2:
        return best
    return f"{best} (2º {candidates[1][0]} {candidates[1][1]:.2f})"
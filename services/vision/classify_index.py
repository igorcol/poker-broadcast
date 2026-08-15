"""Classifica glifos de índice contra templates de rank e naipe."""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np

# USO:
# python services/vision/classify_index.py data/frames/mser_glyphs

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


def rank_candidates(glyph: np.ndarray, templates: dict[str, np.ndarray]) -> list[tuple[str, float]]:
    """Candidatos ordenados — a margem entre 1º e 2º é o que diz se a decisão é sólida."""
    scores = [(name, similarity(glyph, template)) for name, template in templates.items()]
    return sorted(scores, key=lambda item: item[1], reverse=True)


def describe(candidates: list[tuple[str, float]]) -> str:
    if not candidates:
        return "? 0.00"
    best = f"{candidates[0][0]} {candidates[0][1]:.2f}"
    if len(candidates) < 2:
        return best
    return f"{best} (2º {candidates[1][0]} {candidates[1][1]:.2f})"


def main() -> int:
    parser = argparse.ArgumentParser(description="Classifica glifos de índice contra templates.")
    parser.add_argument("glyphs", type=Path, help="diretório com os glifos extraídos")
    parser.add_argument("--templates", type=Path, default=Path("data/templates"))
    args = parser.parse_args()

    ranks = load_templates(args.templates, "rank")
    suits = load_templates(args.templates, "suit")
    if not ranks or not suits:
        print(f"erro: templates não encontrados em {args.templates}", file=sys.stderr)
        return 1

    print(f"{len(ranks)} templates de rank, {len(suits)} de naipe\n")

    # Glifos vêm nomeados <par>_0 e <par>_1; o 0 é o de cima, que é sempre o rank
    groups: dict[str, dict[int, Path]] = defaultdict(dict)
    for path in sorted(args.glyphs.glob("*.png")):
        stem, _, index = path.stem.rpartition("_")
        if index.isdigit():
            groups[stem][int(index)] = path

    for stem, members in sorted(groups.items()):
        if set(members) != {0, 1}:
            print(f"{stem}: {len(members)} glifos — ignorado")
            continue

        rank_glyph = cv2.imread(str(members[0]), cv2.IMREAD_GRAYSCALE)
        suit_glyph = cv2.imread(str(members[1]), cv2.IMREAD_GRAYSCALE)

        rank_result = rank_candidates(rank_glyph, ranks)
        suit_result = rank_candidates(suit_glyph, suits)

        card = f"{rank_result[0][0]}{suit_result[0][0]}" if rank_result and suit_result else "??"
        print(f"{stem}: {card}")
        print(f"    rank {describe(rank_result)}")
        print(f"    suit {describe(suit_result)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
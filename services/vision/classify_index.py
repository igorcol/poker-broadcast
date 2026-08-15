"""Classifica glifos de índice contra templates de rank e naipe."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import cv2

from classification import describe, load_templates, rank_candidates, suits_for_ink


def main() -> int:
    parser = argparse.ArgumentParser(description="Classifica glifos de índice contra templates.")
    parser.add_argument("glyphs", type=Path, help="diretório com os glifos extraídos")
    parser.add_argument("--templates", type=Path, default=Path("data/templates"))
    parser.add_argument("--threshold", type=float, default=0.70, help="score mínimo para aceitar a leitura")
    parser.add_argument("--verbose", action="store_true", help="mostra o detalhe de cada par")
    args = parser.parse_args()
    
    ranks = load_templates(args.templates, "rank")
    suits = load_templates(args.templates, "suit")
    if not ranks or not suits:
        print(f"erro: templates não encontrados em {args.templates}", file=sys.stderr)
        return 1

    colors_path = args.glyphs / "colors.json"
    colors: dict[str, str] = json.loads(colors_path.read_text(encoding="utf-8")) if colors_path.exists() else {}

    print(f"{len(ranks)} templates de rank, {len(suits)} de naipe\n")

    # Glifos vêm nomeados <par>_0 e <par>_1; o 0 é o de cima, que é sempre o rank
    groups: dict[str, dict[int, Path]] = defaultdict(dict)
    for path in sorted(args.glyphs.glob("*.png")):
        stem, _, index = path.stem.rpartition("_")
        if index.isdigit():
            groups[stem][int(index)] = path

    tally: Counter[str] = Counter()

    for stem, members in sorted(groups.items()):
        if set(members) != {0, 1}:
            tally["PAR INVÁLIDO"] += 1
            if args.verbose:
                print(f"{stem}: {len(members)} glifos — ignorado")
            continue

        rank_glyph = cv2.imread(str(members[0]), cv2.IMREAD_GRAYSCALE)
        suit_glyph = cv2.imread(str(members[1]), cv2.IMREAD_GRAYSCALE)

        allowed = suits_for_ink(colors.get(members[1].stem, "unknown"))

        rank_result = rank_candidates(rank_glyph, ranks)
        suit_result = rank_candidates(suit_glyph, suits, allowed)

        rank_ok = bool(rank_result) and rank_result[0][1] >= args.threshold
        suit_ok = bool(suit_result) and suit_result[0][1] >= args.threshold

        # Não lido é resultado válido; leitura errada não é. O operador digita o que falhar
        card = f"{rank_result[0][0]}{suit_result[0][0]}" if rank_ok and suit_ok else "NÃO LIDO"
        tally[card] += 1

        if args.verbose:
            print(f"{stem}: {card}")
            print(f"    rank {describe(rank_result)}")
            print(f"    suit {describe(suit_result)}")

    print(f"\n{sum(tally.values())} pares analisados:")
    for card, count in tally.most_common():
        print(f"  {card:>12}  {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
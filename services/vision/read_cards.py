"""Lê cartas de índices detectados em vídeo, frame ou diretório — sem arquivos intermediários."""

# * Uso com webcam:
# python services/vision/read_cards.py --webcam 0 --show

# * Uso em gravação
# python services/vision/read_cards.py data/recordings/peek_0001.mp4 --show

# --show abre janela de visualização

from __future__ import annotations

import argparse
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import cv2
import numpy as np

from classification import describe, load_templates, rank_candidates, suits_for_ink
from detection import find_candidates, find_pairs, pair_bounds
from glyphs import Box, binarize, crop_box, ink_color, normalize, split_blobs

VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv"}

# Resolução dos clipes da Fase 0 - os parâmetros do MSER foram calibrados nesse tamanho
WEBCAM_WIDTH = 848
WEBCAM_HEIGHT = 478

WINDOW = "railbird"


@dataclass(frozen=True)
class Reading:
    """Observação de um índice. `card` None significa não lido — resultado válido, não erro."""

    card: str | None
    rank: list[tuple[str, float]]
    suit: list[tuple[str, float]]
    box: Box


def read_index(
    image: np.ndarray,
    bounds: Box,
    ranks: dict[str, np.ndarray],
    suits: dict[str, np.ndarray],
    threshold: float,
) -> Reading | None:
    x, y, w, h = bounds
    crop = crop_box(image, x + w / 2, y + h / 2, w, h)
    if crop.size == 0:
        return None

    binary = binarize(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY))
    blobs = split_blobs(binary)
    if len(blobs) != 2:
        return None

    (rx, ry, rw, rh), (sx, sy, sw, sh) = blobs
    suit_region = binary[sy:sy + sh, sx:sx + sw]
    allowed = suits_for_ink(ink_color(crop[sy:sy + sh, sx:sx + sw], suit_region))

    rank_result = rank_candidates(normalize(binary[ry:ry + rh, rx:rx + rw]), ranks)
    suit_result = rank_candidates(normalize(suit_region), suits, allowed)

    rank_ok = bool(rank_result) and rank_result[0][1] >= threshold
    suit_ok = bool(suit_result) and suit_result[0][1] >= threshold
    card = f"{rank_result[0][0]}{suit_result[0][0]}" if rank_ok and suit_ok else None

    return Reading(card=card, rank=rank_result, suit=suit_result, box=bounds)


def read_frame(
    image: np.ndarray,
    ranks: dict[str, np.ndarray],
    suits: dict[str, np.ndarray],
    threshold: float,
    min_area: int = 80,
    max_area: int = 3000,
) -> list[Reading | None]:
    """None na lista é par geometricamente válido mas sem dois glifos — contado à parte."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    pairs = find_pairs(find_candidates(gray, min_area, max_area))
    return [read_index(image, pair_bounds(top, bottom), ranks, suits, threshold) for top, bottom in pairs]


def iter_frames(source: Path) -> Iterator[tuple[str, np.ndarray]]:
    if source.is_dir():
        for path in sorted(source.glob("*.png")):
            image = cv2.imread(str(path))
            if image is not None:
                yield path.stem, image
        return

    if source.suffix.lower() in VIDEO_SUFFIXES:
        capture = cv2.VideoCapture(str(source))
        if not capture.isOpened():
            raise RuntimeError(f"não foi possível abrir o vídeo: {source}")

        index = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            yield f"{source.stem}_{index:05d}", frame
            index += 1
        capture.release()
        return

    image = cv2.imread(str(source))
    if image is None:
        raise RuntimeError(f"não foi possível ler: {source}")
    yield source.stem, image


def iter_webcam(index: int) -> Iterator[tuple[str, np.ndarray]]:
    capture = cv2.VideoCapture(index)
    if not capture.isOpened():
        raise RuntimeError(f"não foi possível abrir a webcam {index}")

    capture.set(cv2.CAP_PROP_FRAME_WIDTH, WEBCAM_WIDTH)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, WEBCAM_HEIGHT)

    frame_index = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            yield f"webcam_{frame_index:05d}", frame
            frame_index += 1
    finally:
        capture.release()


def annotate(image: np.ndarray, readings: list[Reading | None], fps: float) -> np.ndarray:
    output = image.copy()

    for reading in readings:
        if reading is None:
            continue

        x, y, w, h = reading.box
        color = (0, 255, 0) if reading.card else (0, 0, 255)
        cv2.rectangle(output, (x, y), (x + w, y + h), color, 2)

        if reading.card:
            # O menor dos dois scores é o gargalo: o limiar exige rank E naipe acima dele
            score = min(reading.rank[0][1], reading.suit[0][1])
            cv2.putText(output, f"{reading.card} {score:.2f}", (x, y - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    cv2.putText(output, f"{fps:.1f} fps", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Lê cartas a partir de vídeo, frame, diretório ou webcam.")
    parser.add_argument("source", type=Path, nargs="?", help="vídeo, PNG ou diretório de PNGs")
    parser.add_argument("--webcam", type=int, default=None, metavar="N", help="lê da webcam N")
    parser.add_argument("--show", action="store_true", help="abre janela com as detecções desenhadas")
    parser.add_argument("--templates", type=Path, default=Path("data/templates"))
    parser.add_argument("--threshold", type=float, default=0.70)
    parser.add_argument("--min-area", type=int, default=80)
    parser.add_argument("--max-area", type=int, default=3000)
    parser.add_argument("--verbose", action="store_true", help="mostra scores de todo índice detectado")
    args = parser.parse_args()

    if (args.source is None) == (args.webcam is None):
        print("erro: informe um arquivo ou --webcam, nunca os dois", file=sys.stderr)
        return 1

    ranks = load_templates(args.templates, "rank")
    suits = load_templates(args.templates, "suit")
    if not ranks or not suits:
        print(f"erro: templates não encontrados em {args.templates}", file=sys.stderr)
        return 1

    print(f"{len(ranks)} templates de rank, {len(suits)} de naipe")
    if args.show:
        print("q para sair\n")

    frames = iter_webcam(args.webcam) if args.webcam is not None else iter_frames(args.source)
    tally: Counter[str] = Counter()
    fps = 0.0

    try:
        for name, image in frames:
            started = time.perf_counter()
            readings = read_frame(image, ranks, suits, args.threshold, args.min_area, args.max_area)
            elapsed = time.perf_counter() - started

            # Mede só o pipeline, sem captura nem exibição — é a latência que a Fase 3 herda.
            # Suavizado porque o instantâneo oscila demais pra ser legível na tela
            instant = 1.0 / elapsed if elapsed > 0 else 0.0
            fps = instant if fps == 0.0 else 0.9 * fps + 0.1 * instant

            for reading in readings:
                if reading is None:
                    tally["PAR INVÁLIDO"] += 1
                else:
                    tally[reading.card or "NÃO LIDO"] += 1

            cards = [r.card for r in readings if r is not None and r.card]
            if cards or args.verbose:
                print(f"{name}: {cards}")

            if args.verbose:
                for reading in readings:
                    if reading is not None:
                        print(f"    rank {describe(reading.rank)}  suit {describe(reading.suit)}")

            if args.show:
                cv2.imshow(WINDOW, annotate(image, readings, fps))
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    except RuntimeError as error:
        print(f"erro: {error}", file=sys.stderr)
        return 1
    finally:
        if args.show:
            cv2.destroyAllWindows()

    print(f"\n{sum(tally.values())} índices analisados:")
    for card, count in tally.most_common():
        print(f"  {card:>12}  {count}")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
"""Detecta índices de carta por MSER, sem modelo treinado."""

# USO:
# python services/vision/detect_mser.py data/frames/peek_0001_frame.png --out data/frames/mser_0001.png --crops data/frames/mser_crops

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

from glyphs import crop_box

# Glifo de rank é mais alto que largo; o naipe é quase quadrado
MIN_ASPECT = 0.35
MAX_ASPECT = 1.6

# Critérios do par rank+naipe: mesmo eixo vertical, colados, tamanhos comparáveis
MAX_CENTER_OFFSET_RATIO = 0.8
MAX_VERTICAL_GAP_RATIO = 1.5
MIN_SIZE_RATIO = 0.45

Box = tuple[int, int, int, int]


def iou(a: Box, b: Box) -> float:
    ax0, ay0, aw, ah = a
    bx0, by0, bw, bh = b
    inter_w = max(0, min(ax0 + aw, bx0 + bw) - max(ax0, bx0))
    inter_h = max(0, min(ay0 + ah, by0 + bh) - max(ay0, by0))
    intersection = inter_w * inter_h
    union = aw * ah + bw * bh - intersection
    return intersection / union if union > 0 else 0.0


def deduplicate(boxes: list[Box], threshold: float = 0.4) -> list[Box]:
    # MSER devolve a mesma região em vários níveis de threshold — sem isso vêm dezenas aninhadas
    kept: list[Box] = []
    for box in sorted(boxes, key=lambda b: b[2] * b[3], reverse=True):
        if all(iou(box, existing) < threshold for existing in kept):
            kept.append(box)
    return kept


def find_candidates(gray: np.ndarray, min_area: int, max_area: int, delta: int) -> list[Box]:
    mser = cv2.MSER_create(delta=delta, min_area=min_area, max_area=max_area)
    # MSER acha regiões claras; a tinta do índice é escura, então inverte antes
    _, raw_boxes = mser.detectRegions(cv2.bitwise_not(gray))

    candidates = [
        (int(x), int(y), int(w), int(h))
        for x, y, w, h in raw_boxes
        if MIN_ASPECT <= w / h <= MAX_ASPECT
    ]
    return deduplicate(candidates)


def is_index_pair(top: Box, bottom: Box) -> bool:
    tx, ty, tw, th = top
    bx, by, bw, bh = bottom

    if by <= ty:
        return False

    if abs((tx + tw / 2) - (bx + bw / 2)) > max(tw, bw) * MAX_CENTER_OFFSET_RATIO:
        return False

    gap = by - (ty + th)
    if gap < 0 or gap > th * MAX_VERTICAL_GAP_RATIO:
        return False

    return min(th, bh) / max(th, bh) >= MIN_SIZE_RATIO


def find_pairs(candidates: list[Box]) -> list[tuple[Box, Box]]:
    ordered = sorted(candidates, key=lambda box: box[1])
    return [
        (top, bottom)
        for index, top in enumerate(ordered)
        for bottom in ordered[index + 1:]
        if is_index_pair(top, bottom)
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Detecta índices de carta por MSER.")
    parser.add_argument("frame", type=Path)
    parser.add_argument("--min-area", type=int, default=80)
    parser.add_argument("--max-area", type=int, default=3000)
    parser.add_argument("--delta", type=int, default=5)
    parser.add_argument("--out", type=Path, default=Path("data/frames/mser.png"))
    parser.add_argument("--crops", type=Path, default=None, help="diretório para salvar o recorte de cada par")
    args = parser.parse_args()

    image = cv2.imread(str(args.frame))
    if image is None:
        print(f"erro: não foi possível ler o frame: {args.frame}", file=sys.stderr)
        return 1

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    candidates = find_candidates(gray, args.min_area, args.max_area, args.delta)
    pairs = find_pairs(candidates)

    annotated = image.copy()
    for x, y, w, h in candidates:
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 0, 255), 1)

    for index, (top, bottom) in enumerate(pairs):
        tx, ty, tw, _ = top
        bx, by, bw, bh = bottom
        x0, y0 = min(tx, bx), ty
        x1, y1 = max(tx + tw, bx + bw), by + bh
        cv2.rectangle(annotated, (x0, y0), (x1, y1), (0, 255, 0), 2)

        if args.crops:
            args.crops.mkdir(parents=True, exist_ok=True)
            crop = crop_box(image, (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0)
            cv2.imwrite(str(args.crops / f"{args.frame.stem}_pair{index}.png"), crop)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.out), annotated)
    print(f"{len(candidates)} candidatos, {len(pairs)} pares — anotado em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
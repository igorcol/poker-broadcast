"""Detecção de índices de carta na cena, por MSER e pareamento geométrico."""

from __future__ import annotations

import cv2
import numpy as np

from glyphs import Box

# Glifo de rank é mais alto que largo; o naipe é quase quadrado
MIN_ASPECT = 0.35
MAX_ASPECT = 1.6

# Critérios do par rank+naipe: mesmo eixo vertical, colados, tamanhos comparáveis
MAX_CENTER_OFFSET_RATIO = 0.8
MAX_VERTICAL_GAP_RATIO = 1.5
MIN_SIZE_RATIO = 0.45


def iou(a: Box, b: Box) -> float:
    inter_w = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    inter_h = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    intersection = inter_w * inter_h
    union = a[2] * a[3] + b[2] * b[3] - intersection
    return intersection / union if union > 0 else 0.0


def deduplicate(boxes: list[Box], threshold: float = 0.4) -> list[Box]:
    # MSER devolve a mesma região em vários níveis de threshold — sem isso vêm dezenas aninhadas
    kept: list[Box] = []
    for box in sorted(boxes, key=lambda b: b[2] * b[3], reverse=True):
        if all(iou(box, existing) < threshold for existing in kept):
            kept.append(box)
    return kept


def find_candidates(gray: np.ndarray, min_area: int = 80, max_area: int = 3000, delta: int = 5) -> list[Box]:
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


def pair_bounds(top: Box, bottom: Box) -> Box:
    """Retângulo cobrindo rank e naipe — é o recorte do índice inteiro."""
    x0, y0 = min(top[0], bottom[0]), top[1]
    x1 = max(top[0] + top[2], bottom[0] + bottom[2])
    y1 = bottom[1] + bottom[3]
    return (x0, y0, x1 - x0, y1 - y0)
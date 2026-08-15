"""Operações sobre o índice de uma carta: recorte, binarização e separação de glifos."""

from __future__ import annotations

import cv2
import numpy as np

NORMALIZED_SIZE = 48
MIN_BLOB_AREA_RATIO = 0.01

# Fusão de blobs lado a lado: o `10` é o único rank escrito com dois glifos
MIN_VERTICAL_OVERLAP = 0.6
MAX_HORIZONTAL_GAP_RATIO = 0.6

# Diferença mínima entre o canal vermelho e o maior dos outros para considerar tinta vermelha
RED_MARGIN = 20


def crop_box(image: np.ndarray, center_x: float, center_y: float, width: float, height: float) -> np.ndarray:
    # Clampa nas bordas: box perto da margem estoura o frame e devolve recorte vazio
    x0, y0 = max(0, int(center_x - width / 2)), max(0, int(center_y - height / 2))
    x1 = min(image.shape[1], int(center_x + width / 2))
    y1 = min(image.shape[0], int(center_y + height / 2))
    return image[y0:y1, x0:x1]


def binarize(gray: np.ndarray) -> np.ndarray:
    # BINARY_INV porque a tinta é escura: o resto do pipeline espera glifo branco em fundo preto
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return binary


def normalize(blob: np.ndarray) -> np.ndarray:
    height, width = blob.shape
    side = max(height, width)
    # Quadrado com padding antes do resize: esticar direto deixaria o losango de ouros
    # com a mesma silhueta do coração de copas
    square = np.zeros((side, side), dtype=np.uint8)
    y0, x0 = (side - height) // 2, (side - width) // 2
    square[y0:y0 + height, x0:x0 + width] = blob
    return cv2.resize(square, (NORMALIZED_SIZE, NORMALIZED_SIZE), interpolation=cv2.INTER_AREA)


Box = tuple[int, int, int, int]


def _union(a: Box, b: Box) -> Box:
    x0, y0 = min(a[0], b[0]), min(a[1], b[1])
    x1, y1 = max(a[0] + a[2], b[0] + b[2]), max(a[1] + a[3], b[1] + b[3])
    return (x0, y0, x1 - x0, y1 - y0)


def _same_line(a: Box, b: Box) -> bool:
    overlap = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
    shorter = min(a[3], b[3])
    if shorter <= 0 or overlap / shorter < MIN_VERTICAL_OVERLAP:
        return False

    gap = max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]))
    return gap <= max(a[2], b[2]) * MAX_HORIZONTAL_GAP_RATIO


def merge_glyph_parts(boxes: list[Box]) -> list[Box]:
    """Funde blobs vizinhos na mesma linha — sem isso o `10` vira dois glifos separados."""
    merged = list(boxes)
    fused = True
    while fused:
        fused = False
        for i, first in enumerate(merged):
            for j, second in enumerate(merged[i + 1:], start=i + 1):
                if _same_line(first, second):
                    merged[i] = _union(first, second)
                    del merged[j]
                    fused = True
                    break
            if fused:
                break
    return merged


def split_blobs(binary: np.ndarray) -> list[Box]:
    """Bounding boxes dos glifos, ordenadas de cima para baixo."""
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = binary.shape[0] * binary.shape[1] * MIN_BLOB_AREA_RATIO

    boxes = [
        cv2.boundingRect(contour)
        for contour in contours
        if cv2.contourArea(contour) >= min_area
    ]
    return sorted(merge_glyph_parts(boxes), key=lambda box: box[1])

def ink_color(crop: np.ndarray, mask: np.ndarray) -> str:
    """Cor da tinta do glifo — sobrevive à compressão e corta os candidatos de naipe pela metade."""
    pixels = crop[mask > 0]
    if pixels.size == 0:
        return "unknown"
    blue, green, red = pixels.mean(axis=0)
    return "red" if red - max(blue, green) > RED_MARGIN else "black"
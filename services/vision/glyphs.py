"""Operações sobre o índice de uma carta: recorte, binarização e separação de glifos."""

from __future__ import annotations

import cv2
import numpy as np

NORMALIZED_SIZE = 48
MIN_BLOB_AREA_RATIO = 0.01


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


def split_blobs(binary: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Bounding boxes dos glifos, ordenadas de cima para baixo."""
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = binary.shape[0] * binary.shape[1] * MIN_BLOB_AREA_RATIO

    boxes = [
        cv2.boundingRect(contour)
        for contour in contours
        if cv2.contourArea(contour) >= min_area
    ]
    boxes.sort(key=lambda box: box[1])
    return boxes
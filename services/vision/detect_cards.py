"""Desenha os contornos candidatos a carta sobre um frame, para inspeção visual."""

# python services/vision/detect_cards.py data/frames/peek_0001_00170.png
# Usar frame que cartas estão levantadas

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

# Área mínima em fração do frame. Descarta ruído de textura da mesa e do fundo
MIN_AREA_RATIO = 0.01


def find_card_contours(image: np.ndarray) -> list[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # Dilata pra fechar borda interrompida por sombra na quina da carta
    closed = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = image.shape[0] * image.shape[1] * MIN_AREA_RATIO

    candidates: list[np.ndarray] = []
    for contour in contours:
        if cv2.contourArea(contour) < min_area:
            continue
        perimeter = cv2.arcLength(contour, closed=True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, closed=True)
        candidates.append(approx)

    return candidates


def annotate(image: np.ndarray, contours: list[np.ndarray]) -> np.ndarray:
    output = image.copy()
    for contour in contours:
        corners = len(contour)
        # Verde quando fecha em 4 cantos, vermelho quando não. O que queremos enxergar
        color = (0, 255, 0) if corners == 4 else (0, 0, 255)
        cv2.drawContours(output, [contour], -1, color, 2)
        x, y = contour[0][0]
        cv2.putText(output, str(corners), (int(x), int(y) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Anota contornos candidatos a carta em um frame.")
    parser.add_argument("frame", type=Path, help="caminho do frame PNG")
    parser.add_argument("--out", type=Path, default=Path("data/frames/annotated.png"))
    args = parser.parse_args()

    image = cv2.imread(str(args.frame))
    if image is None:
        print(f"erro: não foi possível ler o frame: {args.frame}", file=sys.stderr)
        return 1

    contours = find_card_contours(image)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.out), annotate(image, contours))

    print(f"{len(contours)} candidatos — cantos: {[len(c) for c in contours]}")
    print(f"anotado em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
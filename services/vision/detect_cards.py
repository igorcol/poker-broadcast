"""Desenha os contornos candidatos a carta sobre um frame, para inspeção visual."""

# python services/vision/detect_cards.py data/frames/peek_0001_00170.png
# python services/vision/detect_cards.py data/frames/peek_0001_00170.png --roi 0,0.3,1,1
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
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Carta é papel branco — saturação baixa, brilho alto. A borda contra a mesa
    # é fraca demais pro Canny, mas a região inteira se separa bem por cor
    lower = np.array([0, 0, 150])
    upper = np.array([180, 60, 255])
    mask = cv2.inRange(hsv, lower, upper)

    # Fecha buracos pequenos (miolo do naipe, faixa amarela) sem grudar blobs distintos
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))

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


def parse_roi(value: str, width: int, height: int) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = (float(part) for part in value.split(","))
    return int(x0 * width), int(y0 * height), int(x1 * width), int(y1 * height)


def main() -> int:
    parser = argparse.ArgumentParser(description="Anota contornos candidatos a carta em um frame.")
    parser.add_argument("frame", type=Path, help="caminho do frame PNG")
    parser.add_argument("--out", type=Path, default=Path("data/frames/annotated.png"))
    parser.add_argument(
        "--roi",
        type=str,
        default="0,0,1,1",
        help="x0,y0,x1,y1 como fração do frame (0-1) — corta o fundo antes de detectar",
    )
    args = parser.parse_args()

    image = cv2.imread(str(args.frame))
    if image is None:
        print(f"erro: não foi possível ler o frame: {args.frame}", file=sys.stderr)
        return 1

    height, width = image.shape[:2]
    x0, y0, x1, y1 = parse_roi(args.roi, width, height)
    cropped = image[y0:y1, x0:x1]

    contours = find_card_contours(cropped)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.out), annotate(cropped, contours))

    print(f"{len(contours)} candidatos — cantos: {[len(c) for c in contours]}")
    print(f"anotado em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
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


def find_card_contours(image: np.ndarray, background: np.ndarray) -> list[np.ndarray]:
    diff = cv2.absdiff(
        cv2.cvtColor(image, cv2.COLOR_BGR2GRAY),
        cv2.cvtColor(background, cv2.COLOR_BGR2GRAY),
    )
    # Otsu acha o corte ótimo pro histograma desse frame — não fica refém de um
    # valor fixo de brilho, que a mesa acabou de provar que varia por cena
    _, mask = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
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
    parser.add_argument("--background", type=Path, required=True, help="frame de referência sem mão nem carta levantada")
    parser.add_argument("--out", type=Path, default=Path("data/frames/annotated.png"))
    parser.add_argument(
        "--roi",
        type=str,
        default="0,0,1,1",
        help="x0,y0,x1,y1 como fração do frame (0-1) — corta o fundo antes de detectar",
    )
    args = parser.parse_args()

    image = cv2.imread(str(args.frame))
    background = cv2.imread(str(args.background))
    if image is None:
        print(f"erro: não foi possível ler o frame: {args.frame}", file=sys.stderr)
        return 1
    if background is None:
        print(f"erro: não foi possível ler o background: {args.background}", file=sys.stderr)
        return 1
    if image.shape != background.shape:
        print("erro: frame e background têm dimensões diferentes", file=sys.stderr)
        return 1

    height, width = image.shape[:2]
    x0, y0, x1, y1 = parse_roi(args.roi, width, height)
    cropped = image[y0:y1, x0:x1]
    cropped_background = background[y0:y1, x0:x1]

    contours = find_card_contours(cropped, cropped_background)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.out), annotate(cropped, contours))

    print(f"{len(contours)} candidatos — cantos: {[len(c) for c in contours]}")
    print(f"anotado em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
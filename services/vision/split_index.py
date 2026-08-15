""" Separa o recorte do índice em blobs (rank e naipe) e normaliza cada um. """

# --- USO: 
# 1. Separa em crops
# python services/vision/crop_index.py data/frames/peek_0001_frame.png --box 435,265,60,120 --out data/frames/crops/peek_0001.png
# 2. split index
# python services/vision/split_index.py data/frames/crops/peek_0001.png

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

NORMALIZED_SIZE = 48
MIN_BLOB_AREA_RATIO = 0.01


def normalize(blob: np.ndarray) -> np.ndarray:
    height, width = blob.shape
    side = max(height, width)
    # Quadrado com padding antes do resize: esticar direto pra 48x48 deixaria o losango
    # de ouros com a mesma silhueta do coração de copas
    square = np.zeros((side, side), dtype=np.uint8)
    y0, x0 = (side - height) // 2, (side - width) // 2
    square[y0:y0 + height, x0:x0 + width] = blob
    return cv2.resize(square, (NORMALIZED_SIZE, NORMALIZED_SIZE), interpolation=cv2.INTER_AREA)


def main() -> int:
    parser = argparse.ArgumentParser(description="Separa rank e naipe do recorte do índice.")
    parser.add_argument("crop", type=Path, help="recorte gerado por crop_index.py")
    parser.add_argument("--out", type=Path, default=Path("data/frames/glyphs"))
    args = parser.parse_args()

    image = cv2.imread(str(args.crop), cv2.IMREAD_GRAYSCALE)
    if image is None:
        print(f"erro: não foi possível ler o recorte: {args.crop}", file=sys.stderr)
        return 1

    # BINARY_INV porque a tinta é escura: o resto do pipeline espera glifo branco em fundo preto
    _, binary = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = image.shape[0] * image.shape[1] * MIN_BLOB_AREA_RATIO

    blobs = [contour for contour in contours if cv2.contourArea(contour) >= min_area]
    blobs.sort(key=lambda contour: cv2.boundingRect(contour)[1])

    args.out.mkdir(parents=True, exist_ok=True)

    for index, contour in enumerate(blobs):
        x, y, w, h = cv2.boundingRect(contour)
        normalized = normalize(binary[y:y + h, x:x + w])
        cv2.imwrite(str(args.out / f"{args.crop.stem}_{index}.png"), normalized)
        print(f"blob {index}: {w}x{h} em ({x},{y})")

    print(f"{len(blobs)} blobs salvos em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
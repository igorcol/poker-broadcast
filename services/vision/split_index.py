"""Separa o recorte do índice em glifos (rank e naipe) normalizados."""

# USO: python services/vision/split_index.py data/frames/crops/peek_0001.png

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from glyphs import binarize, normalize, split_blobs


def main() -> int:
    parser = argparse.ArgumentParser(description="Separa rank e naipe do recorte do índice.")
    parser.add_argument("crop", type=Path, help="recorte gerado por crop_index.py")
    parser.add_argument("--out", type=Path, default=Path("data/frames/glyphs"))
    args = parser.parse_args()

    image = cv2.imread(str(args.crop), cv2.IMREAD_GRAYSCALE)
    if image is None:
        print(f"erro: não foi possível ler o recorte: {args.crop}", file=sys.stderr)
        return 1

    binary = binarize(image)
    boxes = split_blobs(binary)

    args.out.mkdir(parents=True, exist_ok=True)

    for index, (x, y, w, h) in enumerate(boxes):
        cv2.imwrite(str(args.out / f"{args.crop.stem}_{index}.png"), normalize(binary[y:y + h, x:x + w]))
        print(f"glifo {index}: {w}x{h} em ({x},{y})")

    print(f"{len(boxes)} glifos salvos em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
"""Separa o recorte do índice em glifos (rank e naipe) normalizados."""

# USO: 
# python services/vision/split_index.py data/frames/crops/peek_0001.png
# python services/vision/split_index.py data/frames/mser_crops --out data/frames/mser_glyphs

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from glyphs import binarize, normalize, split_blobs


def split_crop(crop_path: Path, output_dir: Path) -> int:
    image = cv2.imread(str(crop_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        print(f"aviso: não foi possível ler {crop_path}", file=sys.stderr)
        return 0

    binary = binarize(image)
    boxes = split_blobs(binary)

    for index, (x, y, w, h) in enumerate(boxes):
        cv2.imwrite(str(output_dir / f"{crop_path.stem}_{index}.png"), normalize(binary[y:y + h, x:x + w]))

    print(f"{crop_path.name}: {len(boxes)} glifos {[(w, h) for _, _, w, h in boxes]}")
    return len(boxes)


def main() -> int:
    parser = argparse.ArgumentParser(description="Separa rank e naipe do recorte do índice.")
    parser.add_argument("crop", type=Path, help="recorte ou diretório de recortes")
    parser.add_argument("--out", type=Path, default=Path("data/frames/glyphs"))
    args = parser.parse_args()

    crops = sorted(args.crop.glob("*.png")) if args.crop.is_dir() else [args.crop]
    if not crops:
        print(f"erro: nenhum recorte em {args.crop}", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    total = sum(split_crop(path, args.out) for path in crops)

    print(f"{total} glifos salvos em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
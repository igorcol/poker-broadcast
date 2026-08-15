"""Separa o recorte do índice em glifos (rank e naipe) normalizados."""

# USO: 
# python services/vision/split_index.py data/frames/crops/peek_0001.png
# python services/vision/split_index.py data/frames/mser_crops --out data/frames/mser_glyphs

from __future__ import annotations

import argparse
import sys
from pathlib import Path
import cv2
import json

from glyphs import binarize, ink_color, normalize, split_blobs


def split_crop(crop_path: Path, output_dir: Path) -> dict[str, str]:
    crop = cv2.imread(str(crop_path))
    if crop is None:
        print(f"aviso: não foi possível ler {crop_path}", file=sys.stderr)
        return {}

    binary = binarize(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY))
    boxes = split_blobs(binary)

    colors: dict[str, str] = {}
    for index, (x, y, w, h) in enumerate(boxes):
        region = binary[y:y + h, x:x + w]
        name = f"{crop_path.stem}_{index}"
        cv2.imwrite(str(output_dir / f"{name}.png"), normalize(region))
        colors[name] = ink_color(crop[y:y + h, x:x + w], region)

    print(f"{crop_path.name}: {len(boxes)} glifos {list(colors.values())}")
    return colors


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

    colors: dict[str, str] = {}
    for path in crops:
        colors.update(split_crop(path, args.out))

    # Sidecar em vez de sufixo no nome: nome de arquivo é chave, não campo de dado
    (args.out / "colors.json").write_text(json.dumps(colors, indent=2), encoding="utf-8")

    print(f"{len(colors)} glifos salvos em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
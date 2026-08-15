"""Recorta a região de uma detecção no frame original e amplia, para inspeção do naipe."""

# USO: python services/vision/crop_index.py data/frames/peek_0001_frame.png --box 435,265,60,120 --out data/frames/crops/peek_0001.png

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from glyphs import crop_box


def main() -> int:
    parser = argparse.ArgumentParser(description="Recorta e amplia o índice detectado.")
    parser.add_argument("frame", type=Path)
    parser.add_argument("--box", type=str, required=True, help="cx,cy,w,h em pixels")
    parser.add_argument("--scale", type=int, default=8, help="fator de ampliação")
    parser.add_argument("--pad", type=float, default=1.0, help="fator de expansão da box")
    parser.add_argument("--out", type=Path, default=Path("data/frames/crop.png"))
    args = parser.parse_args()

    image = cv2.imread(str(args.frame))
    if image is None:
        print(f"erro: não foi possível ler o frame: {args.frame}", file=sys.stderr)
        return 1

    cx, cy, w, h = (float(part) for part in args.box.split(","))
    crop = crop_box(image, cx, cy, w * args.pad, h * args.pad)

    if crop.size == 0:
        print("erro: recorte vazio — confira as coordenadas da box", file=sys.stderr)
        return 1

    # INTER_NEAREST de propósito: quero ver o pixel real, não interpolação inventando borda
    enlarged = cv2.resize(crop, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_NEAREST)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.out), enlarged)
    print(f"recorte {crop.shape[1]}x{crop.shape[0]} ampliado {args.scale}x em {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
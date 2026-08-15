"""Anota visualmente os índices detectados — ferramenta de inspeção."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from detection import find_candidates, find_pairs, pair_bounds
from glyphs import crop_box


def process_frame(
    frame_path: Path,
    min_area: int,
    max_area: int,
    delta: int,
    annotated_dir: Path,
    crops_dir: Path | None,
) -> None:
    image = cv2.imread(str(frame_path))
    if image is None:
        print(f"aviso: não foi possível ler {frame_path}", file=sys.stderr)
        return

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    candidates = find_candidates(gray, min_area, max_area, delta)
    pairs = find_pairs(candidates)

    annotated = image.copy()
    for x, y, w, h in candidates:
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 0, 255), 1)

    for index, (top, bottom) in enumerate(pairs):
        x, y, w, h = pair_bounds(top, bottom)
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 2)

        if crops_dir:
            crop = crop_box(image, x + w / 2, y + h / 2, w, h)
            cv2.imwrite(str(crops_dir / f"{frame_path.stem}_pair{index}.png"), crop)

    cv2.imwrite(str(annotated_dir / f"{frame_path.stem}.png"), annotated)
    print(f"{frame_path.name}: {len(candidates)} candidatos, {len(pairs)} pares")


def main() -> int:
    parser = argparse.ArgumentParser(description="Anota índices de carta detectados por MSER.")
    parser.add_argument("frames", type=Path, nargs="+", help="frames PNG ou diretórios")
    parser.add_argument("--min-area", type=int, default=80)
    parser.add_argument("--max-area", type=int, default=3000)
    parser.add_argument("--delta", type=int, default=5)
    parser.add_argument("--out", type=Path, default=Path("data/frames/mser"), help="diretório dos anotados")
    parser.add_argument("--crops", type=Path, default=None, help="diretório para salvar o recorte de cada par")
    args = parser.parse_args()

    frames: list[Path] = []
    for path in args.frames:
        frames.extend(sorted(path.glob("*.png")) if path.is_dir() else [path])

    if not frames:
        print("erro: nenhum frame encontrado", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    if args.crops:
        args.crops.mkdir(parents=True, exist_ok=True)

    for frame_path in frames:
        process_frame(frame_path, args.min_area, args.max_area, args.delta, args.out, args.crops)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
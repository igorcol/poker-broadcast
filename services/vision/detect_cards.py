"""Roda um modelo YOLO de detecção de cartas sobre frames e anota o resultado."""

# EM UM FRAME: python services/vision/detect_cards.py data/frames/peek_0001_00170.png
# CLIPE INTEIRO (/frames): python services/vision/detect_cards.py data/frames --out data/frames/allframes --conf 0.15

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO


def collect_frames(paths: list[Path]) -> list[Path]:
    # Aceita arquivo ou diretório: PowerShell não expande wildcard pra programa externo
    frames: list[Path] = []
    for path in paths:
        if path.is_dir():
            frames.extend(sorted(path.glob("*.png")))
        else:
            frames.append(path)
    return frames


def main() -> int:
    parser = argparse.ArgumentParser(description="Detecta cartas em frames com um modelo YOLO treinado.")
    parser.add_argument("frames", type=Path, nargs="+", help="frames PNG ou diretório")
    parser.add_argument("--model", type=Path, default=Path("services/vision/models/playing-cards.pt"))
    parser.add_argument("--out", type=Path, default=Path("data/frames/detected"))
    parser.add_argument("--conf", type=float, default=0.25, help="confiança mínima")
    parser.add_argument("--imgsz", type=int, default=640, help="resolução de entrada do modelo")
    parser.add_argument("--augment", action="store_true", help="test-time augmentation")
    args = parser.parse_args()

    if not args.model.exists():
        print(f"erro: pesos não encontrados em {args.model}", file=sys.stderr)
        return 1

    model = YOLO(str(args.model))
    args.out.mkdir(parents=True, exist_ok=True)

    for frame_path in collect_frames(args.frames):
        image = cv2.imread(str(frame_path))
        if image is None:
            print(f"aviso: não foi possível ler {frame_path}", file=sys.stderr)
            continue

        detections = model.predict(
            image, conf=args.conf, imgsz=args.imgsz, augment=args.augment, verbose=False
        )[0]

        labels = [
            f"{detections.names[int(box.cls)]} {float(box.conf):.2f}"
            for box in detections.boxes
        ]

        cv2.imwrite(str(args.out / frame_path.name), detections.plot())
        print(f"{frame_path.name}: {labels if labels else 'nada detectado'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
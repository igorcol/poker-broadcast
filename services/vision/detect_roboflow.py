"""Detecta cartas via API hospedada do Roboflow."""

from __future__ import annotations

import argparse
import base64
import os
import sys
from pathlib import Path

import requests

# USO: python services/vision/detect_roboflow.py data/frames

MODEL_ID = "playing-cards-detection/1"
ENDPOINT = f"https://detect.roboflow.com/{MODEL_ID}"


def collect_frames(paths: list[Path]) -> list[Path]:
    frames: list[Path] = []
    for path in paths:
        if path.is_dir():
            frames.extend(sorted(path.glob("*.png")))
        else:
            frames.append(path)
    return frames


def detect(image_path: Path, api_key: str, confidence: int) -> list[dict[str, object]]:
    encoded = base64.b64encode(image_path.read_bytes())
    response = requests.post(
        ENDPOINT,
        params={"api_key": api_key, "confidence": confidence},
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(f"roboflow respondeu {response.status_code}: {response.text}")
    return response.json().get("predictions", [])


def main() -> int:
    parser = argparse.ArgumentParser(description="Detecta cartas via API do Roboflow.")
    parser.add_argument("frames", type=Path, nargs="+", help="frames PNG ou diretório")
    parser.add_argument("--conf", type=int, default=20, help="confiança mínima em porcentagem")
    args = parser.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if not api_key:
        print("erro: defina ROBOFLOW_API_KEY no ambiente", file=sys.stderr)
        return 1

    for frame_path in collect_frames(args.frames):
        try:
            predictions = detect(frame_path, api_key, args.conf)
        except RuntimeError as error:
            print(f"erro em {frame_path.name}: {error}", file=sys.stderr)
            continue

        # A box vai junto: é ela que alimenta o crop_index no passo seguinte
        detections = [
            f"{p['class']} {p['confidence']:.2f} box={p['x']:.0f},{p['y']:.0f},{p['width']:.0f},{p['height']:.0f}"
            for p in predictions
        ]
        print(f"{frame_path.name}: {detections if detections else 'nada detectado'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
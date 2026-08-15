""" Extrai frames de uma gravação de peek para inspeção manual. """

# * Uso: python services/vision/extract_frames.py data/recordings/peek_0001.mp4

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

def extract_frames(video_path: Path, output_dir: Path, every_n: int) -> int:
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
                raise RuntimeError(f"Não foi possível abrir o vídeo '{video_path}'")

        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = capture.get(cv2.CAP_PROP_FPS)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0.0

        print(f"{video_path.name}: {width}x{height} @ {fps:.1}fps - {frame_count} frames ({duration:.1f}s)")

        output_dir.mkdir(parents=True, exist_ok=True)

        saved = 0
        index = 0

        while True:
                ok, frame = capture.read()
                if not ok:
                        break

                if index % every_n == 0:
                        cv2.imwrite(str(output_dir / f"{video_path.stem}_{index:05d}.png"), frame)
                        saved += 1

                index += 1

        capture.release()
        return saved


# ---- MAIN ----
def main() -> int:
        parser = argparse.ArgumentParser(description="Extrai frames PNG de uma gravação de peek.")
        parser.add_argument("video", type=Path, help="caminho do arquivo de vídeo")
        parser.add_argument("--out", type=Path, default=Path("data/frames"), help="diretório de saída")
        parser.add_argument("--every", type=int, default=5, help="salva 1 frame a cada N")
        args = parser.parse_args()

        try:
                saved = extract_frames(args.video, args.out, args.every)
        except RuntimeError as error:
                print(f"Erro: {error}", file=sys.stderr)
                return 1

        print(f"{saved} frames salvos em {args.out}")
        return 0

if __name__ == "__main__":
        raise SystemExit(main())
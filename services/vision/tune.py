"""Calibração interativa da segmentação — mostra cada estágio do pipeline com sliders."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

WINDOW = "tune"
PANEL_WIDTH = 480


def _noop(_: int) -> None:
    pass


def label(panel: np.ndarray, text: str) -> np.ndarray:
    output = panel.copy()
    cv2.putText(output, text, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    return output


def to_panel(image: np.ndarray, text: str) -> np.ndarray:
    bgr = image if image.ndim == 3 else cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    scale = PANEL_WIDTH / bgr.shape[1]
    resized = cv2.resize(bgr, (PANEL_WIDTH, int(bgr.shape[0] * scale)))
    return label(resized, text)


def main() -> int:
    parser = argparse.ArgumentParser(description="Calibração interativa da segmentação de cartas.")
    parser.add_argument("frame", type=Path, help="frame com as cartas levantadas")
    parser.add_argument("--background", type=Path, required=True, help="frame de referência sem mão")
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

    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
    cv2.createTrackbar("roi_top %", WINDOW, 0, 90, _noop)
    cv2.createTrackbar("thresh 0=otsu", WINDOW, 0, 255, _noop)
    cv2.createTrackbar("kernel", WINDOW, 15, 41, _noop)
    cv2.createTrackbar("min_area 0.1%", WINDOW, 10, 300, _noop)

    print("q = sair | s = imprimir os valores atuais")

    while True:
        top_pct = cv2.getTrackbarPos("roi_top %", WINDOW)
        thresh_value = cv2.getTrackbarPos("thresh 0=otsu", WINDOW)
        kernel_size = max(1, cv2.getTrackbarPos("kernel", WINDOW) | 1)  # morfologia exige kernel ímpar
        min_area_permille = cv2.getTrackbarPos("min_area 0.1%", WINDOW)

        y0 = int(image.shape[0] * top_pct / 100)
        cropped = image[y0:, :]
        cropped_background = background[y0:, :]

        diff = cv2.absdiff(
            cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY),
            cv2.cvtColor(cropped_background, cv2.COLOR_BGR2GRAY),
        )

        if thresh_value == 0:
            _, mask = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:
            _, mask = cv2.threshold(diff, thresh_value, 255, cv2.THRESH_BINARY)

        closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((kernel_size, kernel_size), np.uint8))

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        min_area = cropped.shape[0] * cropped.shape[1] * min_area_permille / 1000

        result = cropped.copy()
        corner_counts: list[int] = []
        for contour in contours:
            if cv2.contourArea(contour) < min_area:
                continue
            perimeter = cv2.arcLength(contour, closed=True)
            approx = cv2.approxPolyDP(contour, 0.02 * perimeter, closed=True)
            corner_counts.append(len(approx))
            color = (0, 255, 0) if len(approx) == 4 else (0, 0, 255)
            cv2.drawContours(result, [approx], -1, color, 2)

        top_row = np.hstack([to_panel(cropped, "1. frame"), to_panel(diff, "2. diff")])
        bottom_row = np.hstack([to_panel(closed, "3. mask"), to_panel(result, f"4. {corner_counts}")])
        cv2.imshow(WINDOW, np.vstack([top_row, bottom_row]))

        key = cv2.waitKey(30) & 0xFF
        if key == ord("q"):
            break
        if key == ord("s"):
            print(
                f"roi_top={top_pct}% thresh={thresh_value} kernel={kernel_size} "
                f"min_area={min_area_permille}/1000 -> cantos {corner_counts}"
            )

    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
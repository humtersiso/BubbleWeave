# One-shot detect — same fast/fallback logic as animeface-worker.py
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PT = ROOT / "models" / "yolov8x6_animeface.pt"
ONNX = ROOT / "models" / "yolov8x6_animeface.onnx"
CONF, IOU = 0.15, 0.5


def boxes_to_faces(results):
    faces = []
    for r in results:
        h, w = r.orig_shape
        if r.boxes is None:
            continue
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            score = float(box.conf[0])
            bw, bh = max(1.0, x2 - x1), max(1.0, y2 - y1)
            cx, cy = (x1 + x2) / 2.0, y1 + bh * 0.42
            faces.append(
                {
                    "x": max(0.0, min(1.0, cx / w)),
                    "y": max(0.0, min(1.0, cy / h)),
                    "mouthX": max(0.0, min(1.0, cx / w)),
                    "mouthY": max(0.0, min(1.0, (y1 + bh * 0.72) / h)),
                    "score": score,
                    "area": (bw * bh) / float(w * h),
                }
            )
    faces.sort(key=lambda f: f["score"] * (f["area"] ** 0.5), reverse=True)
    return faces


def main() -> None:
    if len(sys.argv) < 2:
        print("[]")
        return
    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print("[]")
        return

    from ultralytics import YOLO

    model = YOLO(str(PT if PT.exists() else ONNX))
    faces = boxes_to_faces(
        model.predict(
            source=str(image_path), conf=CONF, iou=IOU, imgsz=1280, verbose=False
        )
    )
    print(json.dumps(faces, ensure_ascii=False))


if __name__ == "__main__":
    main()

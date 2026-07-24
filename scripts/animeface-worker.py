# Persistent anime-face worker (Fuyucch1/yolov8_animeface)
# Protocol: each stdin line = absolute image path
#           each stdout line = JSON array of faces
#           stdin line "ping" -> "pong"
from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PT = ROOT / "models" / "yolov8x6_animeface.pt"
ONNX = ROOT / "models" / "yolov8x6_animeface.onnx"
OPENVINO_DIR = ROOT / "models" / "yolov8x6_animeface_openvino_model"

CONF = float(__import__("os").environ.get("BW_FACE_CONF", "0.08"))
IOU = float(__import__("os").environ.get("BW_FACE_IOU", "0.45"))
# Fixed high precision（可用 BW_FACE_IMGSZ 覆寫）
IMGSZ = int(__import__("os").environ.get("BW_FACE_IMGSZ", "1280"))

# in-memory cache: sha256(file) -> faces
_CACHE: dict[str, list] = {}
_CACHE_MAX = 128


def _file_key(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _boxes_to_faces(results) -> list:
    faces = []
    for r in results:
        h, w = r.orig_shape
        if r.boxes is None:
            continue
        for box in r.boxes:
            xyxy = box.xyxy[0].tolist()
            score = float(box.conf[0])
            x1, y1, x2, y2 = xyxy
            bw = max(1.0, x2 - x1)
            bh = max(1.0, y2 - y1)
            cx = (x1 + x2) / 2.0
            cy = y1 + bh * 0.42
            my = y1 + bh * 0.72
            faces.append(
                {
                    "x": max(0.0, min(1.0, cx / w)),
                    "y": max(0.0, min(1.0, cy / h)),
                    "mouthX": max(0.0, min(1.0, cx / w)),
                    "mouthY": max(0.0, min(1.0, my / h)),
                    "score": score,
                    "area": (bw * bh) / float(w * h),
                }
            )
    faces.sort(key=lambda f: f["score"] * (f["area"] ** 0.5), reverse=True)
    return faces


def detect(model, image_path: Path):
    key = _file_key(image_path)
    if key in _CACHE:
        return _CACHE[key]

    t0 = time.perf_counter()
    results = model.predict(
        source=str(image_path),
        conf=CONF,
        iou=IOU,
        imgsz=IMGSZ,
        verbose=False,
    )
    faces = _boxes_to_faces(results)
    used = IMGSZ

    elapsed = time.perf_counter() - t0
    sys.stderr.write(
        f"[animeface] {image_path.name} faces={len(faces)} imgsz={used} {elapsed:.2f}s\n"
    )
    sys.stderr.flush()

    if len(_CACHE) >= _CACHE_MAX:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[key] = faces
    return faces


def resolve_weights() -> str:
    # OpenVINO (Intel CPU) if exported
    if OPENVINO_DIR.exists():
        xmls = list(OPENVINO_DIR.glob("*.xml"))
        if xmls:
            return str(xmls[0])
    if PT.exists():
        return str(PT)
    return str(ONNX)


def main() -> None:
    from ultralytics import YOLO

    weights = resolve_weights()
    model = YOLO(weights)
    # warmup
    try:
        import numpy as np
        from PIL import Image

        warm = ROOT / "data" / "generated" / ".face-tmp" / "_warmup.jpg"
        warm.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(np.full((64, 64, 3), 128, dtype=np.uint8)).save(warm)
        model.predict(str(warm), conf=CONF, imgsz=IMGSZ, verbose=False)
    except Exception as e:
        sys.stderr.write(f"[animeface] warmup skip: {e}\n")

    sys.stderr.write(f"[animeface] ready weights={weights}\n")
    sys.stderr.flush()
    print("READY", flush=True)

    for line in sys.stdin:
        path = line.strip()
        if not path:
            continue
        if path == "ping":
            print("pong", flush=True)
            continue
        if path == "quit":
            break
        try:
            faces = detect(model, Path(path))
            print(json.dumps(faces, ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()

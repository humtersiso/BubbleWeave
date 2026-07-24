/**
 * 下載 Fuyucch1/yolov8_animeface 並匯出瀏覽器用 ONNX
 * https://github.com/Fuyucch1/yolov8_animeface
 *
 * 用法：python scripts/export-animeface-onnx.py
 */
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"
PUBLIC = ROOT / "public" / "models"
PT_URL = "https://github.com/Fuyucch1/yolov8_animeface/releases/download/v1/yolov8x6_animeface.pt"
PT_PATH = MODELS / "yolov8x6_animeface.pt"
ONNX_NAME = "yolov8x6_animeface.onnx"


def main():
    MODELS.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    if not PT_PATH.exists() or PT_PATH.stat().st_size < 1_000_000:
        print(f"Downloading {PT_URL} ...")
        urllib.request.urlretrieve(PT_URL, PT_PATH)
    print(f"PT: {PT_PATH} ({PT_PATH.stat().st_size / 1e6:.1f} MB)")

    from ultralytics import YOLO

    model = YOLO(str(PT_PATH))
    exported = model.export(format="onnx", imgsz=640, simplify=True, dynamic=False)
    exported = Path(exported)
    target = PUBLIC / ONNX_NAME
    # 也拷一份到 models/
    models_copy = MODELS / ONNX_NAME
    target.write_bytes(exported.read_bytes())
    models_copy.write_bytes(exported.read_bytes())
    print(f"ONNX → {target} ({target.stat().st_size / 1e6:.1f} MB)")
    print("Done. Vite 會從 /models/yolov8x6_animeface.onnx 提供模型。")


if __name__ == "__main__":
    main()

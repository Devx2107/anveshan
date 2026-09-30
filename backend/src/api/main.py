"""Local YOLO inference: uvicorn src.api.main:app --port 8000."""

from contextlib import asynccontextmanager
from io import BytesIO
import os
from pathlib import Path
from threading import Lock

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

CLASSES = {0: "marine_anomaly"}
ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 16_000_000


def load_model(path):
    from ultralytics import YOLO

    return YOLO(str(path))


def create_app(model_loader=load_model):
    @asynccontextmanager
    async def lifespan(app):
        path = Path(os.getenv("MODEL_PATH", str(ROOT / "models/weights/best.pt")))
        if not path.is_file():
            raise RuntimeError(
                f"Missing trained weights: {path}. Train and copy best.pt first."
            )
        model = model_loader(path)
        if model.names != CLASSES:
            raise RuntimeError(
                f"Model classes must be exactly {CLASSES}; got {model.names}"
            )
        app.state.model = model
        app.state.device = os.getenv("YOLO_DEVICE", "cpu")
        app.state.lock = Lock()
        yield
        app.state.model = None

    app = FastAPI(title="Anveshan inference", lifespan=lifespan)
    origins = [
        value.strip()
        for value in os.getenv("CORS_ORIGINS", "").split(",")
        if value.strip()
    ]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["POST", "GET"],
            allow_headers=["Content-Type"],
        )

    @app.get("/health")
    def health():
        return {"status": "ok", "classes": list(CLASSES.values())}

    @app.post("/detect")
    def detect(file: UploadFile = File(...)):
        """Infer on an already-preprocessed image; boxes use submitted-image pixels."""
        content = file.file.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise HTTPException(413, "Image exceeds 10 MiB")
        try:
            with Image.open(BytesIO(content)) as image:
                if image.format not in {"JPEG", "PNG"}:
                    raise HTTPException(415, "Use a PNG or JPEG image")
                width, height = image.size
                if width * height > MAX_PIXELS:
                    raise HTTPException(413, "Image exceeds 16 million pixels")
                # Ultralytics expects BGR arrays, including grayscale expanded to RGB.
                bgr = np.array(image.convert("RGB"))[:, :, ::-1].copy()
        except Image.DecompressionBombError:
            raise HTTPException(413, "Image is too large") from None
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(400, "Invalid or corrupt image") from None

        # Ultralytics predictors hold mutable state; serialize access to this model.
        with app.state.lock:
            result = app.state.model.predict(
                source=bgr,
                device=app.state.device,
                conf=0.25,
                iou=0.7,
                imgsz=640,
                max_det=300,
                verbose=False,
            )[0]
            detections = []
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(
                    {
                        "class": CLASSES[int(box.cls[0])],
                        "confidence": float(box.conf[0]),
                        "bbox": [x1, y1, x2 - x1, y2 - y1],
                    }
                )
        return {"detections": detections, "image": {"width": width, "height": height}}

    return app


app = create_app()

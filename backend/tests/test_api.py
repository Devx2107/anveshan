"""Contract tests without downloading model weights or requiring a GPU."""

import os
import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from backend.src.api.main import CLASSES, MAX_BYTES, create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        path = Path(self.tmp.name) / "best.pt"
        path.touch()
        env = patch.dict(
            os.environ,
            {"MODEL_PATH": str(path), "CORS_ORIGINS": "https://demo.vercel.app"},
        )
        env.start()
        self.addCleanup(env.stop)
        self.boxes = [
            SimpleNamespace(
                xyxy=np.array([[10, 20, 40, 60]]),
                conf=[0.82],
                cls=[0],
            )
        ]
        self.model = SimpleNamespace(names=CLASSES, predict=self.predict)
        self.client = self.enterContext(TestClient(create_app(lambda _: self.model)))

    def predict(self, **kwargs):
        self.assertEqual(kwargs["source"].shape, (80, 100, 3))
        return [SimpleNamespace(boxes=self.boxes)]

    def upload(self, content=None):
        if content is None:
            buffer = BytesIO()
            Image.new("L", (100, 80)).save(buffer, format="PNG")
            content = buffer.getvalue()
        return self.client.post(
            "/detect", files={"file": ("sonar.png", content, "image/png")}
        )

    def test_detection_contract(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "detections": [
                    {
                        "class": "marine_anomaly",
                        "confidence": 0.82,
                        "bbox": [10, 20, 30, 40],
                    }
                ],
                "image": {"width": 100, "height": 80},
            },
        )

    def test_empty_results(self):
        self.boxes = []
        self.assertEqual(self.upload().json()["detections"], [])

    def test_invalid_and_missing_image(self):
        self.assertEqual(self.upload(b"invalid").status_code, 400)
        self.assertEqual(self.client.post("/detect").status_code, 422)

    def test_oversized_upload(self):
        self.assertEqual(self.upload(b"x" * (MAX_BYTES + 1)).status_code, 413)

    def test_pixel_limit_and_unsupported_format(self):
        buffer = BytesIO()
        Image.new("L", (4001, 4000)).save(buffer, format="PNG")
        self.assertEqual(self.upload(buffer.getvalue()).status_code, 413)
        buffer = BytesIO()
        Image.new("L", (10, 10)).save(buffer, format="GIF")
        self.assertEqual(self.upload(buffer.getvalue()).status_code, 415)

    def test_health_and_cors(self):
        self.assertEqual(
            self.client.get("/health").json()["classes"], list(CLASSES.values())
        )
        response = self.client.options(
            "/detect",
            headers={
                "Origin": "https://demo.vercel.app",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertEqual(
            response.headers["access-control-allow-origin"], "https://demo.vercel.app"
        )

    def test_wrong_classes_fail_startup(self):
        model = SimpleNamespace(names={0: "0"})
        with self.assertRaisesRegex(RuntimeError, "Model classes must"), TestClient(create_app(lambda _: model)):
            pass

    def test_missing_weights_fail_startup(self):
        with patch.dict(
            os.environ, {"MODEL_PATH": str(Path(self.tmp.name) / "missing.pt")}
        ), self.assertRaisesRegex(RuntimeError, "Missing trained weights"), TestClient(create_app()):
            pass


if __name__ == "__main__":
    unittest.main()

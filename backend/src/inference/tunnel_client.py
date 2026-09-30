"""Tunnel API adapter for Anveshan detections."""

import cv2
import numpy as np
import requests


def predict(
    image: np.ndarray, api_url: str, confidence: int = 25, overlap: int = 30
) -> list[dict]:
    """Send a grayscale/BGR sonar image to the custom tunnel and return normalized API predictions."""
    if not api_url:
        raise ValueError("INFERENCE_API_URL is required.")

    success, encoded = cv2.imencode(".jpg", image)
    if not success:
        raise RuntimeError("Could not encode image for tunnel inference.")

    response = requests.post(
        api_url,
        params={"confidence": confidence, "overlap": overlap},
        files={"file": ("image.jpg", encoded.tobytes(), "image/jpeg")},
        timeout=20.0,
    )
    response.raise_for_status()

    out = []
    for p in response.json().get("predictions", []):
        x, y, w, h = float(p["x"]), float(p["y"]), float(p["width"]), float(p["height"])
        out.append(
            {
                "class": str(p["class"]),
                "confidence": float(p["confidence"]),
                "bbox": (x, y, w, h),
            }
        )
    return out

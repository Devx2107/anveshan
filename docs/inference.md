# Local model inference API

The API uses your own Ultralytics checkpoint with no Roboflow runtime dependency.
The repository also contains the Next.js/Vercel application. Its existing
`POST /api/process` route still uses demo fixtures by default and the Roboflow
adapter when demo mode is disabled. A teammate must repoint that server-side route
to this service before the Vercel app uses the locally trained model.

## Current public endpoint

The API is currently reachable at:

```text
https://save-demonstration-man-inkjet.trycloudflare.com
```

Health check: `GET https://save-demonstration-man-inkjet.trycloudflare.com/health`

This is a Cloudflare **Quick Tunnel** URL. It changes every time `cloudflared` is
stopped and restarted. If the frontend hardcodes this URL, detection will stop
working after a tunnel restart until the frontend configuration is updated. For a
stable URL, configure a persistent named Cloudflare Tunnel with a hostname you
control; otherwise send the teammate the newly printed Quick Tunnel URL each time.

## Render deployment

The repository includes a Render Blueprint in `render.yaml` and a separate
CPU-only dependency list in `requirements-render.txt`. The service uses the
actual application module, `src.api.main:app`, and its `/health` readiness check.
The Blueprint selects Render's paid Starter instance because a PyTorch + YOLO
process and model need more memory than the Free instance's 512 MB; the Free
instance is not a reliable deployment target for this API.

Before creating the service, add the trained checkpoint to Git and push it. It is
currently ignored by the repository, and the API exits on startup without it:

```powershell
git add -f models/weights/best.pt
git add render.yaml requirements-render.txt docs/inference.md
git commit -m "Configure Render inference service"
git push
```

In Render, choose **New → Blueprint** and select this repository. Review the
Starter instance and deploy the `anveshan-inference` service. Alternatively,
create a Web Service manually with root directory `.`, build command
`pip install -r requirements-render.txt`, start command
`uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`, and health check path
`/health`. Python 3.11 is recommended. The `requirements-render.txt` file installs
CPU PyTorch, TorchVision, and the API dependencies; it does not use the CUDA
workstation environment or the broader development `requirements.txt`.

After deployment, test `https://<your-render-service>.onrender.com/health` and
then POST a preprocessed PNG/JPEG to `/detect`. The free web service sleeps after
inactivity and may not have enough memory for this workload. Render's paid
Starter service avoids the free service's sleep behavior, but verify actual
startup memory and inference latency from the deployment logs. Set
`ANVESHAN_INFERENCE_URL` in the Vercel project to the Render base URL only after
the endpoint passes both checks; the Vercel route currently still uses demo or
Roboflow behavior and is not yet wired to this service.

## Train and run locally

### Windows quick-tunnel launchers

The repository includes two PowerShell launchers. One-time environment setup:

```powershell
py -3.11 -m venv .venv-inference
.\.venv-inference\Scripts\python.exe -m pip install --upgrade pip
.\.venv-inference\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
.\.venv-inference\Scripts\python.exe -m pip install -r requirements-api.txt
```

After training, put `best.pt` in `models/weights/`, then run these in separate
terminals from the repository root:

```powershell
# Terminal 1: RTX 3060 inference; omit CorsOrigins for server-to-server requests.
.\scripts\start-api.ps1 -Device 0 -CorsOrigins "https://your-app.vercel.app"
# Terminal 2: checks local readiness before exposing the API.
.\scripts\start-tunnel.ps1
```

Use `-Device cpu` if CUDA PyTorch is not installed, or `-ModelPath` to select a
checkpoint elsewhere. The tunnel launcher uses `.tools/cloudflared.exe` if present,
otherwise `cloudflared` from PATH. Stop both terminals with Ctrl+C. The public URL
can change on restart; update the frontend base URL accordingly. No account or
domain is required for a quick tunnel.

This workstation has portable cloudflared 2026.9.3 installed in the local
`.tools/` directory. On another machine, install it from Cloudflare's official
downloads page or use `winget install --id Cloudflare.cloudflared --exact`.

Use Python 3.11 and a PyTorch installation appropriate for your CUDA driver when
training on the RTX 3060. Install `requirements-api.txt` in that environment.
Before training, verify `models/train_configs/data.yaml` resolves to your exported
dataset. The current time-boxed scope is one class: 0 = marine_anomaly. The export
was verified as 64 training, 18 validation, and 10 test label files, all containing
only class ID 0. The finer three-class breakdown is deferred until after the MVP.

```powershell
yolo detect train data=models/train_configs/data.yaml model=yolov8n.pt epochs=50 imgsz=640 batch=16 device=0 project=runs/detect name=train
Copy-Item runs/detect/train/weights/best.pt models/weights/best.pt
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

If Ultralytics creates `train2` or another run directory, copy from the actual run.
The service loads weights once at startup and refuses missing weights or a class
mapping other than `{0: "marine_anomaly"}`. Restart after replacing weights.
`MODEL_PATH` overrides the checkpoint path. `YOLO_DEVICE` defaults to `cpu`; set
`$env:YOLO_DEVICE="0"` before launch to use your CUDA GPU. Use one server worker.

## Endpoint contract

- `GET /health`: readiness and supported classes; `/docs`: interactive API docs.
- `POST /detect`: multipart form-data with one field named `file`. The field value
  must be a PNG or JPEG image, up to 10 MiB and 16 million pixels.
- Input is the **already-preprocessed image** previously passed to the detector.
  No sonar preprocessing or confidence refinement is repeated by this service.
- Output boxes are `[left, top, width, height]` in submitted-image pixels, with
  confidence in 0–1. An image with no detections returns an empty list.

Example request against the current public tunnel:

```powershell
curl.exe -F "file=@preprocessed.png" `
  https://save-demonstration-man-inkjet.trycloudflare.com/detect
```

Successful response:

```json
{
  "detections": [
    {
      "class": "marine_anomaly",
      "confidence": 0.82,
      "bbox": [10, 20, 30, 40]
    }
  ],
  "image": {
    "width": 640,
    "height": 640
  }
}
```

The `image` object is also returned so the caller can interpret pixel coordinates.
When no object passes the YOLO threshold, `detections` is `[]`.

Pass `detections` and the same preprocessed image to the existing
`refine_detections` function, then use the existing geotagging/report pipeline.
YOLO uses confidence 0.25, IoU 0.7, image size 640 and max 300 detections, matching
the current dashboard's standard prediction defaults. Report fields are unchanged.
Invalid image data returns 400, oversized images 413, unsupported formats 415,
and a missing upload 422. Model runtime failures return 500.

```powershell
curl.exe -F "file=@preprocessed.png" http://127.0.0.1:8000/detect
cloudflared tunnel --url http://localhost:8000
```

Install `cloudflared` first. The quick tunnel prints a temporary public HTTPS URL;
both the tunnel and API must stay running. Quick tunnels are for testing/demo use.
The endpoint is public and unauthenticated when exposed.

## Vercel integration

Keep the browser calling the existing same-origin `POST /api/process` route. In
`api/index.py`, replace the Roboflow `predict(...)` call with a server-to-server
multipart request to `${ANVESHAN_INFERENCE_URL}/detect`, where the current value is
the tunnel base URL above. Send the preprocessed image in a form field named `file`,
read the response's `detections` array, then preserve the existing confidence filter,
geotagging, and report generation. This contract already returns top-left
`[left, top, width, height]` boxes, so do not apply the Roboflow center-coordinate
conversion. Server-to-server calls do not need CORS.

```javascript
// Browser behavior remains unchanged:
const body = new FormData();
body.append("file", selectedImage, selectedImage.name);
const response = await fetch("/api/process", { method: "POST", body });
```

Do not expose the tunnel base URL as a browser-side secret or hardcode it into the
React page. Configure it as the server-side `ANVESHAN_INFERENCE_URL` environment
variable in Vercel. Because this is a Quick Tunnel, that value must be updated and
the affected deployment restarted whenever `cloudflared` produces a new URL.

## Docker / Hugging Face Spaces

Hugging Face currently documents that creating a compute Space (Docker or Gradio)
requires a paid plan. CPU Basic has no hourly hardware cost but sleeps when idle;
do not assume this is free account creation plus permanent always-on hosting.
Check account eligibility before choosing this deployment.

Create a Docker Space, copy `Dockerfile`, `requirements-api.txt`, `src/`, and your
checkpoint at `models/weights/best.pt` to its repository. Weights are ignored by this
project's Git config, so upload the checkpoint explicitly to the Space. Use this
metadata in the **Space's** README (not this project's README):

```yaml
---
title: Anveshan Inference
sdk: docker
app_port: 7860
---
```

The Docker image uses CPU PyTorch and listens on port 7860. Configure
`CORS_ORIGINS` in Space variables if needed. After build/startup, check `/health`
and an actual image through `/detect` before changing the frontend base URL.
Cold starts and CPU inference may take longer; test the frontend's request timeout.

Local Docker check: `docker build -t anveshan-api .`, then
`docker run --rm -p 7860:7860 anveshan-api` (requires the trained checkpoint).

## Verification

Install `fastapi python-multipart pillow numpy httpx` to run the contract tests:
`python -m unittest discover -s tests -v`. They use an injected fake model and do
not measure model accuracy or validate a real checkpoint. After training, compare
API results with local YOLO on the same preprocessed image and check positive and
no-detection images through the existing report flow.

References:
- https://huggingface.co/docs/hub/spaces-overview
- https://huggingface.co/docs/hub/spaces-sdks-docker
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/

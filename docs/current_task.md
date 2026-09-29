# Current Task Tracker

This file tracks the current deployment state and immediate handoff work.

## Current status

- **Sprint:** 7-day Marine Debris SSS Detection MVP
- **Status:** Single-class inference API running locally and publicly reachable through Cloudflare Tunnel
- **Current phase:** Final integration and deployment handoff
- **Active task:** Connect the repository's Vercel backend route to the live `/detect` endpoint
- **Last updated:** 2026-09-29

## Next action

- [ ] Repoint `api/index.py` from Roboflow to the local model's `/detect` endpoint and verify the complete Next.js flow.
- [ ] Replace or communicate the frontend API base URL whenever the Quick Tunnel restarts, or configure a persistent named tunnel.
- [ ] Run the final frontend-to-model smoke test before the Vercel deployment.

Earlier dataset/domain tasks (retained until their completion is verified):

- [ ] Inspect 20–30 real side-scan sonar images.
- [ ] Write at least five domain notes covering the nadir gap, acoustic shadows, speckle noise, seabed clutter, and debris appearance.
- [ ] Save the notes to `reports/domain_notes.md`.

## Recently completed

- Installed portable `cloudflared` 2026.9.3 in the local `.tools/` directory.
- Installed API dependencies in `.venv-inference/`, including CUDA PyTorch 2.14.0+cu126 and Ultralytics 8.4.165. Verified CUDA availability, RTX 3060 identification, and a GPU tensor computation.
- Added `scripts/start-api.ps1` and `scripts/start-tunnel.ps1`; the tunnel checks local readiness before publishing.
- Trained and loaded `models/weights/best.pt`; verified its class mapping is `{0: marine_anomaly}`.
- Started the local API and Cloudflare Quick Tunnel at `https://save-demonstration-man-inkjet.trycloudflare.com`.
- Verified `/health` and a real multipart `/detect` request through the public tunnel.

## Blockers and decisions

- The Next.js/Vercel app is present. Its `/api/process` route still uses demo fixtures by default and Roboflow when demo mode is disabled; the local endpoint handoff remains to be integrated.
- Hosting choice: local RTX 3060 plus a Cloudflare quick tunnel. No Hugging Face or Roboflow hosting required.
- The current public URL is temporary and changes whenever the Quick Tunnel restarts.
- Time-boxed MVP class scope: one class, `marine_anomaly`. The exported dataset is single-class (`nc: 1`); the finer class breakdown is deferred.
- The FastAPI `/detect` service is the selected boundary for the external frontend.
- Navigation metadata is simulated unless real image-linked navigation data becomes available.

## Inference update — 2026-09-29

- Added a standalone FastAPI `/detect` service using locally trained Ultralytics weights, with no Roboflow runtime calls.
- Updated training and serving contracts to the confirmed single class `{0: marine_anomaly}`. Verified every exported train/validation/test label uses class ID 0.
- Local server plus Cloudflare quick tunnel is the immediate deployment route; Docker support is included for eligible Hugging Face Spaces accounts.
- Next.js UI, confidence-filter logic, geotagging, and report format remain unchanged.
- Local model serving is live; connecting and testing the Vercel backend route remains pending.
- See [inference setup and endpoint contract](inference.md).

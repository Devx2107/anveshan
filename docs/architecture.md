# Architecture

The system uses a Next.js frontend and a FastAPI backend with a local model for inference.

```text
User
  |
  v
Frontend (Next.js Dashboard)
  |
  v
Backend API (FastAPI)
  |
  +----> [1] Preprocessing (clean_sonar.py)
  |
  v
Local PC Inference Tunnel
  |
  +----> [2] Detection
  |
  v
Backend API (FastAPI)
  |
  +----> [3] Confidence filtering (confidence_filter.py)
  +----> [4] Geotagging & report (report_generator.py)
  |
  v
Frontend (Dashboard Map & Export)
```

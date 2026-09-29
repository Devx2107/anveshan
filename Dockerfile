FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 appuser
WORKDIR /app
COPY requirements-api.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements-api.txt
COPY --chown=appuser:appuser src /app/src
COPY --chown=appuser:appuser models/weights/best.pt /app/models/weights/best.pt
USER appuser
ENV YOLO_DEVICE=cpu YOLO_CONFIG_DIR=/home/appuser/.config/Ultralytics
EXPOSE 7860
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "7860"]

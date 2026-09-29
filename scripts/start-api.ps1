param(
    [string]$ModelPath = "models/weights/best.pt",
    [string]$Device = "0",
    [string]$CorsOrigins = "",
    [int]$Port = 8000
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot
try {
    if (-not (Test-Path -LiteralPath $ModelPath -PathType Leaf)) {
        throw "Missing checkpoint: $ModelPath. Copy your trained best.pt to models/weights/best.pt or pass -ModelPath."
    }
    $python = Join-Path $repoRoot ".venv-inference/Scripts/python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        throw "Create the environment first: py -3.11 -m venv .venv-inference. See docs/inference.md for installation commands."
    }
    $env:MODEL_PATH = (Resolve-Path -LiteralPath $ModelPath).Path
    $env:YOLO_DEVICE = $Device
    $env:CORS_ORIGINS = $CorsOrigins
    & $python -m uvicorn src.api.main:app --host 127.0.0.1 --port $Port
    if ($LASTEXITCODE -ne 0) { throw "API exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}

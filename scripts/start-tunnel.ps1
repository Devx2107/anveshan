param([int]$Port = 8000)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$cloudflared = Join-Path $repoRoot ".tools/cloudflared.exe"
if (-not (Test-Path -LiteralPath $cloudflared)) {
    $command = Get-Command cloudflared -ErrorAction SilentlyContinue
    if (-not $command) { throw "Install cloudflared first: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/" }
    $cloudflared = $command.Source
}
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
if ($health.status -ne "ok" -or ($health.classes -join ',') -ne 'marine_anomaly') {
    throw "The expected Anveshan API is not ready on port $Port. Start scripts/start-api.ps1 first."
}
Write-Host "Publishing the local inference API. Keep this terminal and the API terminal running."
Write-Host "Use the printed https://...trycloudflare.com URL as the frontend API base URL. Ctrl+C stops the tunnel."
& $cloudflared tunnel --url "http://127.0.0.1:$Port"
if ($LASTEXITCODE -ne 0) { throw "Tunnel exited with code $LASTEXITCODE" }

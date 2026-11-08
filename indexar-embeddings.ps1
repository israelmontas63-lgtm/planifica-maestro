# indexar-embeddings.ps1
# Ejecuta la indexación de embeddings por lotes vía POST /api/owner/indexar-embeddings
# Uso: .\indexar-embeddings.ps1 [-OwnerKey "TU_CLAVE"] [-WorkerUrl "https://..."]

param(
    [string]$WorkerUrl = "https://planifica-maestro.israelmontas65.workers.dev",
    [string]$OwnerKey = $env:OWNER_MASTER_KEY
)

if (-not $OwnerKey) {
    Write-Error "Falta OwnerKey. Pásalo con -OwnerKey o define la variable de entorno OWNER_MASTER_KEY."
    exit 1
}

Write-Host "Iniciando indexación de embeddings por lotes contra $WorkerUrl..." -ForegroundColor Cyan

do {
    $r = Invoke-RestMethod -Uri "$WorkerUrl/api/owner/indexar-embeddings" -Method Post -Headers @{ "x-owner-key" = $OwnerKey }
    $jsonRes = $r | ConvertTo-Json -Compress
    Write-Host "Lote procesado: $jsonRes"
    Start-Sleep -Seconds 1
} while ($r.ok -eq $true -and $r.indexadas -gt 0)

Write-Host "Indexación completada exitosamente. Se han indexado todas las filas pendientes (indexadas = 0)." -ForegroundColor Green

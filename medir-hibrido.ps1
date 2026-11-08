# medir-hibrido.ps1
# Mide scores del motor híbrido para 10 consultas curriculares oficiales (5 existentes, 5 inexistentes)
# Uso: .\medir-hibrido.ps1 [-OwnerKey "TU_CLAVE"] [-WorkerUrl "https://..."]

param(
    [string]$WorkerUrl = "https://planifica-maestro.israelmontas65.workers.dev",
    [string]$OwnerKey = $env:OWNER_MASTER_KEY
)

if (-not $OwnerKey) {
    Write-Error "Falta OwnerKey. Pásalo con -OwnerKey o define la variable de entorno OWNER_MASTER_KEY."
    exit 1
}

$headers = @{ "x-owner-key" = $OwnerKey }

$consultas = @(
    # 5 que SÍ existen
    @{ q = "La noticia"; grado = 2; area = "Lengua Española"; tipo = "SI" },
    @{ q = "Estimación y redondeo"; grado = 1; area = "Matemática"; tipo = "SI" },
    @{ q = "Hábitats de los seres vivos"; grado = 2; area = "Ciencias de la Naturaleza"; tipo = "SI" },
    @{ q = "La familia, la escuela y la comunidad"; grado = 1; area = "Ciencias Sociales"; tipo = "SI" },
    @{ q = "Los símbolos patrios"; grado = 2; area = "Ciencias Sociales"; tipo = "SI" },

    # 5 que NO existen
    @{ q = "la familia"; grado = 2; area = "Ciencias Sociales"; tipo = "NO" },
    @{ q = "Ecuaciones cuadráticas"; grado = 1; area = "Matemática"; tipo = "NO" },
    @{ q = "Termodinámica cuántica"; grado = 2; area = "Ciencias de la Naturaleza"; tipo = "NO" },
    @{ q = "El cuerpo y el movimiento"; grado = 1; area = "Educación Física"; tipo = "NO" },
    @{ q = "Programación orientada a objetos"; grado = 2; area = "Ciencias Sociales"; tipo = "NO" }
)

Write-Host "Midiendo scores con el motor híbrido (Umbral: 0.017)...`n" -ForegroundColor Cyan

$(foreach ($c in $consultas) {
    $qEnc = [System.Uri]::EscapeDataString($c.q)
    $aEnc = [System.Uri]::EscapeDataString($c.area)
    $url = "$WorkerUrl/api/owner/probar-hibrido?q=$qEnc&grado=$($c.grado)&area=$aEnc"
    $res = Invoke-RestMethod -Uri $url -Method Get -Headers $headers

    [PSCustomObject]@{
        Esperado = $c.tipo
        Tema     = $c.q
        Grado    = "$($c.grado).°"
        Area     = $c.area
        TopScore = if ($res.hits -and $res.hits.Count -gt 0) { [math]::Round($res.hits[0].score, 5) } else { "Sin hits" }
        Pasa     = if ($res.hits -and $res.hits.Count -gt 0) { $res.hits[0].pasa } else { $false }
    }
}) | Format-Table -AutoSize

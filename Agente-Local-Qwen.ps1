param(
    [string]$Proyecto = (Get-Location).Path,
    [string]$Modelo = 'qwen2.5-coder:7b'
)

$ErrorActionPreference = 'Stop'

function Find-CommandPath {
    param([string]$Name, [string[]]$Candidates)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    foreach ($candidate in $Candidates) {
        $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
        if (Test-Path -LiteralPath $expanded) { return $expanded }
    }

    return $null
}

$ollama = Find-CommandPath 'ollama' @(
    '%LOCALAPPDATA%\Programs\Ollama\ollama.exe',
    '%LOCALAPPDATA%\Ollama\ollama.exe'
)
$codex = Find-CommandPath 'codex' @(
    '%USERPROFILE%\.codex\.sandbox-bin\codex.exe',
    '%USERPROFILE%\.codex\plugins\.plugin-appserver\codex.exe'
)

if (-not $ollama) {
    throw 'Ollama no esta instalado. Ejecuta primero Instalar-Agente-Local.ps1.'
}
if (-not $codex) {
    throw 'No se encontro Codex CLI en este equipo.'
}
if (-not (Test-Path -LiteralPath $Proyecto -PathType Container)) {
    throw "La carpeta del proyecto no existe: $Proyecto"
}

$agentsFile = Join-Path $Proyecto 'AGENTS.md'
if (-not (Test-Path -LiteralPath $agentsFile)) {
    throw "No se encontro AGENTS.md en el proyecto: $agentsFile"
}

$modelNames = & $ollama list 2>$null | Out-String
if ($modelNames -notmatch [regex]::Escape($Modelo)) {
    Write-Host "Descargando $Modelo por primera vez..." -ForegroundColor Cyan
    & $ollama pull $Modelo
    if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar $Modelo." }
}

$PromptInicial = @'
Lee primero el archivo AGENTS.md de este proyecto y adopta ese rol durante toda la sesion.

Tu identidad de trabajo NO es la de un asistente generico: eres el agente tecnico local experto en Aguila Inventario Pro.
Debes responder en espanol claro, pensar como promotor de campo en piso de ventas y cuidar entradas, rellenos, auditorias, inventario, bodegas, lotes, Firebase, PWA, service worker, modo oscuro y datos.

No publiques, no cambies Firebase, no cambies reglas de base de datos, no hagas deploy y no toques sistemas externos sin permiso explicito del usuario.

Primero confirma brevemente que cargaste el rol de Aguila Inventario Pro. Despues espera la tarea del usuario.
'@

Write-Host ''
Write-Host 'Aguila Local esta listo.' -ForegroundColor Green
Write-Host "Proyecto: $Proyecto"
Write-Host "Modelo:   $Modelo"
Write-Host 'Los comandos y cambios de archivos pediran aprobacion cuando corresponda.'
Write-Host 'El agente arrancara leyendo AGENTS.md para tomar el rol de experto en Aguila Inventario Pro.'
Write-Host ''

& $codex `
    --oss `
    --local-provider ollama `
    --model $Modelo `
    --cd $Proyecto `
    --sandbox workspace-write `
    --ask-for-approval on-request `
    --no-alt-screen `
    $PromptInicial

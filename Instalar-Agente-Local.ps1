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

Write-Host 'Instalando Ollama con el instalador oficial por PowerShell...' -ForegroundColor Cyan
Write-Host 'Fuente oficial: https://ollama.com/install.ps1' -ForegroundColor DarkGray

Invoke-Expression (Invoke-RestMethod 'https://ollama.com/install.ps1')

$ollama = Find-CommandPath 'ollama' @(
    '%LOCALAPPDATA%\Programs\Ollama\ollama.exe',
    '%LOCALAPPDATA%\Ollama\ollama.exe'
)

if (-not $ollama) {
    throw 'Ollama se instaló, pero esta terminal aún no encuentra ollama.exe. Cierra PowerShell, vuelve a abrirlo y ejecuta este script otra vez.'
}

Write-Host 'Descargando Qwen2.5-Coder 7B (aprox. 4.7 GB)...' -ForegroundColor Cyan
& $ollama pull qwen2.5-coder:7b
if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar Qwen2.5-Coder 7B.' }

Write-Host ''
Write-Host 'Instalación terminada.' -ForegroundColor Green
Write-Host 'Para trabajar sin cuota, ejecuta:'
Write-Host 'powershell -ExecutionPolicy Bypass -File .\Agente-Local-Qwen.ps1' -ForegroundColor Yellow

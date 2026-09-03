$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$preflight = Join-Path $repoRoot 'tests/qa-emulator-preflight.mjs'

Write-Output '== PREFLIGHT =='
& node $preflight
if ($LASTEXITCODE -ne 0) {
    Write-Output 'LOCAL_ACTION_REQUIRED'
    Write-Output 'El preflight no está completo. No se ejecutan escrituras, restore ni stress funcional.'
    Write-Output 'Continuación: powershell -ExecutionPolicy Bypass -File scripts/start-qa-emulator.ps1'
    exit 2
}

function Test-TcpPort([string] $hostName, [int] $port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try { $task = $client.ConnectAsync($hostName, $port); if (-not $task.Wait(1500)) { return $false }; return $client.Connected } catch { return $false } finally { $client.Dispose() }
}

Write-Output '== EMULATOR CONNECTIVITY =='
$authOnline = Test-TcpPort '127.0.0.1' 9099
$databaseOnline = Test-TcpPort '127.0.0.1' 9000
$uiOnline = Test-TcpPort '127.0.0.1' 4000
if (-not ($authOnline -and $databaseOnline -and $uiOnline)) {
    Write-Output "AUTH: $authOnline"
    Write-Output "DATABASE: $databaseOnline"
    Write-Output "UI: $uiOnline"
    Write-Output 'LOCAL_ACTION_REQUIRED'
    Write-Output 'Inicia el Emulator con: powershell -ExecutionPolicy Bypass -File scripts/start-qa-emulator.ps1'
    exit 2
}
Write-Output 'EMULATOR_CONNECTIVITY_PASS'

$required = @('qa-restore.mjs', 'qa-write-harness.mjs', 'qa-99922-baseline.json')
$fixtureCandidates = @('qa-fixture-99922.json', 'qa-99922-fixture.json', 'qa-fixture.json', 'tests/fixtures/qa-99922.json', 'tests/fixtures/qa-fixture-99922.json', 'tests/fixtures/qa-fixture.json')
$missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $repoRoot $_)) })
if (-not ($fixtureCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $repoRoot $_) })) { $missing += 'QA fixture (known candidate paths)' }
if ($missing.Count -gt 0) {
    Write-Output "MISSING_QA_ARTIFACTS: $($missing -join ', ')"
    Write-Output 'LOCAL_ACTION_REQUIRED'
    Write-Output 'No se simulan guards, hashes ni restore: recupera los artefactos QA existentes y vuelve a ejecutar.'
    Write-Output 'Continuación: powershell -ExecutionPolicy Bypass -File scripts/validate-qa-environment.ps1'
    exit 2
}

Write-Output 'QA artifacts detected, but their execution contract is not available in this checkout.'
Write-Output 'LOCAL_ACTION_REQUIRED'
Write-Output 'Define/verifica las operaciones probe, restore y hash de qa-restore.mjs antes de ejecutar escrituras QA.'
Write-Output 'No se ejecutó stress funcional ni se declararon marcadores PASS sin evidencia.'
exit 2

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

foreach ($required in @('firebase.json', '.firebaserc', 'tests/qa-emulator-preflight.mjs')) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $required))) { throw "Repositorio incompleto: falta $required" }
}

& node (Join-Path $repoRoot 'tests/qa-emulator-preflight.mjs')
if ($LASTEXITCODE -ne 0) {
    Write-Output 'LOCAL_ACTION_REQUIRED'
    Write-Output 'Completa las dependencias o artefactos QA reportados por el preflight y vuelve a ejecutar este comando.'
    exit 2
}

$projectId = if ($env:QA_FIREBASE_PROJECT_ID) { $env:QA_FIREBASE_PROJECT_ID } else { 'demo-aguila-qa' }
if ($projectId -notmatch '^demo-[a-z0-9-]+$') { throw "QA_FIREBASE_PROJECT_ID debe ser demo-* para impedir producción: $projectId" }
$firebaseCommand = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCommand) { Write-Output 'LOCAL_ACTION_REQUIRED'; Write-Output 'Firebase CLI no está disponible.'; exit 2 }

Write-Output 'QA EMULATOR ACTIVE'
Write-Output 'AUTH HOST: 127.0.0.1:9099'
Write-Output 'DATABASE HOST: 127.0.0.1:9000'
Write-Output 'UI HOST: http://127.0.0.1:4000'
Write-Output "QA PROJECT: $projectId"
Write-Output 'PRODUCTION ACCESS: DISABLED (demo-* project only)'
& $firebaseCommand.Source emulators:start --only auth,database,ui --project $projectId
exit $LASTEXITCODE

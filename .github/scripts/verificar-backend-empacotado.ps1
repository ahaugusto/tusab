# Copyright (c) 2026 CriAugu - CNPJ 65.131.075/0001-57
#
# Trava do invariante 24 (agents\_historia.md): sobe o backend a partir da
# pasta resources de um app Windows EMPACOTADO - do jeito que electron\main.js
# faz (python_env\python.exe -X utf8 app\api_tusab.py, cwd app\, bin\ no PATH)
# - e so passa se GET /status responder 200. Falha o job se faltar python_env,
# bin\yt-dlp.exe ou se o backend nao subir. O aviso "file source doesn't exist"
# do electron-builder nao para o build; isto para.
#
# Uso:  powershell -ExecutionPolicy Bypass -File .github\scripts\verificar-backend-empacotado.ps1 `
#         -Resources dist_electron\win-unpacked\resources
#       Tambem serve para um app instalado: -Resources "$env:LOCALAPPDATA\Programs\tusab\resources"

param(
  [Parameter(Mandatory = $true)][string]$Resources,
  [int]$Porta = 8001,
  [int]$TimeoutSeg = 120
)

$ErrorActionPreference = 'Stop'
$Resources = (Resolve-Path $Resources).Path
$py  = Join-Path $Resources 'python_env\python.exe'
$yt  = Join-Path $Resources 'bin\yt-dlp.exe'
$app = Join-Path $Resources 'app'
$api = Join-Path $app 'api_tusab.py'

foreach ($f in @($py, $yt, $api)) {
  if (-not (Test-Path $f)) { throw "Ausente no pacote: $f" }
}
& $yt --version
if ($LASTEXITCODE -ne 0) { throw 'bin\yt-dlp.exe nao executa' }

$ocupada = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
if ($ocupada) { throw "Porta $Porta ja esta em uso (PID $($ocupada.OwningProcess)) - o teste nao provaria nada" }

$dados = Join-Path ([IO.Path]::GetTempPath()) ("tusab-backend-smoke-" + $PID)
New-Item -ItemType Directory -Force -Path $dados | Out-Null
$env:TUSAB_DATA_DIR   = $dados
$env:PYTHONUNBUFFERED = '1'
$env:ELECTRON_RUN     = '1'
$env:PATH             = (Join-Path $Resources 'bin') + ';' + $env:PATH

$saida = Join-Path $dados 'stdout.txt'
$erros = Join-Path $dados 'stderr.txt'
$proc = Start-Process -FilePath $py -ArgumentList @('-X', 'utf8', "`"$api`"") -WorkingDirectory $app `
  -PassThru -NoNewWindow -RedirectStandardOutput $saida -RedirectStandardError $erros

try {
  $ok = $false
  $limite = (Get-Date).AddSeconds($TimeoutSeg)
  while ((Get-Date) -lt $limite -and -not $proc.HasExited) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Porta/status" -TimeoutSec 3
      if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
  }
  if (-not $ok) {
    Write-Host '--- ultimas linhas do stderr do backend ---'
    if (Test-Path $erros) { Get-Content $erros -Tail 40 }
    throw "Backend empacotado nao respondeu /status em ${TimeoutSeg}s (processo encerrado: $($proc.HasExited))"
  }
  Write-Host "OK: backend empacotado respondeu GET /status 200 ($Resources)"
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}

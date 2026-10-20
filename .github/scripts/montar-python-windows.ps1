# Copyright (c) 2026 CriAugu - CNPJ 65.131.075/0001-57
#
# Monta o Python embutido do instalador Windows (electron\python_env) e a
# pasta electron\bin (yt-dlp.exe). As duas estao no .gitignore: quem builda
# o Windows TEM que criar as duas antes do electron-builder, senao o .exe sai
# sem backend - foi o que aconteceu da v1.0.42 a v1.0.57 (invariante 24 em
# agents\_historia.md). Mesmo script no CI (release.yml, job build-windows)
# e na maquina local, para o teste local valer pelo CI.
#
# Montagem de referencia (Documentacao do Produto\Empacotamento e
# Distribuicao.md): Python 3.12 embeddable 64-bit (a 3.14 embeddable quebra a
# stdlib no Windows), python312._pth com "import site" e gravado em UTF-8 SEM
# BOM (com BOM o primeiro caminho corrompe e da "No module named encodings"),
# pip por cima e os pacotes de requirements.txt.
#
# Uso:  powershell -ExecutionPolicy Bypass -File .github\scripts\montar-python-windows.ps1
#       [-PyDir <destino>] [-BinDir <destino>]   (padrao: electron\python_env e electron\bin)

param(
  [string]$Raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$PyDir = '',
  [string]$BinDir = '',
  [string]$PythonVersao = '3.12.10'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # a barra do Invoke-WebRequest deixa o download muito lento
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $PyDir)  { $PyDir  = Join-Path $Raiz 'electron\python_env' }
if (-not $BinDir) { $BinDir = Join-Path $Raiz 'electron\bin' }
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("tusab-pyenv-" + $PID)
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

Write-Host "== Python $PythonVersao embeddable -> $PyDir"
if (Test-Path $PyDir) { Remove-Item -Recurse -Force $PyDir }
New-Item -ItemType Directory -Force -Path $PyDir, $BinDir | Out-Null

$zip = Join-Path $Tmp 'python-embed.zip'
Invoke-WebRequest -UseBasicParsing -Uri "https://www.python.org/ftp/python/$PythonVersao/python-$PythonVersao-embed-amd64.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $PyDir -Force

$partes = $PythonVersao.Split('.')
$tag = 'python' + $partes[0] + $partes[1]          # ex.: python312
$pth = Join-Path $PyDir ($tag + '._pth')
$conteudoPth = "$tag.zip`r`n.`r`n`r`nimport site`r`n"
[IO.File]::WriteAllText($pth, $conteudoPth, (New-Object Text.UTF8Encoding $false))

$py = Join-Path $PyDir 'python.exe'
$getpip = Join-Path $Tmp 'get-pip.py'
Invoke-WebRequest -UseBasicParsing -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getpip
& $py $getpip --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw 'get-pip.py falhou' }

Write-Host '== pip install -r requirements.txt'
& $py -m pip install --no-warn-script-location --disable-pip-version-check -r (Join-Path $Raiz 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'pip install -r requirements.txt falhou' }

# Tira o que o app nunca usa em execucao (pip, suites de teste das libs,
# catalogos de API do Google alem do Drive...). Ver o cabecalho do script.
# Roda ANTES da verificacao abaixo, que entao valida o ambiente ja enxugado.
& $py (Join-Path $Raiz '.github\scripts\enxugar_python_env.py') (Join-Path $PyDir 'Lib\site-packages')
if ($LASTEXITCODE -ne 0) { throw 'enxugar_python_env.py falhou' }

Write-Host "== yt-dlp.exe -> $BinDir"
$yt = Join-Path $BinDir 'yt-dlp.exe'
Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile $yt

# Verificacao minima ja na origem: se o Python montado nao importa o backend,
# nem adianta chamar o electron-builder.
Write-Host '== Verificando o Python montado'
& $py -X utf8 -c "import fastapi, uvicorn, lancedb, rank_bm25, pdfplumber, trafilatura, psutil, openpyxl, docx, yt_dlp, rapidocr_onnxruntime; print('imports do backend: ok')"
if ($LASTEXITCODE -ne 0) { throw 'O Python montado nao importa as dependencias do backend' }
& $py -c "import importlib.util as u; pesados=[m for m in ('torch','sentence_transformers','keybert','sklearn') if u.find_spec(m)]; print('stack pesada presente:', pesados); raise SystemExit(1 if pesados else 0)"
if ($LASTEXITCODE -ne 0) { throw 'Stack semantica pesada entrou no Python do instalador (invariante 15)' }
& $yt --version
if ($LASTEXITCODE -ne 0) { throw 'yt-dlp.exe nao executa' }

$tamanho = (Get-ChildItem -Recurse -File $PyDir | Measure-Object -Sum Length).Sum / 1MB
Write-Host ("== Pronto: python_env com {0:N0} MB" -f $tamanho)
Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue

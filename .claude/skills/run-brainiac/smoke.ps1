# Tusab smoke driver
# Versionamento semantico: -Suite full|patch|minor|major
# full   = todos os 15 checks (pre-commit padrao)
# patch  = apenas engine + yt-dlp (correcoes pontuais, sem tocar em features)
# minor  = patch + agent + queue (novas features/endpoints)
# major  = tudo (full alias -- para releases)
#
# Uso:
#   smoke.ps1                    -> full (padrao do pre-commit)
#   smoke.ps1 -Suite patch       -> engine + yt-dlp apenas
#   smoke.ps1 -Suite minor       -> patch + agent + queue
#   smoke.ps1 -KeepAlive         -> nao derruba o backend apos rodar

param(
    [ValidateSet('full','patch','minor','major')]
    [string]$Suite = 'full',
    [switch]$KeepAlive
)

$ROOT = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$VENV = Join-Path $ROOT ".venv\Scripts\python.exe"
$API  = "http://127.0.0.1:8001"
$script:PASS = 0
$script:FAIL = 0
$PROC = $null

function ok      ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:PASS++ }
function fail    ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:FAIL++ }
function info    ($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Cyan }
function section ($msg) { Write-Host ""; Write-Host "--- $msg ---" -ForegroundColor White }

function Fetch($method, $path, $body = $null) {
    $req = [System.Net.HttpWebRequest]::Create("$API$path")
    $req.Method  = $method
    $req.Timeout = 20000
    if ($body) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $req.ContentType   = "application/json; charset=utf-8"
        $req.ContentLength = $bytes.Length
        $s = $req.GetRequestStream()
        $s.Write($bytes, 0, $bytes.Length)
        $s.Close()
    }
    try {
        $resp   = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
        return @{ status = [int]$resp.StatusCode; body = $reader.ReadToEnd() }
    } catch [System.Net.WebException] {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        return @{ status = [int]$_.Exception.Response.StatusCode; body = $reader.ReadToEnd() }
    }
}

Write-Host ""
Write-Host "Tusab smoke driver  [suite: $Suite]" -ForegroundColor White
Write-Host "Root: $ROOT"
Write-Host ""

# Sobe backend se necessario
$already = $false
try {
    $chk = Fetch "GET" "/status"
    if ($chk.status -eq 200) { $already = $true; info "Backend already running" }
} catch {}

if (-not $already) {
    info "Starting FastAPI backend..."
    $PROC = Start-Process -FilePath $VENV `
        -ArgumentList "-m","uvicorn","api_tusab:app","--host","127.0.0.1","--port","8001","--log-level","warning" `
        -WorkingDirectory $ROOT -PassThru -WindowStyle Hidden

    $waited = 0
    while ($waited -lt 15) {
        Start-Sleep -Seconds 1
        $waited++
        try { $r2 = Fetch "GET" "/status"; if ($r2.status -eq 200) { break } } catch {}
    }
    if ($waited -ge 15) { fail "Backend did not start after 15s"; exit 1 }
    ok "Backend started (PID $($PROC.Id))"
}

# ==============================================================================
# SUITE: patch  -- engine core + yt-dlp
# Roda em: correcoes de bug, hotfix, qualquer commit que toque extraction.py
# ==============================================================================

section "yt-dlp"

$ytdlpOut = & $VENV -m yt_dlp --flat-playlist --ignore-errors --no-update --print "%(id)s|||%(title)s" --playlist-end 3 "https://www.youtube.com/@investidorsardinha/videos" 2>&1
$ytLines = $ytdlpOut | Where-Object { $_ -match "\|\|\|" }

if ($ytLines.Count -ge 1) {
    ok "yt-dlp mapeia videos reais ($($ytLines.Count) retornados de 3 solicitados)"
    $first = $ytLines[0].ToString()
    info $first.Substring(0, [Math]::Min(80, $first.Length))
} else {
    fail "yt-dlp retornou 0 videos -- extracao estaria quebrada"
    info "Output: $($ytdlpOut | Select-Object -First 3 | Out-String)"
}

section "Engine"

$r = Fetch "GET" "/status"
if ($r.status -eq 200 -and $r.body -match '"is_running"') {
    ok "/status OK"
    info $r.body.Substring(0, [Math]::Min(80, $r.body.Length))
} else { fail "/status returned $($r.status)" }

$r = Fetch "GET" "/history"
if ($r.status -eq 200) {
    $count = ([regex]::Matches($r.body, '"canal"')).Count
    ok "/history OK ($count canal entries)"
} else { fail "/history $($r.status)" }

$r = Fetch "GET" "/repositorio"
if ($r.status -eq 200 -and $r.body -match '"youtube"') {
    ok "/repositorio schema OK"
} else { fail "/repositorio $($r.status)" }

# Encerra aqui se suite = patch
if ($Suite -eq 'patch') {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  [patch]  PASS: $($script:PASS)   FAIL: $($script:FAIL)" -ForegroundColor $(if ($script:FAIL -eq 0) { "Green" } else { "Red" })
    Write-Host "============================================"
    if (-not $KeepAlive -and $PROC) { $PROC | Stop-Process -Force -ErrorAction SilentlyContinue }
    exit $(if ($script:FAIL -eq 0) { 0 } else { 1 })
}

# ==============================================================================
# SUITE: minor  -- patch + agent + fila
# Roda em: novas features, novos endpoints, mudancas no agent ou queue
# ==============================================================================

section "Fila de extracao"

$r = Fetch "GET" "/queue"
if ($r.status -eq 200 -and $r.body -match '"queue"') {
    ok "/queue OK"
} else { fail "/queue $($r.status)" }

$addBody = '{"canal_url":"https://www.youtube.com/@investidorsardinha","fontes":[]}'
$r = Fetch "POST" "/queue/add" $addBody
if ($r.status -eq 200 -and $r.body -match '"ok":true') {
    ok "/queue/add aceita URL valida"
} else { fail "/queue/add $($r.status): $($r.body)" }

$r = Fetch "DELETE" "/queue/clear"
if ($r.status -eq 200 -and $r.body -match '"ok":true') {
    ok "/queue/clear OK"
} else { fail "/queue/clear $($r.status)" }

$badBody = '{"canal_url":"https://www.google.com","fontes":[]}'
$r = Fetch "POST" "/queue/add" $badBody
if ($r.status -eq 200 -and $r.body -match '"error":true') {
    ok "/queue/add rejeita URL invalida"
} else { fail "/queue/add deveria rejeitar URL invalida: $($r.body)" }

section "Agent"

$r = Fetch "GET" "/agent/status"
if ($r.status -eq 200 -and $r.body -match '"configured"') {
    ok "/agent/status OK"
    info $r.body.Substring(0, [Math]::Min(100, $r.body.Length))
} else { fail "/agent/status $($r.status)" }

$r = Fetch "GET" "/agent/ollama/status"
if ($r.status -eq 200) {
    if ($r.body -match '"running":true') { ok "Ollama running" }
    else { info "Ollama not running (ok em dev)" }
} else { fail "/agent/ollama/status $($r.status)" }

# Encerra aqui se suite = minor
if ($Suite -eq 'minor') {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  [minor]  PASS: $($script:PASS)   FAIL: $($script:FAIL)" -ForegroundColor $(if ($script:FAIL -eq 0) { "Green" } else { "Red" })
    Write-Host "============================================"
    if (-not $KeepAlive -and $PROC) { $PROC | Stop-Process -Force -ErrorAction SilentlyContinue }
    exit $(if ($script:FAIL -eq 0) { 0 } else { 1 })
}

# ==============================================================================
# SUITE: full / major  -- tudo: seguranca, chat, frontend
# Roda em: pre-commit (padrao), releases, merges para main
# ==============================================================================

section "Seguranca de API key"

$invalidBody = '{"provider":"gemini","api_key":"INVALID_SMOKE_TEST_KEY_12345"}'
$r = Fetch "POST" "/agent/test-key" $invalidBody
if ($r.status -eq 200 -and $r.body -match '"error":true') {
    ok "/agent/test-key rejeita chave invalida"
} else { fail "/agent/test-key inesperado: $($r.body.Substring(0,[Math]::Min(80,$r.body.Length)))" }

$r = Fetch "GET" "/agent/config"
if ($r.status -eq 200 -and $r.body -notmatch '"api_key":"[^"*]{5,}"') {
    ok "/agent/config nao expoe chave em claro"
} else { fail "/agent/config pode estar expondo api_key" }

section "Chat"

$chatBody = '{"mensagem":"Smoke test.","canal_nome":"CanaldoEslen","historico":[],"canais_extras":[],"busca_ampla":false}'
$r = Fetch "POST" "/agent/chat" $chatBody
if ($r.status -eq 200 -and $r.body -match '"resposta"') {
    ok "/agent/chat retornou resposta"
    $parsed = $r.body | ConvertFrom-Json
    info "Reply: $($parsed.resposta.Substring(0,[Math]::Min(80,$parsed.resposta.Length)))"
} elseif ($r.status -eq 200 -and $r.body -match '"error":true') {
    ok "/agent/chat retornou erro esperado (canal sem indice -- comportamento correto)"
    info $r.body.Substring(0,[Math]::Min(100,$r.body.Length))
} else { fail "/agent/chat $($r.status): $($r.body.Substring(0,[Math]::Min(80,$r.body.Length)))" }

section "Frontend"

$r = Fetch "GET" "/"
if ($r.status -eq 200 -and $r.body -match "<!DOCTYPE html") {
    ok "/ serve index.html"
} else { fail "/ $($r.status)" }

section "Seguranca"

$r = Fetch "GET" "/..%2F..%2F..%2Fdata%2Fconfig%2Fagent_config.json"
if ($r.body -match "<!DOCTYPE html") {
    ok "Path traversal -> index.html (fallback seguro)"
} elseif ($r.status -eq 403 -or $r.status -eq 404) {
    ok "Path traversal -> $($r.status) (bloqueado)"
} else {
    fail "Path traversal: status inesperado $($r.status)"
    info $r.body.Substring(0,[Math]::Min(120,$r.body.Length))
}

# Resultado final
Write-Host ""
Write-Host "============================================"
Write-Host "  [full]  PASS: $($script:PASS)   FAIL: $($script:FAIL)" -ForegroundColor $(if ($script:FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "============================================"

if (-not $KeepAlive -and $PROC) {
    $PROC | Stop-Process -Force -ErrorAction SilentlyContinue
    info "Backend stopped"
} elseif ($KeepAlive) {
    info "Backend left running at $API"
}

exit $(if ($script:FAIL -eq 0) { 0 } else { 1 })

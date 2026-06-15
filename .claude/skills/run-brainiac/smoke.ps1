param([switch]$KeepAlive)

$ROOT = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$VENV = Join-Path $ROOT ".venv\Scripts\python.exe"
$API  = "http://127.0.0.1:8001"
$script:PASS = 0
$script:FAIL = 0
$PROC = $null

function ok   ($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:PASS++ }
function fail ($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:FAIL++ }
function info ($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Cyan }

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
Write-Host "BrainIAc smoke driver" -ForegroundColor White
Write-Host "Root: $ROOT"
Write-Host ""

$already = $false
try {
    $chk = Fetch "GET" "/status"
    if ($chk.status -eq 200) { $already = $true; info "Backend already running" }
} catch {}

if (-not $already) {
    info "Starting FastAPI backend..."
    $PROC = Start-Process -FilePath $VENV `
        -ArgumentList "-m","uvicorn","api_brainiac:app","--host","127.0.0.1","--port","8001","--log-level","warning" `
        -WorkingDirectory $ROOT -PassThru -WindowStyle Hidden

    $waited = 0
    while ($waited -lt 15) {
        Start-Sleep -Seconds 1
        $waited++
        try { $r = Fetch "GET" "/status"; if ($r.status -eq 200) { break } } catch {}
    }
    if ($waited -ge 15) { fail "Backend did not start after 15s"; exit 1 }
    ok "Backend started (PID $($PROC.Id))"
}

Write-Host "--- Engine ---"
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

Write-Host "--- Agent ---"
$r = Fetch "GET" "/agent/status"
if ($r.status -eq 200 -and $r.body -match '"configured"') {
    ok "/agent/status OK"
    info $r.body.Substring(0, [Math]::Min(100, $r.body.Length))
} else { fail "/agent/status $($r.status)" }

$r = Fetch "GET" "/agent/ollama/status"
if ($r.status -eq 200) {
    if ($r.body -match '"running":true') { ok "Ollama running" }
    else { info "Ollama not running (ok in CI): $($r.body)" }
} else { fail "/agent/ollama/status $($r.status)" }

Write-Host "--- API key validation ---"
$invalidBody = '{"provider":"gemini","api_key":"INVALID_SMOKE_TEST_KEY_12345"}'
$r = Fetch "POST" "/agent/test-key" $invalidBody
if ($r.status -eq 200 -and $r.body -match '"error":true') {
    ok "/agent/test-key rejects invalid key"
    info $r.body.Substring(0, [Math]::Min(100, $r.body.Length))
} else { fail "/agent/test-key unexpected: $($r.body.Substring(0,[Math]::Min(80,$r.body.Length)))" }

$r = Fetch "POST" "/agent/test-key" "{}"
if ($r.status -eq 200) {
    ok "/agent/test-key fallback to saved config OK"
} else { fail "/agent/test-key fallback $($r.status)" }

Write-Host "--- Chat ---"
$chatBody = '{"mensagem":"Smoke test.","canal_nome":"CanaldoEslen","historico":[],"canais_extras":[],"busca_ampla":false}'
$r = Fetch "POST" "/agent/chat" $chatBody
if ($r.status -eq 200 -and $r.body -match '"resposta"') {
    ok "/agent/chat response received"
    $parsed = $r.body | ConvertFrom-Json
    info "Reply: $($parsed.resposta.Substring(0,[Math]::Min(80,$parsed.resposta.Length)))"
} else { fail "/agent/chat $($r.status): $($r.body.Substring(0,[Math]::Min(80,$r.body.Length)))" }

Write-Host "--- Frontend ---"
$r = Fetch "GET" "/"
if ($r.status -eq 200 -and $r.body -match '<!DOCTYPE html') {
    ok "/ serves index.html"
} else { fail "/ $($r.status)" }

Write-Host "--- Security ---"
$r = Fetch "GET" "/..%2F..%2F..%2Fdata%2Fconfig%2Fagent_config.json"
if ($r.body -match '<!DOCTYPE html') {
    ok "Path traversal -> index.html (safe fallback)"
} elseif ($r.status -eq 403 -or $r.status -eq 404) {
    ok "Path traversal -> $($r.status) (blocked)"
} else {
    fail "Path traversal: unexpected $($r.status)"
    info $r.body.Substring(0,[Math]::Min(120,$r.body.Length))
}

Write-Host ""
Write-Host "--------------------------------------------"
Write-Host "  PASS: $($script:PASS)   FAIL: $($script:FAIL)" -ForegroundColor $(if ($script:FAIL -eq 0) { "Green" } else { "Red" })

if (-not $KeepAlive -and $PROC) {
    $PROC | Stop-Process -Force -ErrorAction SilentlyContinue
    info "Backend stopped"
} elseif ($KeepAlive) {
    info "Backend left running at $API"
}

exit $(if ($script:FAIL -eq 0) { 0 } else { 1 })

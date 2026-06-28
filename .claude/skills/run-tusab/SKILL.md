---
name: run-tusab
description: Run, start, launch, smoke-test, verify, screenshot the Tusab app. Use when asked to run the app, test a change, confirm a fix works, or verify an endpoint.
---

# run-tusab

Tusab é um app Electron 34 + FastAPI/Python 3.12 (porta 8001) + React 19.
O Electron é um wrapper — a superfície testável é o **backend FastAPI em `http://127.0.0.1:8001`**, que também serve o frontend React como arquivos estáticos.

O driver principal é `.claude/skills/run-tusab/smoke.ps1`.
Para verificações pontuais, use chamadas diretas via `[System.Net.HttpWebRequest]` — nunca `Invoke-WebRequest` (corrompe UTF-8 no PowerShell 5.1).

---

## Pré-requisitos

- Python `.venv` já instalado em `C:\Users\augus\Desktop\Tusab\.venv\`
- Dependências instaladas:
  ```powershell
  C:\Users\augus\Desktop\Tusab\.venv\Scripts\python.exe -m pip install -r requirements.txt
  ```
- **Sempre usar o Python do `.venv`** — `pip install` direto vai para o Python do sistema.

---

## Smoke suite — modos de execução

```powershell
cd C:\Users\augus\Desktop\Tusab

# Suite completa (padrão — pre-commit, releases)
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-tusab\smoke.ps1"

# Suite patch — engine + yt-dlp apenas (hotfixes, sem tocar features)
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-tusab\smoke.ps1" -Suite patch

# Suite minor — patch + agent + fila (novas features/endpoints)
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-tusab\smoke.ps1" -Suite minor

# Deixar o backend vivo após o smoke (útil para testar manualmente em seguida)
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-tusab\smoke.ps1" -KeepAlive
```

Exit 0 = tudo passou. Exit 1 = algum FAIL.

### O que cada suite cobre

| Suite | Checks | Quando usar |
|-------|--------|-------------|
| `patch` | yt-dlp, `/status`, `/history`, `/repositorio` | Hotfix, commit que só toca `extraction.py` |
| `minor` | patch + fila (`/queue/*`), `/agent/status`, Ollama | Nova feature, novo endpoint |
| `full` | minor + segurança de API key, chat, frontend `/`, path traversal | Pre-commit padrão, antes de release |

---

## Subir só o backend (sem smoke)

```powershell
cd C:\Users\augus\Desktop\Tusab
.\.venv\Scripts\python.exe -m uvicorn api_tusab:app --host 127.0.0.1 --port 8001 --log-level warning
```

Aguardar `GET /status` retornar 200 antes de fazer chamadas.

---

## Testar endpoints individualmente

```powershell
function Fetch($method, $path, $body = $null) {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:8001$path")
    $req.Method = $method; $req.Timeout = 20000
    if ($body) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $req.ContentType = "application/json; charset=utf-8"
        $req.ContentLength = $bytes.Length
        $s = $req.GetRequestStream(); $s.Write($bytes,0,$bytes.Length); $s.Close()
    }
    $resp = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(),[System.Text.Encoding]::UTF8)
    return $reader.ReadToEnd()
}

# Exemplos
Fetch "GET"  "/status"
Fetch "GET"  "/agent/status"
Fetch "GET"  "/repositorio"
Fetch "GET"  "/queue"
Fetch "POST" "/agent/test-key"  '{"provider":"gemini","api_key":"MINHA_CHAVE"}'
Fetch "POST" "/agent/chat"      '{"mensagem":"Ola","canal_nome":"MeuCanal","canais_extras":[],"busca_ampla":false}'
Fetch "POST" "/set-channel"     '{"url":"https://www.youtube.com/@investidorsardinha"}'
```

---

## App empacotado (Electron)

O instalador está em `dist_electron\Tusab Setup 1.0.11.exe`.
O Electron sobe o backend Python internamente via `electron/main.js` → `python_env/`.

Para sincronizar mudanças no frontend após build sem rebuild completo do Electron:

```powershell
# 1. Buildar o frontend
cd C:\Users\augus\Desktop\Tusab\web_interface
npm run build

# 2. Copiar dist para o pacote descompactado (se existir win-unpacked)
$src = "C:\Users\augus\Desktop\Tusab\web_interface\dist"
$dst = "C:\Users\augus\Desktop\Tusab\dist_electron\win-unpacked\resources\app\web_interface\dist"
Remove-Item $dst -Recurse -Force; Copy-Item $src $dst -Recurse
```

Para rebuild completo do instalador:
```powershell
cd C:\Users\augus\Desktop\Tusab\electron
npm run build
```

---

## Gotchas

- **`Invoke-WebRequest` corrompe UTF-8** — usar sempre `[System.Net.HttpWebRequest]` para leitura de bodies com acentos.
- **Box-drawing chars (`─`) em scripts PowerShell 5.1** causam `AmpersandNotAllowed`. Usar só ASCII puro em comentários de `.ps1`.
- **Porta 8001 já em uso**: se o smoke falhar ao iniciar, verificar com `netstat -ano | findstr :8001` e encerrar o processo anterior.
- **`TUSAB_DATA_DIR`** — em dev aponta para `data/` na raiz. Em produção Electron aponta para `%APPDATA%/Tusab`. Nunca setar esta variável manualmente durante testes sem isolar o ambiente.
- **Chat retorna `sem_contexto: true`** quando o índice BM25 não foi gerado para o canal — comportamento correto, não é erro do smoke.
- **`npm run build` via Bash não atualiza dist no Windows** — usar sempre PowerShell para o build do frontend.
- **`pip install` vai para o Python do sistema** — sempre prefixar com `.venv\Scripts\python.exe -m pip`.
- **Build do PyInstaller** (se necessário): `.venv\Scripts\python.exe -m PyInstaller Tusab.spec` — gera `dist/Tusab.exe`, diferente do instalador Electron em `dist_electron/`.

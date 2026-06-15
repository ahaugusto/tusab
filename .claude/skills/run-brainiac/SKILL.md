---
name: run-brainiac
description: Run, start, launch, smoke-test, verify, screenshot the BrainIAc app. Use when asked to run the app, test a change, confirm a fix works, or verify an endpoint.
---

# run-brainiac

BrainIAc é um app Electron 34 + FastAPI (Python) + React 19.
O Electron é só um wrapper — a superfície testável é o **backend FastAPI em `http://127.0.0.1:8001`**, que também serve o frontend React como arquivos estáticos.

O driver principal é `.claude/skills/run-brainiac/smoke.ps1`.
Para verificações pontuais, use chamadas diretas via `[System.Net.HttpWebRequest]` (não `Invoke-WebRequest` — tem problemas de encoding com UTF-8).

---

## Pré-requisitos

- Python `.venv` já instalado em `C:\Users\augus\Desktop\Brainiac\.venv\`
- Dependências do projeto instaladas:
  ```powershell
  cd C:\Users\augus\Desktop\Brainiac
  .\.venv\Scripts\pip.exe install -r requirements.txt
  ```
- Pacotes obrigatórios que precisaram ser instalados manualmente (não estavam no venv por padrão):
  ```powershell
  .\.venv\Scripts\pip.exe install openai anthropic
  ```

---

## Caminho do agente — smoke script

```powershell
cd C:\Users\augus\Desktop\Brainiac
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-brainiac\smoke.ps1"
```

Testa 10 checks: engine, histórico, repositório, agente, Ollama, validação de chave API, chat, frontend e path traversal.
Exit 0 = tudo passou. Exit 1 = algum FAIL.

Para deixar o backend vivo após o smoke (útil antes de testar manualmente):

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\skills\run-brainiac\smoke.ps1" -KeepAlive
```

---

## Subir só o backend (sem smoke)

```powershell
cd C:\Users\augus\Desktop\Brainiac
.\.venv\Scripts\python.exe -m uvicorn api_brainiac:app --host 127.0.0.1 --port 8001 --log-level warning
```

Aguardar até `GET /status` retornar 200 antes de fazer chamadas.

---

## Testar endpoints individualmente

Use sempre `[System.Net.HttpWebRequest]` para evitar problemas de encoding do PowerShell 5.1:

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

# Exemplos:
Fetch "GET"  "/status"
Fetch "GET"  "/agent/status"
Fetch "POST" "/agent/test-key" '{"provider":"gemini","api_key":"MINHA_CHAVE"}'
Fetch "POST" "/agent/chat" '{"mensagem":"Ola","canal_nome":"CanaldoEslen","historico":[],"canais_extras":[],"busca_ampla":false}'
```

---

## App empacotado (Electron)

Executável em:
```
dist_electron\win-unpacked\BrainIAc.exe
```

O Electron sobe o backend Python internamente ao abrir. Para sincronizar mudanças no app empacotado após build:

```powershell
# Frontend (após npm run build em web_interface/)
$src = "C:\Users\augus\Desktop\Brainiac\web_interface\dist"
$dst = "C:\Users\augus\Desktop\Brainiac\dist_electron\win-unpacked\resources\app\web_interface\dist"
Remove-Item $dst -Recurse -Force; Copy-Item $src $dst -Recurse

# Backend Python (após editar api_brainiac.py ou motor_brainiac.py)
Copy-Item "C:\Users\augus\Desktop\Brainiac\api_brainiac.py" `
          "C:\Users\augus\Desktop\Brainiac\dist_electron\win-unpacked\resources\app\api_brainiac.py" -Force
```

---

## Build frontend

```powershell
cd C:\Users\augus\Desktop\Brainiac\web_interface
npm run build
```

---

## Gotchas

- **`Invoke-WebRequest` corrompe UTF-8** nas respostas do FastAPI. Use sempre `[System.Net.HttpWebRequest]` para leitura de bodies com acentos.
- **Box-drawing chars (`─`) em scripts PowerShell 5.1** causam `AmpersandNotAllowed`. Use só ASCII puro em comentários de scripts `.ps1`.
- **`openai` e `anthropic` não vêm instalados automaticamente** mesmo estando no `requirements.txt` — instalar manualmente se `/agent/test-key` retornar `No module named 'openai'`.
- **Dois ambientes para sincronizar**: dev (`web_interface/dist/`) e empacotado (`dist_electron/win-unpacked/...`). Mudanças em `.py` também precisam ser copiadas para o pacote.
- **Porta 8001 já em uso**: se o smoke falhar ao iniciar, verificar com `netstat -ano | findstr :8001` e encerrar o processo anterior.
- **Chat retorna "Não encontrei conteúdo relevante"** quando o índice RAG não foi gerado para o canal. Isso é comportamento correto — não é erro.

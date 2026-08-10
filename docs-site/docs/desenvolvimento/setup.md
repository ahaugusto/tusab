---
id: setup
title: Setup de desenvolvimento
sidebar_label: Setup de desenvolvimento
slug: /desenvolvimento/setup
---

# Setup de desenvolvimento

## Pré-requisitos

Node.js 20+, Python 3.12+, Git.

## Clonar e instalar

```powershell
git clone https://github.com/ahaugusto/tusab.git
cd tusab

# Ambiente virtual Python
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Dependências do frontend
cd web_interface
npm install
cd ..

# Dependências do Electron
cd electron
npm install
cd ..
```

## Rodar em modo dev (dois terminais)

```powershell
# Terminal 1 — backend
.venv\Scripts\python.exe api_tusab.py

# Terminal 2 — frontend (hot reload)
cd web_interface
npm run dev
```

Interface completa em `http://localhost:8001` (servida pelo backend a partir do `dist/` gerado). Hot reload em `http://localhost:5173` (Vite dev server).

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `TUSAB_DATA_DIR` | Sobrescreve o diretório de dados (usado em testes e no Electron empacotado) |
| `ELECTRON_RUN` | Definida pelo Electron em produção — suprime abertura automática do navegador |
| `VITE_POSTHOG_KEY` | Chave de telemetria PostHog (nunca commitar — usar `web_interface/.env`) |

## Armadilhas conhecidas

- `pip install` sem prefixo vai para o Python do sistema, não o `.venv` — sempre use `.venv\Scripts\python.exe -m pip install ...`
- `npm run build` via Bash não atualiza o `dist/` corretamente no Windows — use PowerShell

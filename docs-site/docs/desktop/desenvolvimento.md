---
id: desenvolvimento
title: App desktop — desenvolvimento
sidebar_label: Desenvolvimento
slug: /desktop/desenvolvimento
---

# App desktop — desenvolvimento

:::warning App desktop descontinuado
O app desktop foi descontinuado em 19/11/2026 e não recebe mais correções nem atualizações. O código citado nesta página está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final), não mais no `main`. Esta página é mantida só como registro.
:::

## Pré-requisitos

Node.js 20+, Python 3.12+, Git.

## Clonar e instalar

```powershell
git clone https://github.com/criaugu/tusab.git
cd tusab

# Ambiente virtual Python
python -m venv .venv
.venv\Scripts\Activate.ps1
.venv\Scripts\python.exe -m pip install -r requirements.txt

# Interface
cd web_interface
npm install
cd ..

# Electron
cd electron
npm install
cd ..
```

Para a reordenação semântica (CrossEncoder) e o KeyBERT, que ficam fora do instalador padrão, instale também `requirements-enterprise.txt`.

## Rodar em modo de desenvolvimento

```powershell
# Terminal 1 — backend
.venv\Scripts\python.exe api_tusab.py

# Terminal 2 — interface com recarga automática
cd web_interface
npm run dev

# Ou o app completo no Electron
cd electron
npm run dev
```

A interface completa fica em `http://localhost:8001` (servida pelo backend a partir de `web_interface/dist/`); a recarga automática, em `http://localhost:5173` (servidor do Vite).

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `TUSAB_DATA_DIR` | Sobrescreve a pasta de dados (usada nos testes e no app empacotado) |
| `ELECTRON_RUN` | Definida pelo Electron; impede o backend de abrir o navegador sozinho |
| `VITE_CLARITY_ID` | Opcional: troca o ID público do projeto Microsoft Clarity |

## Cuidados no Windows

- `pip install` sem prefixo vai para o Python do sistema, não para o `.venv`: use `.venv\Scripts\python.exe -m pip install ...`.
- `npm run build` pelo Git Bash pode não atualizar o `dist/`: use o PowerShell.

## Testes

```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```

`tests/conftest.py` aponta `TUSAB_DATA_DIR` para uma pasta temporária antes de qualquer import. A suíte cobre rotas da API (TestClient do FastAPI), confiabilidade (escrita atômica, concorrência, índice corrompido ou vazio), busca, fontes públicas, exportações e outros módulos.

## Build de produção (Windows)

```powershell
cd web_interface
npm run build
cd ..\electron
npm run build
```

Saída: `dist_electron/Tusab-Setup-X.X.X.exe`. Pré-requisito: `electron/python_env/` com um Python 3.12 embutível e as dependências, e `electron/bin/yt-dlp.exe`. Essas pastas são grandes e ficam fora do git.

## Build de produção (macOS)

O build macOS (`.dmg`/`.zip` assinado e notarizado, Apple Silicon) roda no GitHub Actions (`macos-latest`) com `electron-builder --mac` e notarização automatizada. O Python do pacote é um CPython 3.12 portátil para arm64.

## CI

`.github/workflows/ci.yml` roda a cada push e pull request em `main`:

- **`backend-tests`:** `pytest` completo (Python 3.11) contra um `dist/` mínimo;
- **`frontend-build`:** `vite build` de produção e auditoria de acessibilidade com `pa11y-ci` na tela de Landing (ver [Acessibilidade](/acessibilidade#escopo-do-pa11y-ci)).

`release.yml` gera os instaladores; `validar-instalador-windows.yml` e `macos-smoke.yml` conferem os pacotes gerados. Um instalador só é considerado válido depois de subir o backend numa máquina limpa: entre a 1.0.42 e a 1.0.57, o `.exe` saiu sem o Python embutido com o CI verde.

## Windows e macOS

Código que toca caminhos, subprocessos ou binários usa ramificação por plataforma (`process.platform === 'darwin'`, `sys.platform`) no mesmo arquivo, nunca arquivos ou branches separados por sistema. Uma mudança pensada para um sistema não pode alterar o comportamento do outro.

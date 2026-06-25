# Tusab

**INDEX · AUGMENT · CONVERSE**

Seu especialista particular. Aponte o que quer aprender — um canal do YouTube, um PDF, um documento — o Tusab absorve tudo e responde suas perguntas citando a fonte exata. Roda na sua máquina, funciona offline, zero custo com Ollama.

Desenvolvido por **Augusto Brasil** · [CriAugu](https://linkedin.com/in/augustoalvesbrasil) — CNPJ 65.131.075/0001-57

---

## Download

**[⬇ Tusab Setup 1.0.4.exe](https://github.com/ahaugusto/tusab-public/releases/download/v1.0.4/Tusab.Setup.1.0.4.exe)** — Windows 10/11 x64 · ~210 MB · inclui Python e yt-dlp embutidos

---

## O que é

Tusab é um sistema de gestão de conhecimento pessoal (PKM) com IA local. Você decide o que o especialista aprende — vídeos, documentos, anotações — e consulta por chat em linguagem natural. Ele só responde com o que você indexou, sempre citando a fonte exata de onde o trecho foi recuperado.

| Letra | Etapa | O que faz |
|-------|-------|-----------|
| **I** | Index | Extração e indexação de YouTube, PDFs, DOCX, Markdown, texto livre |
| **A** | Augment | RAG com BM25 + CrossEncoder entrega chunks precisos ao modelo |
| **C** | Converse | Chat com streaming, citação de fonte e histórico de conversa |

---

## Funcionalidades

- Extração automática de canais inteiros do YouTube (legendas + metadados)
- Upload de PDFs, DOCX, Markdown, CSV e TXT
- Upload de imagens (PNG, JPG, WEBP etc.) — descrição via Ollama multimodal ou OCR Tesseract
- Upload de áudio (MP3, WAV, M4A etc.) — transcrição via faster-whisper local
- Parser automático de conversas WhatsApp e transcrições de reuniões (Zoom, Teams, Otter)
- Colar texto diretamente pela interface
- Agente RAG local: BM25Okapi + CrossEncoder (ms-marco-MiniLM-L-6-v2) + anti-alucinação
- Busca Restrita (BM25 puro, ~1 ms) e Busca Ampla (BM25 + CrossEncoder, ~250 ms)
- Chat com streaming de resposta e citação verificável da fonte
- Multi-base: consulta simultânea em múltiplas bases de conhecimento
- Seletor de modelos Ollama e provedores externos (Groq, OpenAI, Anthropic, Google)
- Backup opcional para Google Drive (escopo `drive.file`)
- Export de base como `.tusab` (portabilidade entre máquinas)
- Relatório de extração por canal com estatísticas e tabela de vídeos
- Auto-update via GitHub Releases
- Internacionalização: Português, Inglês, Espanhol
- Telemetria opt-in (PostHog)

---

## Provedores de IA

| Provedor | Modelo padrão | Custo | Requer API key |
|----------|--------------|-------|----------------|
| Ollama (padrão) | llama3.2:1b | Gratuito | Não |
| Groq | llama-3.1-70b-versatile | Free tier | Sim |
| OpenAI | gpt-4o-mini | Pago | Sim |
| Anthropic | claude-sonnet-4-6 | Pago | Sim |
| Google | gemini-1.5-flash | Pago | Sim |

O Ollama é configurado na primeira execução via wizard embutido. Para provedores externos, configure a chave em **Configurar Agente** — ela é testada antes de ser salva e armazenada via DPAPI (Windows).

---

## Stack

**Backend:** Python 3.12 + FastAPI + Uvicorn — API REST em `localhost:8001`  
**Agente RAG:** rank_bm25 (BM25Okapi) + sentence-transformers (CrossEncoder) + Ollama / provedores externos  
**Frontend:** React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React  
**Desktop:** Electron 34 + electron-builder (instalador NSIS para Windows)  
**Extração:** yt-dlp (bundled) + pdfplumber + python-docx  
**Imagens:** Ollama multimodal (llava/gemma3) → fallback Tesseract OCR  
**Áudio:** faster-whisper (modelo `base`, CPU, ~150 MB)  
**Drive:** Google Auth OAuth2 (escopo `drive.file`)

---

## Estrutura do repositório

```
Tusab/
  api_tusab.py              <- entry point FastAPI (~165 linhas)
  motor_tusab.py            <- shim de re-export (compatibilidade Electron)
  agent_tusab.py            <- shim de re-export (compatibilidade Electron)
  tusab_engine/             <- pacote Python principal
    storage.py                <- caminhos de dados + IO atômico
    state.py                  <- AppState singleton + LogRedirector
    agent/
      config.py               <- carregar/salvar agent_config.json
      index.py                <- BM25 indexing + cache + CrossEncoder
      chat.py                 <- RAG chat + streaming
    motor/
      drive.py                <- OAuth Google Drive + upload
      extraction.py           <- engine de extração YouTube
      auto_update.py          <- verificação de auto-update
    api/
      router_status.py        <- GET /status, /drive-auth, /history, /open-folder
      router_extraction.py    <- POST /set-channel, /start, /pause, /cancel, /queue/*
      router_agent.py         <- /agent/* (chat, config, index, ollama, stream)
      router_repositorio.py   <- /repositorio, /relatorio, /neural/*, /reset-total
      router_exports.py       <- /export/* (zip, markdown, docx, xlsx, pdf)
  requirements.txt            <- dependências Python
  smoke_test.py               <- 15 smoke tests contra backend real
  tests/                      <- suite de testes (27 testes)
  web_interface/              <- frontend React
    src/
      App.jsx                 <- orquestrador principal
      components/             <- componentes por domínio
      services/api.js         <- camada de API centralizada
      hooks/                  <- hooks customizados (polling, chat, config)
      locales/                <- traduções PT/EN/ES
    dist/                     <- build do frontend (gerado)
  electron/                   <- wrapper desktop
    main.js
    preload.js
    package.json
  Documentação do Produto/    <- documentação estratégica e técnica
  CHANGELOG.md
```

---

## Estrutura de dados

Em produção (Electron): `%AppData%\Tusab\data\`  
Em desenvolvimento: `./data/`  
Configurável via env var `TUSAB_DATA_DIR`.

```
data/
  neural/
    {projeto}/
      youtube/        <- transcrições .txt extraídas do YouTube
      documents/      <- PDFs, DOCX e outros docs + _manifest.json
      texts/          <- textos colados + _manifest.json
      management/     <- CSVs de gestão, summary.json, README, relatório
  indexes/            <- índices BM25 em JSON por projeto ({prefixo}_index.json)
  config/             <- agent_config.json, credentials.json, token.json
  temp/               <- VTTs temporários (auto-removidos)
```

**Nota de segurança:** a pasta `config/` pode conter chaves de API — não inclua em backups automáticos em nuvem sem criptografia adicional. A pasta `neural/` é segura para compartilhar.

---

## Instalação para desenvolvimento

**Pré-requisitos:** Node.js 20+, Python 3.12+, Git

```powershell
# Clonar o repositório
git clone <repo>
cd Tusab

# Criar virtualenv Python
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

**Rodar em modo dev (dois terminais):**

```powershell
# Terminal 1 — backend
.venv\Scripts\python.exe api_tusab.py

# Terminal 2 — frontend (hot reload)
cd web_interface
npm run dev
```

Interface disponível em `http://localhost:8001` (servida pelo backend com o `dist/` gerado).  
Hot reload em `http://localhost:5173` (Vite dev server).

**Variáveis de ambiente:**

| Variável | Descrição |
|----------|-----------|
| `TUSAB_DATA_DIR` | Sobrescreve o diretório de dados (usado em testes e Electron packaged) |
| `ELECTRON_RUN` | Definida pelo Electron em produção — suprime abertura automática do browser |
| `VITE_POSTHOG_KEY` | Chave PostHog para telemetria (nunca commitar — usar `web_interface/.env`) |

---

## Build de produção

```powershell
# 1. Build do frontend
cd web_interface
npm run build
cd ..

# 2. Build do instalador Windows
cd electron
npm run build
```

Saída: `dist_electron/Tusab Setup 1.0.1.exe`

**Pré-requisito:** `electron/python_env/` deve estar populado com Python 3.12 embeddable + dependências instaladas, e `electron/bin/yt-dlp.exe` deve existir. Esses diretórios são grandes e ficam no `.gitignore` — configure uma vez localmente antes de buildar.

---

## Testes

```powershell
# Suite de integração (27 testes)
.venv\Scripts\python.exe -m pytest tests/ -v

# Smoke tests contra backend real (15 checks)
.venv\Scripts\python.exe smoke_test.py
```

**27/27 verde.** A suite inclui testes de integração (TestClient FastAPI) e testes de confiabilidade (escrita atômica, concorrência, índice corrompido/vazio).

---

## Configurando o Google Drive (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e habilite a **Google Drive API**
2. Crie credenciais OAuth 2.0 (Aplicativo Desktop) e baixe o JSON
3. Renomeie para `credentials.json` e coloque na raiz do projeto
4. Na interface do Tusab, ative o Drive na aba Repositório — o fluxo OAuth abrirá no navegador
5. Após autorizar, `token.json` é salvo localmente (ambos no `.gitignore`)

---

## Acessibilidade

Interface com conformidade WCAG 2.1 nível AA:

- Touch targets mínimos de 44×44px em todos os botões interativos
- `aria-label` em todos os botões de ícone sem texto visível
- `role="dialog" aria-modal="true"` em todos os modais via `ModalWrapper`
- Focus trap + `Escape` para fechar em modais
- `aria-live="polite"` em status dinâmicos (extração, snack, streaming)
- `role="tooltip"` nos tooltips da sidebar
- `prefers-reduced-motion` respeitado globalmente
- Navegação completa por teclado com atalhos (`C` abre chat, `B/E/A/I/M` trocam abas)

Auditoria completa em `Documentação do Produto/Acessibilidade e WCAG.md`.

---

## Segurança

O Tusab roda localmente — sem servidor central, sem dados na nuvem por padrão.

- CORS restrito a `localhost:8001`
- Path traversal bloqueado com `os.path.realpath()` em todos os endpoints de arquivo
- Prompt injection mitigado com delimitadores XML no pipeline RAG
- URL do YouTube validada por regex whitelist antes de ser passada ao yt-dlp
- Histórico do chat mantido no servidor (payload do cliente é ignorado)
- Electron com `contextIsolation: true`, `sandbox: true` e `nodeIntegration: false`
- yt-dlp executado via lista de argumentos (nunca `shell=True`)
- Chave de API mascarada (`***`) na resposta `GET /agent/config`
- Chaves armazenadas via `safeStorage` do Electron (Windows DPAPI) quando disponível
- Arquivos sensíveis no `.gitignore`: `credentials.json`, `token.json`, `.env`, `agent_config.json`

---

## Changelog

### [1.0.1] — 2026-06-24

**Correções**
- Índices BM25 apagados indevidamente após indexação bem-sucedida
- Fontes erradas no chat multi-base (canal global sobrescrevia seleção do usuário)
- Base selecionada no chat perdida ao recarregar a página
- Backend crashando no Windows (UnicodeEncodeError no banner ASCII)
- Electron dev: Python do sistema usado em vez do `.venv`; dados em AppData em vez do projeto
- Botão voltar no modal de upload para trocar projeto
- Endpoint `/_debug/paths` removido de produção
- Conformidade de nomenclatura: `cerebro/` → `neural/` em comentários, avisos e documentação

**Novo**
- Tooltip no botão flutuante de chat (hover e focus)
- Atalho de pasta local no header de cada base no Repositório
- Snack de primeiro acesso com `aria-live` (acessível a leitores de tela)
- Auditoria de acessibilidade WCAG 2.1 AA documentada

### [1.0.0] — 2026-06-20

Lançamento inicial. Extração de YouTube, RAG local com BM25 + CrossEncoder, chat com streaming e citação de fonte, multi-base, perfis de usuário, onboarding, i18n PT/EN/ES, Google Drive, exportação de base `.tusab`, auto-update.

---

## Licença

Copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57  
Todos os direitos reservados. Lei nº 9.609/1998 (Lei do Software) + Lei nº 9.610/1998.  
Proibida reprodução sem autorização expressa.

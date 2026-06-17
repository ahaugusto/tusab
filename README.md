# Tusab Engine

**INDEX · AUGMENT · CONVERSE**

Seu especialista particular. Aponte o que quer aprender — um canal do YouTube, um PDF, um documento — o Tusab absorve tudo e responde suas perguntas citando a fonte exata. Roda na sua máquina, funciona offline, zero custo com Ollama.

Desenvolvido por **Augusto Brasil** · CriAugu — CNPJ 65.131.075/0001-57

---

## O que é

Tusab é um sistema de gestão de conhecimento pessoal (PKM) com IA local. Você decide o que o especialista aprende — vídeos, documentos, anotações — e consulta por chat em linguagem natural. Ele só responde com o que você indexou, sempre citando a fonte.

O diferencial: extração de canais YouTube inteiros + processamento 100% local, para quem não pode ou não quer mandar dados para a nuvem.

| Letra | Etapa | O que faz |
|-------|-------|-----------|
| **I** | Index | Extração e indexação de YouTube, PDFs, DOCX, Markdown, texto livre |
| **A** | Augment | RAG com BM25 + recuperação de contexto entrega chunks precisos ao modelo |
| **C** | Converse | Chat com streaming, citação de fonte e histórico de conversa |

---

## Funcionalidades

- Extração automática de canais inteiros do YouTube (legendas + metadados)
- Upload de PDFs, DOCX, Markdown e TXT
- Upload de imagens (PNG, JPG, WEBP etc.) — descrição via Ollama multimodal ou OCR Tesseract
- Upload de áudio (MP3, WAV, M4A etc.) — transcrição via faster-whisper local
- Colar texto diretamente pela interface
- Agente RAG local: BM25Okapi + anti-alucinação + multi-canal
- Chat com streaming de resposta e citação verificável da fonte
- Seletor de modelos Ollama e provedores externos (Groq, OpenAI, Anthropic, Google)
- Backup opcional para Google Drive (escopo `drive.file`)
- Relatório de extração por canal com estatísticas e tabela de vídeos
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

O Ollama é configurado na primeira execução via wizard embutido. Para provedores externos, configure a chave em **Configurar Agente** — ela é testada antes de ser salva.

---

## Stack

**Backend:** Python 3.12 + FastAPI + Uvicorn — API REST em `localhost:8001`  
**Agente RAG:** rank_bm25 (BM25Okapi) + Ollama / provedores externos  
**Frontend:** React 19 + Vite + Tailwind CSS 3 + Framer Motion + Lucide React  
**Desktop:** Electron 34 + electron-builder (instalador NSIS para Windows)  
**Extração:** yt-dlp (bundled) + pdfplumber + python-docx  
**Imagens:** Ollama multimodal (llava/gemma3) → fallback Tesseract OCR  
**Áudio:** faster-whisper (modelo `base`, CPU, ~150 MB)  
**Drive:** Google Auth OAuth2 (escopo drive.file)

---

## Estrutura do repositório

```
Tusab/
  api_tusab.py            <- entry point FastAPI (165 linhas)
  motor_tusab.py          <- shim de re-export (compatibilidade)
  agent_tusab.py          <- shim de re-export (compatibilidade)
  tusab_engine/           <- pacote Python principal
    storage.py              <- caminhos de dados + IO atômico
    state.py                <- AppState singleton + LogRedirector
    agent/
      config.py             <- carregar/salvar agent_config.json
      index.py              <- BM25 indexing + cache
      chat.py               <- RAG chat + streaming
    motor/
      drive.py              <- OAuth Google Drive + upload
      extraction.py         <- engine de extração YouTube
    api/
      router_status.py      <- GET /status, /drive-auth, /history
      router_extraction.py  <- POST /set-channel, /start, /pause, /cancel
      router_agent.py       <- /agent/* (chat, config, index, ollama)
      router_repositorio.py <- /repositorio, /relatorio, /cerebro/*
  requirements.txt          <- dependências Python
  requirements-lock.txt     <- versões pinadas (reprodutibilidade)
  build.ps1                 <- script unificado de build (PowerShell)
  tests/                    <- suite de testes (23 testes)
  web_interface/            <- frontend React
    src/
      App.jsx               <- orquestrador principal
      components/           <- componentes por domínio
      services/api.js       <- camada de API centralizada
      hooks/                <- hooks customizados (polling)
      locales/              <- traduções PT/EN/ES
    dist/                   <- build do frontend (gerado)
  electron/                 <- wrapper desktop
    main.js
    package.json
  Documentação do Produto/  <- documentação estratégica e técnica
```

---

## Estrutura de dados em produção

Dados do usuário ficam em `%AppData%\Tusab\data\` (em dev: `./data/`):

```
data/
  cerebro/
    {canal}/
      youtube/      <- extrações .txt do YouTube
      documentos/   <- uploads + _manifest.json
      textos/       <- texto colado + _manifest.json
  gestao/           <- CSVs de metadados e histórico por canal
  agent_index/      <- índices BM25 em JSON por canal
  temp/             <- VTTs temporários (auto-removidos)
  config/           <- agent_config.json e token.json (OAuth)
```

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

# Terminal 2 — frontend
cd web_interface
npm run dev
```

Interface disponível em `http://localhost:5173`. Backend em `http://localhost:8001`.

**Variáveis de ambiente:**

| Variável | Descrição |
|----------|-----------|
| `ELECTRON_RUN` | Definida pelo Electron em produção — altera caminhos para `%AppData%` |
| `TUSAB_DATA_DIR` | Sobrescreve o diretório de dados (usado em testes e no Electron packaged) |
| `VITE_POSTHOG_KEY` | Chave PostHog para telemetria (nunca commitar — usar `web_interface/.env`) |

---

## Build de produção

O script `build.ps1` unifica todo o processo de empacotamento:

```powershell
# Build completo (frontend + instalador NSIS)
powershell.exe -File build.ps1

# Opções
powershell.exe -File build.ps1 -SkipFrontend    # só Electron
powershell.exe -File build.ps1 -Dir              # sem installer (só unpacked)
```

**Pré-requisito:** `electron/python_env/` deve estar populado com Python 3.12 embeddable + dependências, e `electron/bin/yt-dlp.exe` deve existir. Esses diretórios são grandes e ficam no `.gitignore` — configure uma vez localmente antes de buildar.

Saída: `dist_electron/Tusab Setup 2.0.0.exe`

---

## Testes

```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```

**23/23 verde.** A suite inclui 17 testes de integração (TestClient FastAPI) e 6 testes de confiabilidade (escrita atômica, concorrência, índice corrompido).

---

## Configurando o Google Drive (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e habilite a **Google Drive API**
2. Crie credenciais OAuth 2.0 (Aplicativo Desktop) e baixe o JSON
3. Renomeie para `credentials.json` e coloque na raiz do projeto
4. Na interface do Tusab, ative o toggle do Drive — o fluxo OAuth abrirá no navegador
5. Após autorizar, `token.json` é salvo localmente (ambos no `.gitignore`)

---

## Interface responsiva e acessível

A interface foi projetada para funcionar bem em dispositivos móveis, tablets e desktops.

**Breakpoints:**

| Breakpoint | Largura | Comportamento |
|------------|---------|---------------|
| Mobile | < 768px | Nav drawer deslizante (w-52), logo 44 px, botões full-width |
| Tablet (`md:`) | ≥ 768px | Nav rail lateral fixa (w-20) com ícone + label, logo 52 px |
| Desktop (`lg:`) | ≥ 1024px | Logo maior (320px), padding ampliado |

**Acessibilidade (WCAG 2.1 AA):**

- Touch targets mínimos de 44×44px em todos os botões interativos
- `aria-label` em todos os botões de ícone sem texto visível
- `aria-expanded` em painéis expansíveis (configurações avançadas)
- `role="dialog" aria-modal="true"` em todos os modais via `ModalWrapper`
- Navegação por teclado com focus trap em modais e `Escape` para fechar
- `<caption className="sr-only">` nas tabelas de dados
- `aria-live="polite"` no status de extração em tempo real
- `role="tabpanel" aria-labelledby` nos painéis de aba

---

## Changelog

### v2.4.0 — 2026-06-16

**Interface**
- Nav rail expandida (`w-14 → w-20`) com labels abaixo de cada ícone
- Logo compacta aumentada (34 px → 52 px no rail, 32 px → 44 px no drawer mobile)
- Logos SVG oficiais aplicadas em todos os slots (light/dark, compacto/completo)
- Botão "Arquivos Gerados" abre a pasta `cerebro/{canal}/youtube/` do canal ativo
- Com múltiplos canais extraídos, modal de seleção permite escolher qual pasta abrir
- Removida abertura de pasta genérica `cerebro_txt` (obsoleta)

**Extração (anti-429)**
- Estratégia de duas passagens para legendas: primária `pt,pt-BR` → fallback `en,es` só se nenhum VTT gerado
- Flag `youtube:skip=translated_subs` elimina tentativas de legendas traduzidas de outros idiomas
- `--sleep-requests 1` como proteção extra contra throttle do YouTube
- Erros 429 suprimidos do log (comportamento esperado quando o idioma não existe no vídeo)

---

### v2.3.3 — 2026-06-15

**Extração (confiabilidade yt-dlp)**
- `_ytdlp_run()`: wrapper central para todas as chamadas ao yt-dlp — sempre usa `sys.executable -m yt_dlp` (resolve falha silenciosa do wrapper `.exe` no Windows com venv)
- `_ytdlp_update()`: auto-atualização do yt-dlp via pip no início de cada extração
- `--js-runtimes node` aplicado a todas as chamadas (evita erro de runtime JS)
- Cascata de idiomas `pt,pt-BR,en,es` cobre canais BR, PT, anglófonos e hispânicos

### v2.3.2 — 2026-06-15

**Correções**
- Legendas `pt-BR` não encontradas: `sub_langs = 'pt'` alterado para `'pt,pt-BR'`
- Metadados não retornados: `result_meta.stdout` corrigido para usar `_ytdlp_run` com `meta_stdout`

### v2.3.1 — 2026-06-15

**Performance**
- Sync com Google Drive movido para após a extração local completa (era incremental a cada parte)
- Elimina lentidão e reconexões OAuth durante o loop de extração

### v2.3.0 — 2026-06-15

**UX / robustez**
- Loading indeterminado durante mapeamento de canais longos (7000+ vídeos)
- Contador "X mapeados" visível em tempo real durante o mapeamento
- Deduplicação de vídeos por título quando `upload_date = NA`
- Prints incrementais por fonte durante o mapeamento

---

## Segurança

O Tusab roda localmente — sem servidor central, sem dados na nuvem por padrão. Todos os dados ficam na máquina do usuário.

**Controles implementados:**

- CORS restrito a `localhost:8001`
- Path traversal bloqueado com `os.path.realpath()` em todos os endpoints de arquivo
- Prompt injection mitigado com delimitadores XML no pipeline RAG
- URL do YouTube validada por regex whitelist antes de ser passada ao yt-dlp
- Histórico do chat mantido no servidor (não confiado no cliente)
- Electron com `contextIsolation: true` e `nodeIntegration: false`
- yt-dlp executado via lista de argumentos (nunca `shell=True`)
- Chave de API mascarada (`***`) na resposta GET `/agent/config`
- Arquivos sensíveis no `.gitignore`: `credentials.json`, `token.json`, `.env`, `agent_config.json`

---

## Licença

Copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57  
Todos os direitos reservados. Lei nº 9.609/1998 (Lei do Software) + Lei nº 9.610/1998.  
Registro INPI pendente — Programa de Computador "Tusab".

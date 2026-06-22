# Changelog Técnico — Tusab v1.0
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

Documento de referência das modificações implementadas na sprint de lançamento da v1.0.
Organizado por commit, do mais antigo ao mais recente.

---

## Commit `572fd5f` — Pro groundwork v1.0

**Data:** 16/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Implementação do fundamento técnico para o modelo freemium Free vs. Pro.
A estratégia é "free generoso": o loop completo funciona no free; a parede existe onde o usuário já depende do produto.
Nenhuma feature é bloqueada na v1.0 — o ProSnackbar é informativo ("fique de olho no lançamento").

---

### Backend

#### `tusab_engine/api/router_exports.py` (novo)

Dois endpoints de export, exclusivos do plano Pro:

**`POST /export/base`**
Gera um arquivo `.zip` contendo:
- Toda a pasta `cerebro/` (transcrições YouTube, documentos, textos colados)
- CSVs e JSONs de gestão (`gestao/`)

Retorna `StreamingResponse` com `Content-Disposition: attachment` para download direto pelo browser.
Nome do arquivo: `tusab_base_YYYYMMDD_HHMM.zip`.

**`POST /export/historico`**
Recebe `{ canal_nome: string }` no body.
Lê o histórico server-side (`state.chat_histories[canal]`) e gera um arquivo `.md` estruturado:
```
# Histórico de Chat — @canal
_Exportado em DD/MM/YYYY HH:MM_

**Você:** pergunta do usuário

**Tusab:** resposta do agente

_Fontes:_
- [Título do vídeo](link)
```
Retorna `StreamingResponse` com `media_type: text/markdown`.
Nome do arquivo: `tusab_historico_{canal}_{ts}.md`.
Retorna JSON de erro claro se não há histórico disponível.

#### `tusab_engine/agent/index.py`

Adicionado limite freemium no `indexar()`:

```python
FREE_MAX_CANAIS = 2

def _contar_canais_indexados() -> list:
    # Conta arquivos _index.json em INDEX_DIR
    ...

# Em indexar():
if not config.get('pro', False):
    existentes = _contar_canais_indexados()
    if canal_nome not in existentes and len(existentes) >= FREE_MAX_CANAIS:
        raise ValueError("PRO_LIMIT:Você já tem N canais indexados...")
```

O prefixo `PRO_LIMIT:` é a convenção de contrato com o frontend:
quando o erro começa com esse prefixo, o frontend exibe o ProSnackbar em vez de um erro genérico.

#### `api_tusab.py`

`router_exports` incluído no app FastAPI junto aos demais routers.

---

### Frontend

#### `ProSnackbar.jsx` (novo)
**Path:** `web_interface/src/components/shared/ProSnackbar.jsx`

Componente de notificação informativo para features Pro. Aparece quando o usuário toca uma funcionalidade exclusiva do plano Pro.

Comportamento:
- Posição fixa no canto inferior direito (`bottom-24 right-5`)
- Animação de entrada/saída via framer-motion (slide + fade)
- Auto-fecha em 6 segundos (configurável via prop `autoClose`)
- CTA "Quero ser avisado →" com link `mailto:` para registrar interesse
- Fechar manual pelo botão ✕

Props:
| Prop | Tipo | Descrição |
|------|------|-----------|
| `visible` | boolean | Controla exibição |
| `onClose` | function | Callback ao fechar |
| `feature` | string | Nome da feature (ex: "Fila de Extração") |
| `darkMode` | boolean | Tema dark/light |
| `autoClose` | number | Ms para fechar automaticamente (padrão: 6000) |

Acessibilidade: `role="status"` + `aria-live="polite"`.

#### `App.jsx`

Estado e helper adicionados:
```jsx
const [proSnackbar, setProSnackbar] = useState({ visible: false, feature: '' });
const showProSnackbar = (feature) => setProSnackbar({ visible: true, feature });
```

Touchpoints onde o ProSnackbar é acionado:
| Ação do usuário | Feature exibida |
|-----------------|-----------------|
| Indexar canal além do limite free | "Canais ilimitados" |
| Adicionar canal à fila durante extração | "Fila de Extração" |
| Ativar busca em canal extra (multi-canal) | "Busca Multi-canal" |
| Clicar em "Exportar base (ZIP)" | "Export da Base" |
| Clicar em "Exportar histórico de chat (MD)" | "Export do Histórico" |

Nova seção **"Export da Base (Pro)"** adicionada no painel de Configurar Agente (entre Telemetria e Indexação):
- Botão "Exportar base (ZIP)": chama `POST /export/base`, aciona download via URL objeto temporário e exibe ProSnackbar
- Botão "Exportar histórico de chat (MD)": chama `POST /export/historico`, aciona download e exibe ProSnackbar

#### `services/api.js`

```js
export const exportBase = () =>
  fetch(`${API_BASE}/export/base`, { method: 'POST' });

export const exportHistorico = (canal_nome = '') =>
  fetch(`${API_BASE}/export/historico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canal_nome }),
  });
```

Usam `fetch` nativo (não axios) para capturar o stream de download como `Blob`.

---

## Commit `6811cd3` — Upload de imagens + drag and drop + alert

**Data:** 16/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Três problemas identificados no repositório de conhecimento:
1. **Bug:** imagens enviadas pelo usuário não apareciam na lista — eram silenciosamente descartadas
2. **UX:** ausência de drag and drop tornava o upload mais trabalhoso
3. **Informação:** o alert do repositório não mencionava imagens e áudios como tipos suportados

---

### Backend

#### `tusab_engine/api/router_repositorio.py`

**Raiz do bug de imagens:**
O endpoint `POST /cerebro/upload` chamava `_extrair_imagem()`, que lança `RuntimeError` quando nem Ollama multimodal nem Tesseract OCR estão disponíveis. Esse `RuntimeError` era capturado pelo `except` externo e retornava `{"error": true}`. O arquivo nunca entrava no manifesto.

**Fix aplicado:**
O branch `eh_imagem` agora tem seu próprio `try/except RuntimeError`:

```python
elif eh_imagem:
    try:
        texto = _extrair_imagem(conteudo_bytes, arquivo.filename)
    except RuntimeError as e:
        aviso_extracao = str(e)
        texto = (
            "[Imagem registrada sem extração de texto]\n"
            f"Arquivo: {arquivo.filename}\n"
            "Para extrair o conteúdo, instale Ollama com modelo multimodal "
            "(llava ou gemma3) ou Tesseract OCR e reindexe a base."
        )
```

Resultado: a imagem sempre entra no manifesto. O campo `"aviso"` na resposta informa o frontend que a extração foi parcial.

Resposta de sucesso com aviso:
```json
{
  "ok": true,
  "id": "f5048ad8",
  "nome": "foto.png",
  "chars": 216,
  "aviso": "Nenhum extrator de imagem disponível..."
}
```

---

### Frontend

#### `RepositorioTab.jsx`

**Drag and drop — implementação completa:**

- O componente raiz (`<div className="space-y-4">`) captura eventos `onDragOver` / `onDrop`
- Arrastar qualquer arquivo sobre o repositório (mesmo sem o painel aberto) abre automaticamente o painel em modo "Upload de arquivo"
- A drop zone interna (`dropRef`) tem feedback visual independente: borda colorida + scale leve quando o arquivo está sendo arrastado sobre ela
- Arquivos de tipo não aceito soltos na zona exibem mensagem de erro inline (não fecha o painel)
- Upload automático ao soltar um arquivo válido diretamente na drop zone

**Drop zone melhorada:**
- Quando nenhum arquivo selecionado: instrução "Arraste e solte ou clique para selecionar" + lista de tipos suportados com emojis (📄 🖼️ 🎵)
- Quando arquivo selecionado: exibe nome, tamanho em KB, emoji do tipo e "Clique para trocar"
- Estado `dragging` controla a aparência visual da zona (borda primária + escala)

**Tratamento de resposta de upload:**
```jsx
if (data?.error) {
  setUploadAviso(data.message); // vermelho — falha real
} else {
  if (data?.aviso) {
    setUploadAviso('⚠️ Imagem registrada...'); // amarelo — aviso informativo
  }
  reload();
  setFile(null);
  setShowAdd(false);
}
```

#### `App.jsx`

Alert do repositório atualizado (linha 1303):

> _"Use **+ Adicionar** ou **arraste e solte** para incluir PDFs, Word, Markdown, imagens (PNG, JPG, WEBP) ou áudios (MP3, WAV)."_

---

---

## Commit `0c3fced` — Relatório filtros/views/aba + busca avançada repositório + export Pro docx/xlsx/pdf + drive disconnect + chat textarea

**Data:** 17/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Sprint com quatro linhas de entrega independentes: melhorias no relatório de extração, busca full-text no repositório com injeção de contexto no chat, novos formatos de export Pro, e correções de UX (textarea, Drive disconnect).

---

### Backend

#### `tusab_engine/api/router_status.py`

**`POST /drive-disconnect`**
Remove `token.json` de `DADOS_DIR/config/` — efetivamente desconecta o Drive sem revogar o OAuth no Google. O token pode ser regenerado fazendo login novamente.

#### `tusab_engine/api/router_repositorio.py`

**`POST /cerebro/buscar`**

Busca full-text recursiva em todos os arquivos `.txt` de `CEREBRO_DIR` (exceto arquivos `_`-prefixados).

Request:
```json
{ "query": "string", "canal": "string (opcional)" }
```

Response:
```json
{
  "resultados": [
    {
      "arquivo": "nome.txt",
      "caminho": "canal/youtube/nome.txt",
      "trecho": "...contexto ao redor do match...",
      "canal": "nome_do_canal",
      "tipo": "youtube | documento | texto"
    }
  ],
  "total": 5,
  "query": "termo buscado"
}
```

Detalhes de implementação:
- Trecho: ±80 chars antes e ±120 chars depois do primeiro match, newlines achatados, ellipsis nos extremos truncados
- Limite de 20 resultados com early-stop no `os.walk`
- Filtro por canal: restringe a busca ao subdiretório correspondente quando `canal` é informado

#### `tusab_engine/api/router_exports.py`

Três novos endpoints com importação lazy de dependências (não exige as libs instaladas para carregar o módulo):

**`POST /export/resumo-canal`**
- Body: `{ canal_nome: str }`
- Gera `.docx` com python-docx: título, subtítulo, data, e todas as respostas do agente como parágrafos formatados com fontes listadas como bullets
- Retorna `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**`POST /export/tabela-videos`**
- Body: `{ canal: str }`
- Lê `{canal}_base.csv` e gera `.xlsx` com openpyxl: cabeçalho bold, row freeze, larguras automáticas
- Sheet name: `@{canal}` (max 31 chars per Excel spec)
- Retorna `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**`POST /export/relatorio-pdf`**
- Body: `{ canal_nome: str }`
- Gera `.pdf` com reportlab platypus: pares Q&A com pergunta bold e fontes indentadas
- Retorna `application/pdf`

Todos retornam JSON de erro se dependência ausente (mensagem inclui o comando `pip install` correto) ou se não há histórico disponível.

---

### Frontend

#### `RelatorioTab.jsx`

Filtros dinâmicos adicionados ao relatório de extração:

| Filtro | Comportamento |
|--------|--------------|
| Busca por título | Input com debounce, filtro em tempo real, botão limpar |
| Status | Tabs: Todos / Extraídos / Sem Legenda / Leg. curta |
| Aba | Tabs dinâmicas geradas a partir das abas presentes nos dados; só aparece quando há mais de uma aba |

Contador de resultados com feedback ativo: `"X de Y vídeos para 'busca'"`.

Novas colunas na tabela:
| Coluna | Fonte no CSV | Formato |
|--------|-------------|---------|
| **Views** | `v.Views` | `1.2M`, `450K`, `—` para zero/nulo |
| **Aba** | `v.Aba` | badge; playlists com prefixo `▶` |

#### `RepositorioTab.jsx`

**Busca avançada full-text:**
- Botão "Buscar" no header (visível quando `total > 0`) abre painel collapsível
- Campo de busca → `POST /cerebro/buscar` → lista de resultados com arquivo, canal, tipo e trecho
- Botão **"+ Usar no chat"** chama `onInjetarContexto(trecho, arquivo)`:
  - Injeta `[Trecho de "arquivo.txt"]:\n{trecho}` no `chatInput` (concatena se já há texto)
  - Abre o `ChatDrawer`
- Experiência idêntica ao "Adicionar contexto" do VS Code — o usuário encontra o trecho exato e o leva para a conversa

Nova prop: `onInjetarContexto(trecho: string, arquivo: string) → void`

#### `ChatDrawer.jsx`

Input convertido de `<input type="text">` para `<textarea>` com auto-resize:
- `rows={1}` como base; `useEffect` ajusta `height` para `min(scrollHeight, 120px)` a cada mudança do `chatInput`
- `resize: none; overflow: hidden` — sem barra de scroll visível
- `Enter` envia (com `e.preventDefault()` para não adicionar newline); `Shift+Enter` insere nova linha
- Botão de envio com `shrink-0` para não comprimir quando textarea cresce

#### `SidebarContent.jsx — DriveToggle`

- Nova prop `onDisconnect?: () => void`
- `toggleDisabled` removeu a condição `driveStatus === 'autenticado'` — toggle agora clicável quando conectado
- `handleToggle`: quando `driveStatus === 'autenticado'`, chama `onDisconnect?.()` em vez de `onAuth()`

#### `App.jsx`

- `handleDriveDisconnect`: chama `disconnectDrive()` e passa como `onDisconnect` ao `DriveToggle` do Repositório
- `onInjetarContexto` passado ao `RepositorioTab`
- Seção Export Pro expandida com três novos botões (docx / xlsx / pdf) abaixo do botão MD existente
- Imports adicionados: `disconnectDrive`, `exportResumoCanalDocx`, `exportTabelaVideosXlsx`, `exportRelatorioPdf`, `buscarBase`

#### `services/api.js`

```js
export const disconnectDrive        = () => axios.post(`${API_BASE}/drive-disconnect`);
export const buscarBase             = (query, canal) => axios.post(`${API_BASE}/cerebro/buscar`, { query, canal });
export const exportResumoCanalDocx  = (canal_nome) => fetch(`.../export/resumo-canal`, { ... });
export const exportTabelaVideosXlsx = (canal)      => fetch(`.../export/tabela-videos`, { ... });
export const exportRelatorioPdf     = (canal_nome) => fetch(`.../export/relatorio-pdf`, { ... });
```

---

## Estado atual dos testes

| Suite | Resultado |
|-------|-----------|
| `pytest tests/ -v` (23 testes) | ✅ 23/23 verde |
| Smoke test pre-commit (15 checks) | ✅ 15/15 verde |

**Smoke test — checks cobertos:**
- yt-dlp funcionando (3 vídeos reais mapeados)
- `/status`, `/history`, `/repositorio` respondendo com schema correto
- `/queue`, `/queue/add` (URL válida e inválida), `/queue/clear`
- `/agent/status`, Ollama rodando
- `/agent/test-key` rejeita chave inválida
- `/agent/config` não expõe chave em claro
- `/agent/chat` retorna erro orientado para canal sem índice
- `/` serve `index.html`
- Path traversal bloqueado (fallback seguro)

---

## Arquitetura de features Pro — diagrama de decisão

```
Usuário toca feature Pro
        │
        ▼
Feature funciona? ──── SIM ──► Executa normalmente
        │                      + ProSnackbar informativo
        │                        ("Feature Pro — fique de olho")
       NÃO
        │
        ▼
   Retorna erro
  com prefixo         Frontend detecta "PRO_LIMIT:"
  "PRO_LIMIT:"  ────► ProSnackbar em vez de erro genérico
```

A checagem de licença real (Lemon Squeezy) ainda não está implementada — isso é M2 no backlog.
Na v1.0, o `config.get('pro', False)` sempre retorna `False` (nenhum usuário tem Pro ativo).
O limite de 2 canais está ativo; os exports e demais features simplesmente funcionam para todos
enquanto o sistema de licença não é lançado.

---

*Para o histórico de decisões de produto, ver `Gaps e To-Dos — v1.0.md` e `Modelo de negócio.txt`.*
*Para a arquitetura modular completa, ver `Blueprint de Modularização.md`.*

---

## v1.0.0 — Sprint de lançamento completo

**Data:** Junho 2026 (até 19/06/2026)
**Escopo:** Backend + Frontend + Electron + Testes + Documentação
**Branch:** main

Esta seção consolida todas as entregas da sprint de lançamento que não estavam registradas nos commits anteriores.

---

### Modularização — `tusab_engine/`

Refatoração completa do monolito (`api_Tusab.py` + `motor_Tusab.py` + `agent_Tusab.py`) para pacote estruturado em 9 módulos com separação limpa de responsabilidades:

```
tusab_engine/
  api/
    router_status.py        ← GET /status, /drive-auth, /history, /open-folder
    router_extraction.py    ← POST /set-channel, /start, /pause, /cancel, /queue/*
    router_agent.py         ← /agent/* (chat, config, index, ollama, stream)
    router_repositorio.py   ← /repositorio, /relatorio, /neural/*, /reset-total
    router_exports.py       ← /export/* (zip, markdown, docx, xlsx, pdf)
  motor/
    drive.py                ← OAuth2 Google Drive + upload
    extraction.py           ← engine principal (tusab_engine), relatórios
  agent/
    config.py               ← carregar/salvar agent_config.json
    index.py                ← BM25 indexing + cache
    chat.py                 ← RAG chat + streaming
  state.py                  ← AppState singleton + LogRedirector
  storage.py                ← paths de dados + IO atômico
```

Shims de compatibilidade na raiz (`motor_tusab.py`, `agent_tusab.py`) garantem zero breaking change para Electron e código legado.

Regra de dependência acíclica: `api → agent | motor → storage`. Nunca o contrário.

---

### Suite de testes — 27/27 verde

**`tests/conftest.py`**
Fixture central: `TUSAB_DATA_DIR` apontada para `tempdir` antes de qualquer import — garante isolamento total entre testes.

**`tests/test_api.py`** (integração, TestClient FastAPI)
Cobre rotas: `/neural/upload`, `/neural/texto`, `/neural/arquivo/{tipo}/{fid}`, `/queue/add`, `/queue/clear`, `/queue`, `/agent/config`, `/agent/index`, `/agent/test-key`, `/agent/chat`, `/agent/chat/stream`, `/agent/chat/clear`, `/repositorio`, `/relatorio/{canal}`, `/reset-total`.

**`tests/test_confiabilidade.py`**
Testa: escrita atômica (`salvar_csv_atomico`, `salvar_json_atomico`), concorrência com múltiplas threads escrevendo simultaneamente, recovery de índice corrompido (JSON inválido detectado e deletado), comportamento com base vazia.

**Smoke tests — 15/15 verde** (pre-commit hook `smoke_test.py`)
Checks contra backend real em porta 8001:
- yt-dlp funcionando (3 vídeos reais mapeados)
- `/status`, `/history`, `/repositorio` com schema correto
- `/queue`, `/queue/add` (URL válida e inválida), `/queue/clear`
- `/agent/status`, Ollama respondendo
- `/agent/test-key` rejeita chave inválida
- `/agent/config` não expõe chave em claro
- `/agent/chat` retorna erro orientado para canal sem índice
- `/` serve `index.html`
- Path traversal bloqueado (fallback seguro)

---

### Segurança — 12 fixes aplicados

Dois sprints de segurança em junho 2026. Fixes ①–⑤ na primeira rodada (CORS, yt-dlp playlist ID, upload size, path traversal no delete, dangerouslySetInnerHTML). Fixes ⑧–⑫ na segunda rodada (path traversal no serve_static, prompt injection, Drive query injection, URL YouTube regex, histórico do chat server-side). Fix ⑥ implementado separadamente (keychain via safeStorage). Fix ⑦ aplicado em todos os modelos Pydantic. Ver `Segurança.txt` para detalhes completos de cada fix.

---

### UX — entregas da sprint

**HomeScreen com cards de navegação**
Cards com dados reais (número de vídeos extraídos, status do agente, último canal). Badges contextuais. Layout responsivo: mobile drawer, tablet rail, desktop split.

**Modal de indexação no Repositório (showIndexar)**
Botão "Indexar base" no header do Repositório abre modal com checkboxes por projeto. Usuário seleciona quais projetos reindexar. Prop `onAbrirIndexacaoRepositorio` permite acionar o modal diretamente do chat (botão "Indexar base agora" na mensagem de sem_contexto).

**Reset total corrigido**
`DELETE /reset-total` limpa arquivos, índices e histórico de chat. Campo de confirmação case-sensitive (`RESETAR`). Extração em andamento cancelada antes do reset.

**Cancelamento com limpeza de fila**
`POST /cancel` cancela a extração atual e limpa `state.extraction_queue`. Botão "Limpar fila" na UI afeta apenas canais aguardando, não o que está rodando.

**GuideModal — atalhos de teclado**
Modal de guia de uso com 6 passos. Acessível via botão Ajuda no sidebar. Focus trap + Escape para fechar.

**Sub-aba Periodicidade (ExtractionModal)**
Estrutura de modal em etapas: URL → Projeto → Fontes. Quando há extração em andamento, o modal abre em 3 etapas para enfileirar novo canal com projeto próprio.

**Textarea no chat com auto-resize**
Input do ChatDrawer migrado de `<input type="text">` para `<textarea>`. `Enter` envia, `Shift+Enter` quebra linha. Auto-resize até 120px. Integra injeção de contexto do repositório.

---

### Chat stats persistentes (`_chat_stats.json`)

`registrar_primeiro_uso()` em `config.py` grava timestamp de primeiro uso. `/agent/status` retorna `dias_desde_install` e `retencao_dia`. App.jsx dispara `Analytics.retencaoDia()` ao detectar nova marca (idempotente — marcas `retencao_diaX_registrado` em `config.json`).

Perguntas sugeridas: `_gerar_perguntas_sugeridas()` gera 3 perguntas dos títulos indexados, armazenadas em `state.perguntas_sugeridas`. ChatDrawer exibe chips clicáveis no empty state após indexação bem-sucedida.

---

### Banner ASCII no startup

`api_tusab.py` exibe no startup:

```
████████╗██╗   ██╗███████╗ █████╗ ██████╗
╚══██╔══╝██║   ██║██╔════╝██╔══██╗██╔══██╗
   ██║   ██║   ██║███████╗███████║██████╔╝
   ██║   ██║   ██║╚════██║██╔══██║██╔══██╗
   ██║   ╚██████╔╝███████║██║  ██║██████╔╝
   ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝
INDEX · AUGMENT · CONVERSE
```

Seguido de versão, data e status de inicialização de cada módulo.

---

### Exports liberados (sem paywall)

Em junho 2026, a decisão de modelo de negócio removeu o paywall. Todos os endpoints de export funcionam para todos os usuários:
- `POST /export/base` — ZIP de `cerebro/` + `gestao/`
- `POST /export/historico` — Markdown do histórico de chat
- `POST /export/resumo-canal` — DOCX com Q&A do canal
- `POST /export/tabela-videos` — XLSX com tabela de vídeos
- `POST /export/relatorio-pdf` — PDF com Q&A formatado

O `config.get('pro', False)` retorna `False` para todos — nenhum usuário tem Pro ativo. O limite de 2 canais em `indexar()` permanece no código mas inativo na prática. A infraestrutura de feature flags está pronta para ativar quando o modelo de negócio for decidido.

---

### Empacotamento Windows

Build de produção para Windows:
- Python 3.12 embeddable (Win x64) bundled em `python_env/`
- yt-dlp binário bundled (sem dependência de PATH)
- Instalador NSIS via electron-builder
- `electron-updater` configurado para auto-update via GitHub Releases
- `TUSAB_DATA_DIR` aponta para `%AppData%\Tusab\data\` no Electron packaged

---

### Estado consolidado dos testes (19/06/2026)

| Suite | Resultado |
|-------|-----------|
| `pytest tests/ -v` (27 testes) | ✅ 27/27 verde |
| Smoke test pre-commit (15 checks) | ✅ 15/15 verde |

---

*Para a arquitetura modular completa, ver `Blueprint de Modularização.md`.*
*Para as decisões estratégicas que guiaram a sprint, ver `Decisões de Produto.md`.*

---

## Commit `355a6ea` — Modularização do App.jsx + correções de UX

**Data:** 22/06/2026
**Escopo:** Frontend
**Branch:** main

### Contexto

`App.jsx` havia crescido para ~2.385 linhas ao longo da sprint de lançamento — acumulando JSX de modais, abas e lógica de orquestração no mesmo arquivo. A modularização foi executada com cautela total sobre dependências entre componentes, preservando todos os fluxos existentes sem breaking changes.

---

### Frontend

#### Componentes extraídos do App.jsx

**7 novos arquivos criados:**

| Componente | Origem (linhas App.jsx) | Responsabilidade |
|---|---|---|
| `components/modals/CancelQueueModal.jsx` | 776–837 | Modal de cancelamento com fila pendente — opções "cancelar e continuar fila" vs "cancelar e limpar fila" |
| `components/modals/ResetModal.jsx` | 841–930 | Modal de reset total — estado interno `confirmText`/`resetando`; `onResetDone` callback para App.jsx limpar seu próprio estado |
| `components/modals/QueueManagerModal.jsx` | 944–1039 | Gerência de fila de extração — reordenação e remoção individual via `queueMoveItem`/`queueRemoveItem` |
| `components/extraction/ExtractionTab.jsx` | 1288–1799 (~512 linhas) | Sub-abas Extrair / Relatório / Auto-Update com toda a lógica de canal, log, progress bar e histórico |
| `components/tabs/AgentTab.jsx` | 1937–2173 | Configuração de provider, API key, Ollama, personas |
| `components/tabs/AdminTab.jsx` | 2176–2273 | Telemetria, privacidade, limpeza de base, suporte |

**Resultado:** App.jsx de **2.385 → 1.431 linhas** (redução de 40%).

#### Padrão de props usado

Todos os componentes recebem estado e handlers como props explícitas do App.jsx — sem Context API, sem estado compartilhado lateral. Componentes com lógica própria encapsulam o estado que não precisa subir:
- `ResetModal`: `confirmText` e `resetando` são internos; `onResetDone` dispara o cleanup no App.jsx
- `QueueManagerModal`: `handleMover`/`handleRemover` chamam a API diretamente
- `ExtractionTab`: importa `setChannel`/`openFolder`/`saveAutoUpdateConfig` da API diretamente para o histórico e Auto-Update

#### `App.jsx`

Imports removidos (mortos após extração):
- `acceptAnalytics`, `declineAnalytics` (movidos para AdminTab)
- `PrivacidadeRede` (movido para AdminTab)
- Estados `resetConfirmText` e `resetando` (internalizados no ResetModal)

---

### Correções de UX incluídas no mesmo commit

#### Toast de indexação — reaparecia ao fechar

**Causa:** o `useEffect` que dispara o toast usava `!indexing && index_logs.length > 0` como condição — re-executava a cada polling enquanto `index_logs` permanecia preenchido, reabrindo o toast depois de o usuário fechá-lo.

**Fix:** adicionado `prevIndexingRef` para detectar a transição `true → false`. O toast só é disparado uma vez por ciclo de indexação.

```js
const wasIndexing = prevIndexingRef.current;
prevIndexingRef.current = agentStatus.indexing;
if (!wasIndexing || agentStatus.indexing) return; // só na borda de descida
```

Proteção dupla: o toast também não é colocado no estado quando `showHome` ou `showLanding` são `true`, e não renderiza mesmo que esteja no estado.

#### Toast não aparece na HomeScreen / LandingScreen

`progressToast` agora tem duas camadas de proteção:
1. **Não entra no estado** se `showHome` ou `showLanding` estiver ativo no momento da indexação
2. **Não renderiza** (`AnimatePresence` condicionado a `!showHome && !showLanding`)

Ao clicar no logo para voltar à home, `setProgressToast(null)` é chamado explicitamente.

#### ExtractionModal — não pede URL quando canal já configurado

**Causa histórica:** o modal pulava o step 1 se `canalUrlInicial` viesse preenchido — mas `canalUrlInicial` dependia de `canalInput || status.canal_url`, que podia estar vazio quando o canal era restaurado pelo polling sem URL gravada.

**Decisão de produto:** o usuário deve sempre confirmar o canal antes de extrair. Modal agora abre invariavelmente no step 1 com campo vazio. A URL não é pré-preenchida.

```js
// Antes
const stepInicial = !modoFila && canalUrlInicial ? 3 : 1;
// Depois
const [step, setStep] = React.useState(1);
const [canalUrl, setCanalUrl] = React.useState('');
```

#### Scroll da aba Extração travava ao cancelar/pausar

**Causa:** `handleCancel` e `handlePause` chamavam `logSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })` — isso empurrava o log para o topo da viewport, tornando o resto do conteúdo inacessível.

**Fix:** removidos os `scrollIntoView` de ambos os handlers.

**Fix complementar:** o container raiz do `ExtractionTab` tinha `overflow-y-auto` aninhado com o container interno da sub-aba (que também tinha `overflow-y-auto`), criando scroll dentro de scroll. Container raiz alterado para `overflow-hidden`.

---

### Estado dos testes (22/06/2026)

| Suite | Resultado |
|---|---|
| `pytest tests/ -v` (27 testes) | ✅ 27/27 verde |
| Smoke test pre-commit (15 checks) | ✅ 15/15 verde |

---

## Sprint 22/06/2026 — Action bar no chat + UX de bases + split card de extração + fixes de canal

**Data:** 22/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Sprint com foco em experiência de uso: ações diretas nas mensagens do chat, visibilidade do estado das bases indexadas, seleção ágil de canais extraídos e correção de regressões na configuração de canal entre sessões.

---

### Backend

#### `tusab_engine/api/router_status.py`

**Mascaramento de `canal_nome` quando idle:**
Quando `state.is_running` é `False`, o snapshot retornado ao frontend agora inclui `stats_snapshot["canal_nome"] = ""`. Isso evita que o polling restaure o canal automaticamente após o app ser reaberto — o frontend só deve restaurar canal se uma extração estiver de fato em andamento.

#### `tusab_engine/api/router_agent.py`

**Novo campo `bases_desatualizadas` em `GET /agent/status`:**

```python
def _bases_com_arquivos_novos(canais_indexados: list) -> list[str]:
    """Retorna nomes de canais cujos arquivos em disco são mais recentes que o índice BM25."""
```

Para cada canal indexado, compara `os.path.getmtime(arquivo)` com o `indexed_at` do índice. Se qualquer arquivo em `documents/`, `texts/` ou `youtube/` for mais novo que o índice, o canal entra na lista `bases_desatualizadas`.

O campo é incluído na resposta de `/agent/status`:
```json
{ "bases_desatualizadas": ["canal_a", "canal_b"] }
```

#### `tusab_engine/motor/extraction.py`

**Fix `files_generated` — primeiro arquivo não contabilizado:**

O `LogRedirector` em `state.py` detecta o emoji `📂` nos prints do motor para incrementar `files_generated`. O print com `📂` só era emitido na transição entre partes da extração — o primeiro arquivo criado na sessão não disparava o print.

Fix: adicionado print ao criar arquivo novo:

```python
file_is_new = not os.path.exists(caminho_txt)
if file_is_new:
    print(f"      📂 NOVO ARQUIVO: {nome_arquivo_base}.txt criado.")
```

**Cache de meta-canal com TTL de 7 dias:**

`coletar_meta_canal()` fazia chamada ao yt-dlp toda vez que uma extração era iniciada, mesmo para canais já extraídos. Agora persiste os metadados em `_meta.json` no diretório do canal e reutiliza os dados em extrações seguintes dentro de 7 dias:

```python
_META_CACHE_TTL_DIAS = 7

# No início de coletar_meta_canal():
if os.path.exists(meta_path):
    idade_dias = (_time.time() - os.path.getmtime(meta_path)) / 86400
    if idade_dias < _META_CACHE_TTL_DIAS:
        with open(meta_path, encoding='utf-8') as f:
            meta = json.load(f)
        print(f"      📋 Canal: {meta.get('nome')} (cache)")
        return meta
```

O TTL é verificado via `os.path.getmtime` — sem dependência de timestamp interno no JSON.

---

### Frontend

#### `web_interface/src/components/chat/ChatDrawer.jsx`

**Action bar em mensagens do assistente:**

Após cada mensagem do assistente (quando não está em streaming), aparece uma barra de ações discreta:

| Botão | Ação | Condição |
|---|---|---|
| Copiar | Copia texto + fontes para a área de transferência | Sempre visível |
| Doc | `exportResumoCanalDocx` — baixa DOCX com Q&A | Sempre visível |
| PDF | `exportRelatorioPdf` — baixa PDF com Q&A | Sempre visível |
| Planilha | `exportTabelaVideosXlsx` — baixa XLSX da tabela | Só se `detectaLista(content)` |

`detectaLista` detecta listas Markdown (`- item`, `1. item`) e tabelas (`| col |`) no conteúdo da mensagem — evita oferecer exportação de planilha para mensagens sem estrutura tabular.

Feedback de cópia: ícone `Check` substitui `Copy` por 1.5s após copiar com sucesso.

**Chips de bases ativas no empty state:**

Quando há bases selecionadas (`canalAtivo` + `canaisExtras`), o empty state do chat exibe chips para cada base ativa. Bases não indexadas aparecem com badge de aviso `⚠️`; bases indexadas com arquivos mais novos que o índice exibem banner amarelo "Arquivos novos detectados".

```jsx
const todasAtivas = [canalAtivo, ...(canaisExtras || [])].filter(Boolean);
const nomesIndexados = new Set(canaisIndexados.map(c => c.nome));
const desatualizadas = new Set(agentStatus.bases_desatualizadas || []);
const naoIndexadas = todasAtivas.filter(n => !nomesIndexados.has(n));
const comArquivosNovos = todasAtivas.filter(n => desatualizadas.has(n));
```

#### `web_interface/src/components/agent/RepositorioTab.jsx`

**Ordem das abas de upload:**

Aba "Upload de arquivo" movida para primeira posição (era "Colar texto"). Padrão mais esperado: upload de arquivo é o fluxo primário.

```js
// Antes
const [mode, setMode] = useState('texto');
// Depois
const [mode, setMode] = useState('arquivo');
```

#### `web_interface/src/components/extraction/ExtractionTab.jsx`

**Split card quando há histórico de canais:**

Quando `history.length > 0` e nenhum canal está configurado, o card de extração se divide em duas colunas:
- **Esquerda:** input de URL para novo canal
- **Direita:** `<select>` nativo com todos os canais extraídos anteriormente

O select exibe: `@canal · N vídeos · X%` por opção. Ao selecionar, chama `handleUsarCanalHistorico` que configura o canal via `/set-channel` sem abrir a modal. O select reseta para o placeholder após a seleção para permitir re-uso.

Quando não há histórico (`history.length === 0`), o card mantém o layout original com o input de URL apenas.

#### `web_interface/src/App.jsx`

**`handleUsarCanalHistorico`:**

Handler dedicado para configurar canal a partir do histórico:

```js
const handleUsarCanalHistorico = async (canalUrl, canalNomeFallback) => {
  const res = await setChannel(canalUrl);
  if (!res.data.error) {
    canalRemovidoRef.current = false;          // permite que o polling mantenha o canal
    canalConfiguradoNaSessaoRef.current = true;  // habilita o skip do step 1 na modal
    setCanalConfigurado(res.data.canal_nome || canalNomeFallback);
    setCanalInput('');
  }
};
```

**Fix restauração automática de canal:**

O polling de `/status` restaurava `canalConfigurado` sempre que `stats.canal_nome` estava preenchido no backend — mesmo depois de o usuário ter removido o canal manualmente ou após um reload sem extração ativa.

Fix: adicionada condição `&& res.data.is_running` ao guard do polling:

```js
// Antes
if (res.data.stats?.canal_nome && !canalConfigurado && !canalRemovidoRef.current)
// Depois
if (res.data.stats?.canal_nome && !canalConfigurado && !canalRemovidoRef.current && res.data.is_running)
```

Combinado com o mascaramento de `canal_nome` no backend quando idle, o canal agora só é restaurado automaticamente durante uma extração em andamento.

#### `web_interface/src/components/extraction/ExtractionModal.jsx`

**Solução definitiva para skip do step de URL:**

Quando o modal é aberto com um canal já configurado (e não está em modo fila), deve ir direto para o step de fontes sem passar pela URL. Correção em dois pontos:

```js
const canalJaConfigurado = !!canalNome && !modoFila;
const totalSteps = modoFila ? 3 : canalJaConfigurado ? 1 : 2;
const [step, setStep] = React.useState(canalJaConfigurado ? 3 : 1);
const temVoltar = step !== 1 && !canalJaConfigurado;
```

- `step` inicializa em `3` (fontes) quando canal está configurado
- `temVoltar` nunca é `true` nesse caminho — usuário não pode voltar para o step de URL
- `totalSteps = 1` garante que o indicador de progresso mostre apenas 1 passo

A causa raiz das tentativas anteriores era que `useState(1)` era invariante — qualquer lógica de skip dependia de um `useEffect` posterior, que sempre chegava tarde (depois do render inicial).

---

### Estado dos testes (22/06/2026 — sprint)

| Suite | Resultado |
|---|---|
| `pytest tests/ -v` (27 testes) | ✅ 27/27 verde |
| Smoke test pre-commit (15 checks) | ✅ 15/15 verde |

---

## Commit — Pro hint informativo + seleção de projeto no upload + folder picker + filtro de ruído asyncio

**Data:** 22/06/2026
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Sprint com quatro linhas de entrega:
1. Substituição do bloqueio freemium por modal informativo (hint) após 3+ bases indexadas
2. Correção do estado obsoleto ("Não indexado") após indexação concluída
3. Fluxo completo de seleção/criação de projeto para upload e abertura de pasta
4. Filtro de ruído técnico do asyncio do Windows no log da UI

---

### Backend

#### `tusab_engine/agent/index.py`

Removido o bloqueio hard `PRO_LIMIT` que impedia indexação além de 2 canais no plano free.

**Antes:**
```python
FREE_MAX_CANAIS = 2

# Em indexar():
if not config.get('pro', False):
    existentes = _contar_canais_indexados()
    if canal_nome not in existentes and len(existentes) >= FREE_MAX_CANAIS:
        raise ValueError("PRO_LIMIT:Você já tem N canais indexados...")
```

**Depois:**
```python
PRO_HINT_THRESHOLD = 3
# indexar() inicia diretamente sem verificação de limite
```

A constante `_contar_canais_indexados()` foi mantida — é usada pelo router para disparar o hint.

#### `tusab_engine/state.py`

Adicionado flag ao `AppState`:
```python
self.pro_hint: bool = False  # True quando >= PRO_HINT_THRESHOLD bases indexadas; reset após leitura
```

Adicionado filtro no `LogRedirector.write()` para suprimir ruído asyncio do Windows:
```python
asyncio_noise = [
    "WinError 10054", "ConnectionResetError", "_ProactorBasePipeTransport",
    "_call_connection_lost", "asyncio\\events.py", "Exception in callback",
]
if any(k in clean for k in asyncio_noise):
    return
```

O erro `[WinError 10054]` ocorre quando o cliente fecha a conexão (aba fechada, streaming cancelado) — é inofensivo e não indica bug. Continua registrado no stderr do processo, mas não polui o log da UI.

#### `tusab_engine/api/router_agent.py`

Em `_run_indexacao`, após indexação bem-sucedida:
```python
from agent_tusab import _contar_canais_indexados, PRO_HINT_THRESHOLD
if len(_contar_canais_indexados()) >= PRO_HINT_THRESHOLD:
    state.pro_hint = True
```

Em `GET /agent/status`, o flag é consumido (one-shot) e resetado:
```python
status["pro_hint"] = state.pro_hint
if state.pro_hint:
    state.pro_hint = False
```

---

### Frontend

#### `web_interface/src/components/modals/ProHintModal.jsx` (novo)

Modal informativo exibido uma vez por sessão quando o usuário indexa 3 ou mais bases.

- Ícone Sparkles (âmbar), sem bloqueio de fluxo
- Lista features do plano Pro: bases ilimitadas, busca avançada com reranking semântico, sincronização automática com Google Drive
- CTA único: "Entendido, continuar usando" — fecha a modal
- Chave `sessionStorage`: `tusab_pro_hint_shown` — garante exibição única por sessão

#### `web_interface/src/hooks/useAgentConfig.js`

Extraída e exposta função `refetchAgentStatus`:
```js
const refetchAgentStatus = () =>
  fetchAgentStatus().then(r => setAgentStatus(r.data)).catch(() => {});
```

Exposta no return do hook: `agentStatus, setAgentStatus, refetchAgentStatus`.

#### `web_interface/src/App.jsx`

**Correção "Não indexado" após indexação:**

Adicionada chamada imediata a `refetchAgentStatus()` na transição `indexing true → false`:
```js
useEffect(() => {
  if (!agentStatus.indexing && prevIndexing.current) {
    refetchAgentStatus();  // evita esperar 3s do poll para atualizar canais_indexados
  }
  prevIndexing.current = agentStatus.indexing;
}, [agentStatus.indexing]);
```

**Pro hint:**
```js
useEffect(() => {
  if (agentStatus.pro_hint && !sessionStorage.getItem('tusab_pro_hint_shown')) {
    setShowProHint(true);
    sessionStorage.setItem('tusab_pro_hint_shown', '1');
  }
}, [agentStatus.pro_hint]);
```

**Folder picker sem projeto selecionado:**

Quando o usuário clica "Abrir pasta do projeto" sem ter um projeto ativo, abre um picker que:
- Lista projetos existentes a partir de `repositorio.canais` + `history` (deduplicado)
- Se não há projetos, exibe formulário "Criar primeiro projeto" inline

Após criar um projeto via picker:
```js
const handleFolderPickerCriar = async () => {
  const res = await criarProjeto(folderPickerNovoProjeto.trim());
  if (res.data?.ok) {
    openFolder('canal_youtube', nomeCriado);    // abre a pasta do projeto novo
    setRepoProjetoInicial(nomeCriado);          // pré-seleciona no modal de upload
    setRepoAddOpen(true);                       // abre modal de upload automaticamente
    setActiveTab('repositorio');
  }
};
```

Prop `projetoInicial` passada ao `RepositorioTab` para pré-selecionar o projeto recém-criado.

#### `web_interface/src/components/agent/RepositorioTab.jsx`

**Seleção de projeto no modal de upload:**

Quando nenhum projeto/canal está ativo (`!_canalEfetivo()`), o modal de upload exibe uma etapa de seleção de projeto antes de mostrar o formulário de upload.

Lista de projetos disponíveis prioriza `repositorio.canais` (sempre carregado) como fonte primária:
```js
const nomesRepo = (repositorio?.canais || []).map(c => c.nome);
const nomesProjetos = projetos.map(p => typeof p === 'string' ? p : p.nome);
const todos = [...new Set([...nomesRepo, ...nomesProjetos])];
```

Quando projeto já está selecionado, exibe chip com nome e botão "Trocar".

`closeAddModal()` helper garante reset de `projetoSel` e `novoProjNome` ao fechar o modal.

`useEffect` para `projetoInicial` (prop de App.jsx):
```js
React.useEffect(() => {
  if (projetoInicial) {
    setProjetoSel(projetoInicial);
    onProjetoInicialHandled?.();
  }
}, [projetoInicial]);
```

#### `web_interface/src/locales/pt.json`, `en.json`, `es.json`

Adicionadas chaves `proHint.*` nos três idiomas para o ProHintModal.

---

### Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| `PRO_HINT_THRESHOLD = 3` (não 2) | 2 canais é pouco — usuário ainda está explorando; 3 indica uso consistente |
| Flag `pro_hint` one-shot no backend | Evita que o hint reapareça em cada poll de 3s; estado consumido uma vez e resetado |
| `refetchAgentStatus()` imediato | Sem isso, UI mostra "Não indexado" por até 3s após indexação concluída (lag do poll) |
| `repositorio.canais` como fonte primária | `projetos` só é carregado ao abrir `openIndexar`; `repositorio.canais` está sempre disponível no estado App |
| `closeAddModal()` helper | Resetar apenas `setShowAdd(false)` deixava `projetoSel` e `novoProjNome` com valores obsoletos na reabertura |
| Filtro asyncio no `LogRedirector` | Suppressão na camada de redirect (antes de entrar nos logs) — zero custo em produção, sem alterar o event loop do asyncio |

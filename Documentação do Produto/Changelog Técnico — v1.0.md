# Changelog Técnico — Tusab v1.0
© 2026 CriAugu — CNPJ 65.131.075/0001-57
Atualizado: Junho 2026

Documento de referência das modificações implementadas na sprint de lançamento da v1.0.
Organizado por commit, do mais antigo ao mais recente.

---

## Sprint 25/06/2026 — v1.0.6: instalador multilíngue, versão dinâmica, UX do Ollama sem modelo

**Versão:** v1.0.6
**Escopo:** Electron + Frontend
**Branch:** main

### Contexto

Sprint de qualidade e distribuição em três frentes:
1. **Instalador multilíngue** — NSIS detecta o idioma do Windows e exibe PT/EN/ES
2. **Valores dinâmicos** — versão, ano de copyright, CNPJ e e-mail injetados em build-time; nunca desincronizam
3. **UX Ollama sem modelo** — chat bloqueado com aviso claro quando Ollama está rodando mas sem modelo baixado

---

### Electron / NSIS

#### Feat: instalador em 3 idiomas (PT / EN / ES)

`electron/build_resources/installer.nsh` reescrito com `LangString` para os IDs de idioma Windows:
- `1046` (Português Brasil), `1033` (Inglês), `3082` (Espanhol Internacional)

O instalador detecta o idioma do Windows automaticamente. Todas as mensagens são localizadas:
pergunta de instalação do Ollama, caption e banner de download, mensagens de sucesso e erro.

`electron/package.json` atualizado:
```json
"installerLanguages": ["PortugueseBR", "English", "SpanishInternational"],
"language": "1046"
```
O seletor de idioma aparece na primeira tela do instalador; PT é o padrão.

#### Fix: `build.publish` apontava para repo privado

`"repo": "tusab"` → `"repo": "tusab-public"` — o `electron-updater` agora verifica releases no repo público, acessível por todos os usuários sem autenticação GitHub.

---

### Frontend

#### Fix: versão, ano, CNPJ e e-mail hardcoded

`vite.config.js` — 4 novas variáveis injetadas em build-time:

```js
define: {
  __APP_VERSION__:   JSON.stringify(electronPkg.version),    // já existia
  __APP_YEAR__:      JSON.stringify(new Date().getFullYear()),
  __SUPPORT_EMAIL__: JSON.stringify('tusab@tusab.solutions'),
  __CNPJ__:          JSON.stringify('65.131.075/0001-57'),
}
```

Usadas em:
- `App.jsx` — versão no nav lateral: `v{__APP_VERSION__}` (já estava)
- `AdminTab.jsx` — copyright: `© {__APP_YEAR__} CriAugu — CNPJ {__CNPJ__}`
- `AdminTab.jsx` — e-mail de suporte: `{__SUPPORT_EMAIL__}` (corrigido typo `sollution` → `solutions`)
- `SidebarContent.jsx` — copyright: `© {__APP_YEAR__} CriAugu`

A partir de agora, bump de versão em `electron/package.json` atualiza automaticamente nav lateral, AdminTab e SidebarContent. Virada de ano atualiza o copyright sozinho no próximo build.

#### Fix: chip "✓ ativo" no OllamaSetup aparecia sem modelo instalado

`OllamaSetup.jsx` — `modelName` tinha fallback `'llama3.2:1b'` mesmo quando `ollamaStatus.models` estava vazio:

```js
// Antes — poderia gerar chip "ativo" sem modelo instalado
const modelName = ollamaStatus.running
  ? (ollamaModel || (hasModel ? ollamaStatus.models[0] : 'llama3.2:1b'))
  : null;

// Depois — modelName só existe se Ollama está rodando E há modelo instalado
const modelName = (ollamaStatus.running && hasModel)
  ? (ollamaModel && ollamaStatus.models.includes(ollamaModel) ? ollamaModel : ollamaStatus.models[0])
  : null;
```

Também garante que o modelo configurado pelo usuário exista na lista — se foi desinstalado, usa o primeiro disponível.

#### Feat: chat bloqueado quando Ollama rodando sem modelo

Nova variável derivada:
```js
const ollamaSemModelo = agentProvider === 'ollama' && ollamaStatus?.running && !(ollamaStatus?.models?.length > 0);
```

Comportamento quando `ollamaSemModelo = true`:
- **Tela vazia:** estado dedicado com ícone, título e instrução para ir à aba Agente
- **Banner acima do textarea:** aviso inline persistente
- **Textarea desabilitado** com placeholder `"Baixe um modelo na aba Agente para conversar…"`
- **Botão de envio desabilitado** — impossível enviar e receber apenas fontes sem resposta gerada

Strings adicionadas em `pt.json`, `en.json`, `es.json`:
- `chat.ollama_no_model_title` / `body` / `banner` / `placeholder`

---

### Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| IDs numéricos NSIS (`1046`/`1033`/`3082`) em vez de nomes | electron-builder aceita nomes como `"PortugueseBR"`, mas os `LangString` do NSIS usam IDs de locale do Windows diretamente — os dois sistemas são independentes |
| `build.publish` → repo público | `electron-updater` fazia requisição autenticada ao repo privado; usuários sem conta GitHub ou sem acesso ao repo não conseguiam verificar atualizações |
| `__APP_YEAR__` via `new Date()` no `vite.config.js` | O ano é calculado no momento do build — correto para releases publicados no mesmo ano. Virada de ano exige apenas um novo build |
| Bloquear envio quando `ollamaSemModelo` | Sem o bloqueio, o usuário enviava uma mensagem, recebia apenas "fontes encontradas" sem resposta do LLM — comportamento confuso e sem diagnóstico claro |

---

## Sprint 25/06/2026 — Estabilidade no empacotado, auto-update in-app, UX do Ollama

**Commits:** `6d75819` · `97fe76d` · `df0a9c1` · `93d52c0` · `9f5aae3` · `cbd0cb7` · `0659d5e`
**Escopo:** Electron + Frontend
**Branch:** main

### Contexto

Sprint focada em resolver erros críticos na instalação em máquinas novas e melhorar
a experiência de configuração do Ollama e notificação de atualizações do app.

---

### Electron / main.js

#### Fix: `ModuleNotFoundError: No module named 'motor_tusab'`

O Python embarcado (`python_env/`) não adiciona o diretório do script ao `sys.path`
automaticamente — diferente do Python instalado no sistema. Isso causava crash
imediato do backend em toda instalação nova.

**Solução em `api_tusab.py`:**
```python
_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)
```

#### Fix: timeout de 20s insuficiente na primeira execução

Na primeira execução, compilação de bytecode de `torch`, `sentence-transformers`
e `fastapi` pode levar 30-60 segundos. Timeout aumentado para 90s com mensagens
progressivas na loading screen.

#### Feat: notificação in-app de nova versão

- `electron-updater` envia `update-available` e `update-downloaded` via IPC
- `preload.js` expõe `onUpdateAvailable`, `onUpdateDownloaded`, `installUpdate`
- Banner animado no rodapé ao detectar update
- Badge laranja na aba Admin da sidebar
- Card de destaque na AdminTab com botão "Instalar e reiniciar agora"

#### Feat: hook NSIS para instalar Ollama durante setup

`electron/build_resources/installer.nsh` detecta `ollama.exe` nas pastas padrão.
Se não encontrado, oferece ao usuário baixar e instalar silenciosamente (~50 MB)
durante a instalação do Tusab.

### Frontend / OllamaSetup.jsx

- Card de status usa **amber** quando Ollama não detectado (não verde — confuso)
- Chip "✓ ativo" só aparece se `ollamaStatus.running && modelo instalado`
- Botões de download desabilitados quando Ollama não está rodando
- **Botão de download direto** do Ollama (`/releases/latest/download/OllamaSetup.exe`)
- Estimativa de tempo restante durante download (baseada em progresso/elapsed)
- Verificação de status antes de tentar pull — exibe alerta se Ollama offline

### loading.html

Tela de loading redesenhada em **preto e branco** (identidade da marca):
- Fundo `#000000`, logo em branco puro, spinner branco
- Grid e pulsos em branco com opacidade baixa
- Sem gradientes violet/blue

---

## Sprint 22/06/2026 — UX de chat, jargão técnico e injeção de trecho

**Commits:** `c48cfa9` · `caaf1e3` · `2860220` · `cfbe5e1` · `fc70c11` · `c6d147d` · `6089b83` · `f7a4edd`
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Sprint de qualidade focada em três frentes:
1. **Robustez do chat** — bug crítico onde trechos injetados do Repositório disparavam "Não encontrei esse tema"
2. **UX do Repositório** — busca por projeto inline, select para seleção de projeto no upload, remoção de card redundante
3. **Limpeza de linguagem** — remoção de jargões técnicos (`yt-dlp`, `BM25`, `Chunks BM25`) da UI visível ao usuário

---

### Backend

#### `tusab_engine/agent/chat.py`

**Bug: trecho injetado causava falso "não encontrei"**

Quando o usuário injetava um trecho do Repositório no chat (formato `[arquivo.txt]\nconteúdo...`), duas falhas encadeadas produziam a resposta errada:

1. O texto longo ia pro BM25 como query — query ruim, podia não retornar contexto relevante
2. Mesmo quando retornava fontes, `_verificar_alucinacao` com threshold `cobertura < 0.20` descartava a resposta porque o LLM usa vocabulário de análise diferente do corpus

**Solução — detecção de trecho injetado:**

```python
_RE_TRECHO_INJETADO = re.compile(r'^\[([^\]]+\.(?:txt|pdf|docx|xlsx|csv|md))\]\s*\n(.+)', re.DOTALL | re.IGNORECASE)

def _extrair_trecho_injetado(pergunta: str):
    m = _RE_TRECHO_INJETADO.match(pergunta.strip())
    if m:
        return m.group(1), m.group(2).strip()
    return None, None
```

Quando detectado, `chat()` e `chat_stream()` **bypassam o BM25** e usam `_montar_prompt_trecho()` — um prompt especializado que instrui o LLM a analisar/refletir sobre o trecho em vez de buscar na base.

O prompt de trecho inclui:
- Identificação do arquivo de origem
- Instrução explícita: "NÃO diga que não encontrou informações — o trecho É a fonte"
- Convite ao usuário para continuar com uma pergunta específica
- Suporte a histórico, persona e idioma normalmente

**`_verificar_alucinacao` — threshold reduzido:**

Threshold reduzido de `0.20` → `0.12` para não descartar respostas que parafraseiam corretamente o corpus. O verificador é **desabilitado completamente** para trechos injetados (parâmetro `trecho_injetado=True`).

**`tusab_engine/agent/index.py` — fix `name 'config' is not defined`:**

Após remoção do bloco `PRO_LIMIT` em sprint anterior, o `config = carregar_config()` que o precedia foi removido junto. As linhas `config['canal_indexado'] = canal_nome` e `salvar_config(config)` permaneceram sem a variável. Corrigido adicionando `config = carregar_config()` de volta antes do bloco.

**`tusab_engine/state.py` — filtro de ruído asyncio:**

`LogRedirector.write()` agora suprime `WinError 10054` e mensagens de `asyncio` do Windows que ocorrem quando clientes SSE desconectam (harmless, mas poluíam o log da UI):

```python
asyncio_noise = ["WinError 10054", "ConnectionResetError", "_ProactorBasePipeTransport", ...]
if any(k in clean for k in asyncio_noise):
    return
```

---

### Frontend

#### `web_interface/src/components/chat/ChatDrawer.jsx`

**Hint para seleção de base com texto injetado:**

Quando o input tem texto mas nenhuma base está selecionada (`chatInput.trim() && !chatHabilitado && canaisIndexados.length > 0`), aparece um hint âmbar animado abaixo do textarea:

```jsx
<p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500 animate-pulse">
  <span>↑</span>
  {t('chat.hint_select_base')}
</p>
```

Resolve o caso em que o usuário injeta um trecho do Repositório mas não tem base ativa — anteriormente ficava sem feedback sobre o motivo de não conseguir enviar.

#### `web_interface/src/components/agent/RepositorioTab.jsx`

- **Busca inline por projeto:** substituiu busca global por campo de busca dentro de cada card de projeto, com estado `buscaState[nome]` por projeto
- **Select para seleção de projeto no upload:** substituiu lista de botões por `<select>` nativo — escalável para 10+ projetos
- **Remoção do card "CANAIS EXTRAÍDOS":** funcionalidade coberta pelo select no topo; hint migrado para label do select

#### `web_interface/src/components/extraction/ExtractionTab.jsx`

- **Botão "Arquivos Gerados"** agora usa `repositorio.canais` como fonte primária em vez de `history` — `history` só existe quando há extração na sessão atual

#### Limpeza de jargão técnico (locales + componentes)

Termos removidos da UI visível ao usuário e substituições adotadas:

| Jargão removido | Substituição |
|-----------------|--------------|
| `yt-dlp` | "YouTube" / "O Tusab extrai legendas..." |
| `BM25` (em textos de guia/onboarding) | "índice de busca" |
| `Chunks BM25` / `BM25 Chunks` | "Fragmentos indexados" |
| `Índice BM25` (colunas de tabela) | "Índice" |

Arquivos alterados: `locales/pt.json`, `en.json`, `es.json`, `ChatDrawer.jsx`, `AdminTab.jsx`.

---

### Infraestrutura de qualidade

#### `.github/PULL_REQUEST_TEMPLATE.md` (novo)

Template de PR com:
- Checklist de smoke tests (`15/15 verde`)
- Seções colapsáveis de impacto por módulo (motor, state, storage, agent, router, frontend)
- Lembrete de atualizar Mapa de Impacto e Changelog

#### `Documentação do Produto/Mapa de Impacto de Dependências.md` (novo)

Documento de contratos implícitos formalizados:
- Grafo de dependências por camada
- Contratos críticos: `state.stats`, `agent_config.json`, schema de chunks, slugs de perfil, protocolo de stream
- Tabela de impacto A→B com severidade
- Comentários `[CONTRATO]` / `[IMPACTO]` inseridos no código nos pontos críticos

---

### Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Detecção por regex `^\[arquivo.ext\]\n` | Formato fixo gerado pelo botão "Injetar trecho" do Repositório — determinístico, sem falso positivo |
| Bypass completo do BM25 para trecho injetado | Query longa e genérica produz scores ruins; o trecho já É o contexto |
| `_verificar_alucinacao` desabilitado para trechos | LLM de análise usa vocabulário distinto do corpus — qualquer threshold derrubaria respostas corretas |
| Threshold 0.12 (não 0.20) | 0.20 descartava respostas legítimas com paráfrase; 0.12 só pega alucinações brutas |
| Hint âmbar com `animate-pulse` | Chama atenção sem ser intrusivo — o usuário percebe mas pode ignorar se quiser |
| Busca inline por projeto (não global) | Com múltiplos projetos, busca global retorna resultados de contextos diferentes — busca por projeto mantém foco |
| `<select>` para projeto no upload | Botões não escalam para 10+ projetos; select é o padrão nativo para listas longas |

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
- Toda a pasta `neural/` (transcrições YouTube, documentos, textos colados)
- CSVs e JSONs de gestão (em `neural/{projeto}/management/`)

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

**`POST /cerebro/buscar`** *(nome de rota mantido para compatibilidade; storage interno: `NEURAL_DIR`)*

Busca full-text recursiva em todos os arquivos `.txt` de `NEURAL_DIR` (exceto arquivos `_`-prefixados).

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
- `POST /export/base` — ZIP de `neural/` + metadados de gestão
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

---

## Sprint 22–23/06/2026 — Chat avançado, exports, UX de bases e limpeza de log

**Commits:** `7d95400` · `095f7f2` · `a79db41` · `ca6b764` · `2ded4e0` · `4aafc0b` · `a9a5bdf` · `7f77dfc` · `e08a1ed` · `7d4def3`
**Escopo:** Backend + Frontend
**Branch:** main

### Contexto

Sprint de robustez e discovery. Foco em três frentes:
1. **Chat** — fila de mensagens, exports funcionais, destaque do botão, anexo de arquivo
2. **UX de bases** — modal de confirmação ao trocar base, deduplicação de chips, alerta correto de desatualização
3. **Limpeza operacional** — filtro de ruído no log, botão Limpar, paths corretos no modal do Drive

---

### Backend

#### `tusab_engine/state.py` — Filtro de ruído de bibliotecas externas

O painel "Log em Tempo Real" exibia avisos de dependências que não têm ação possível para o usuário: `FutureWarning` do `google.generativeai` (SDK deprecado mas ainda funcional), aviso de `HF_TOKEN` da HuggingFace (CrossEncoder funciona sem autenticação) e barra de progresso `tqdm` do download de pesos do modelo.

Adicionado bloco `lib_noise` no `LogRedirector.write()`:

```python
lib_noise = [
    "FutureWarning", "google.generativeai", "google-gemini/deprecated",
    "no longer be receiving updates", "switch to the `google.genai`",
    "unauthenticated requests to the HF Hub", "HF_TOKEN",
    "Loading weights:", "[00:00<", "it/s]", "it/s,",
    "DeprecationWarning", "UserWarning", "warnings.warn",
]
if any(k in clean for k in lib_noise):
    return
```

#### `tusab_engine/api/router_status.py` — Endpoint `POST /log/clear`

Novo endpoint que zera `state.logs` imediatamente. Usado pelo botão "Limpar" no painel de log.

```python
@router.post("/log/clear")
def clear_log():
    with state.state_lock:
        state.logs.clear()
    return {"ok": True}
```

#### `tusab_engine/api/router_agent.py` — Fix import + tolerância de `mtime`

**Import quebrado:** `_contar_canais_indexados` era importada de `agent_tusab` (shim) que não a re-exporta. Corrigido para `from tusab_engine.agent.index import _contar_canais_indexados, PRO_HINT_THRESHOLD`.

**Falso positivo de base desatualizada:** `_bases_com_arquivos_novos()` comparava `os.path.getmtime(fpath) > indexed_at`. Como `indexed_at` é `int(time.time())` e arquivos gerados durante a extração têm `mtime` do momento da escrita (poucos segundos antes), a comparação marcava a base como desatualizada imediatamente após indexar. Adicionada tolerância de 5 s:

```python
if os.path.getmtime(fpath) > indexed_at + 5:
```

#### `tusab_engine/api/router_exports.py` — Exports com mensagens do frontend + PDF funcional

**Problema raiz:** endpoints `/export/resumo-canal` e `/export/relatorio-pdf` liam `state.chat_histories` server-side, que fica vazio após restart do backend. Adicionado campo `mensagens` ao body dos dois requests — frontend envia o histórico completo; server-side é usado apenas como fallback:

```python
class ExportResumoCanalRequest(BaseModel):
    canal_nome: str = Field(default="", max_length=120)
    mensagens:  list = Field(default_factory=list)

# No handler:
if req.mensagens:
    hist = req.mensagens
else:
    with state.hist_lock:
        hist = list(state.chat_histories.get(canal, []))
```

**`reportlab` ausente:** dependência necessária para geração de PDF não estava em `requirements.txt`. Adicionada e instalada (`reportlab==5.0.0`).

---

### Frontend

#### `web_interface/src/App.jsx` — Destaque do botão de chat

Implementado sistema de discovery para o botão flutuante de chat, ativo enquanto a base estiver indexada e o usuário nunca tiver aberto o chat:

- **Anel pulsante** (`animate-ping`): dois anéis concêntricos em violet com delay escalonado, visíveis ao redor do botão
- **Snack flutuante**: bolha "Pergunte à sua base" aparece à esquerda do botão por 10 s na primeira sessão após indexação; clicável (abre o chat direto)
- **Persistência**: `localStorage.tusab_chat_ja_aberto = '1'` ao primeiro clique — ambos os efeitos somem permanentemente

```jsx
// Anel ping — visível enquanto indexado e chat nunca aberto
{agentStatus.indexed && !chatJaAberto && (
  <>
    <span className="absolute inset-0 rounded-full animate-ping opacity-50
      bg-violet-500 dark:bg-violet-500" />
    <span className="absolute inset-0 rounded-full animate-ping opacity-25"
      style={{ animationDelay: '0.4s' }} />
  </>
)}
```

#### `web_interface/src/components/extraction/ExtractionTab.jsx` — Botão Limpar log

Botão "Limpar" adicionado no cabeçalho do painel de log em tempo real. Visível quando `status.logs.length > 0`. Chama `DELETE /log/clear` e o poll do `/status` a cada 2 s atualiza a UI com lista vazia.

#### `web_interface/src/components/chat/ChatDrawer.jsx` — Múltiplas melhorias

**Fix `triggerDownload`:** função era síncrona e chamava `.blob()` em `Promise<Response>` em vez de `Response`. Reescrita como `async`:

```js
const triggerDownload = useCallback(async (responsePromise, filename) => {
  const response = await responsePromise;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    console.warn('[export]', data.message || 'Erro no export');
    return;
  }
  const blob = await response.blob();
  // ... cria link e dispara download
}, []);
```

**Threshold mínimo de export:** botões Doc e PDF desabilitados quando total de conteúdo das respostas do assistente na conversa é menor que 200 caracteres. Planilha também exige o threshold além de detectar lista/tabela:

```jsx
const totalChars = chatMessages
  .filter(m => m.role === 'assistant')
  .reduce((acc, m) => acc + (m.content?.length || 0), 0);
const temConteudoSuficiente = totalChars >= MIN_CHARS_EXPORT; // 200
```

**Mensagens passadas ao backend nos exports:** `exportResumoCanalDocx(canal, msgPayload)` e `exportRelatorioPdf(canal, msgPayload)` recebem o payload filtrado `{ role, content, fontes }` de cada mensagem.

**Deduplicação de bases:** `todasAtivas` usava spread direto, permitindo que um canal em `canalAtivo` e `canaisExtras` aparecesse duas vezes nos chips:

```js
// Antes
const todasAtivas = [canalAtivo, ...(canaisExtras || [])].filter(Boolean);
// Depois
const todasAtivas = [...new Set([canalAtivo, ...(canaisExtras || [])].filter(Boolean))];
```

**Perguntas sugeridas ocultadas com múltiplas bases:** sugestões geradas para o canal principal são irrelevantes em contexto multi-base:

```jsx
{agentStatus?.perguntas_sugeridas?.length > 0 && (!canaisExtras || canaisExtras.length === 0) && (
```

**Modal de confirmação ao trocar base:** ao clicar numa base diferente com conversa ativa, em vez de trocar silenciosamente, abre modal explicando que a conversa vai pro histórico. Mostra base atual e nova, botão "Iniciar nova conversa" executa `onNovaConversa()` → `onSelectCanal(alvo)`.

**Anexo de arquivo no chat (📎):** botão de clipe aparece à esquerda do textarea quando há base ativa. Fluxo:
1. Abre file picker (`.pdf`, `.docx`, `.txt`, `.md`, `.xlsx`, `.csv`)
2. Envia via `POST /neural/upload` com o `canal` ativo (salva em `documents/`)
3. Chama `POST /agent/index` para re-indexação automática
4. Injeta três mensagens `role: 'system'` no chat como feedback visual (enviando → adicionado → re-indexado)

**Mensagens `role: 'system'`:** novo tipo de mensagem renderizado como bolha neutra discreta (fundo `white/5` no dark, `slate-50` no light).

#### `web_interface/src/components/shared/DriveWarningModal.jsx` — Paths corretos

Atualizado para refletir a estrutura real de pastas:

| Antes | Depois |
|-------|--------|
| `cerebro/` | `data/neural/` |
| `config/` | `data/config/` |

Descrição da pasta segura atualizada: "Transcrições, documentos e textos extraídos — sem dados sensíveis". Descrição da pasta sensível atualizada: "Contém suas chaves de API e credenciais do Google em texto simples".

#### `web_interface/src/components/shared/ConsentModal.jsx`

Mesma atualização de paths: `cerebro/` → `data/neural/`, `config/` → `data/config/`.

#### `web_interface/src/locales/pt.json`, `en.json`, `es.json`

Todas as referências a `cerebro/` visíveis ao usuário substituídas por `data/neural/` (estrutura atual). Adicionadas chaves:
- `chat.snack_hint` — texto do snack flutuante ("Pergunte à sua base" / "Ask your knowledge base" / "Pregunta a tu base")
- `log.clear` — label do botão de limpar log ("Limpar" / "Clear" / "Limpiar")

#### `web_interface/src/services/api.js`

- `clearLog()` — `POST /log/clear`
- `exportResumoCanalDocx(canal, mensagens)` — aceita e envia `mensagens`
- `exportRelatorioPdf(canal, mensagens)` — aceita e envia `mensagens`

---

### Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Tolerância de 5 s no `mtime vs indexed_at` | Extração e indexação na mesma sessão produzem arquivos com mtime ≤ 5 s antes do `indexed_at` — sem tolerância, o aviso aparecia sempre |
| `reportlab` adicionado ao `requirements.txt` | Estava sendo importado lazily no endpoint mas nunca declarado — instalação em novo ambiente falhava silenciosamente retornando JSON de erro |
| Snack de 10 s (não 4 s) | 4 s era curto demais para o usuário ler e agir; 10 s mantém presença sem ser intrusivo |
| `role: 'system'` no chat para feedback de upload | Evita poluir o histórico real (user/assistant) com mensagens de operação; renderização separada permite estilo neutro e pode ser filtrada nos exports |
| Modal de troca de base em vez de troca silenciosa | A troca silenciosa perdia o contexto da conversa sem aviso — comportamento destrutivo inadvertido |
| Threshold de 200 chars para exports | Exports de 2–3 linhas não têm valor como documento; o threshold garante que o PDF/DOCX gerado seja minimamente substantivo |

---

## Sprint 24/06/2026 — Persistência de base, acessibilidade, atalhos de repositório e conformidade de nomenclatura

**Commits:** `eee45c0` → HEAD  
**Versão:** v1.0.1  
**Branch:** main

### Contexto

Sprint de qualidade pré-release definitivo. Quatro frentes:
1. **Persistência de base selecionada** — `canalConfigurado` perdia-se ao recarregar a página
2. **Acessibilidade** — auditoria WCAG 2.1 AA completa; snack e tooltip corrigidos
3. **Repositório** — atalho para pasta local em cada base; upload com botão "Voltar"
4. **Conformidade de nomenclatura** — remoção completa de referências a `cerebro/` em comentários, avisos e documentação

---

### Backend

#### `api_tusab.py`

- **`LEIA-ME-SEGURANCA.txt`:** texto gerado no primeiro boot atualizado — referências a `cerebro/` substituídas por `neural/`
- **Comentários de startup:** migrações legadas documentadas explicitamente como "pré-v1.0, idempotentes"
- **`/_debug/paths`:** endpoint de diagnóstico removido de `router_status.py` (era temporário, nunca deveria ir a produção)

#### `tusab_engine/api/router_repositorio.py`

- **`openFolder` via `/open-folder?name=canal_youtube&prefixo={nome}`:** já existia no `router_status.py`; agora exposto ao frontend via botão no header de cada accordion do Repositório

---

### Frontend

#### `web_interface/src/App.jsx`

**Persistência de base (`canalConfigurado`):**

```js
// Antes
const [canalConfigurado, setCanalConfigurado] = useState('');

// Depois — inicializa do localStorage
const [canalConfigurado, setCanalConfigurado] = useState(
  () => localStorage.getItem('tusab_canal_configurado') || ''
);

// Novo useEffect — persiste ao mudar; remove quando vazio
useEffect(() => {
  if (canalConfigurado) localStorage.setItem('tusab_canal_configurado', canalConfigurado);
  else localStorage.removeItem('tusab_canal_configurado');
}, [canalConfigurado]);
```

**Tooltip do botão flutuante de chat:**
- Adicionado `title={t('chat.open_tooltip')}` ao FAB — tooltip nativo do browser, acessível via hover e focus
- `aria-label` atualizado para usar a mesma chave i18n

**Tooltip da aba Agente na sidebar:**
- `role="tooltip"` adicionado ao div do tooltip
- `group-focus:opacity-100` adicionado — tooltip agora visível também via foco de teclado (não só hover)

**Snack de primeiro acesso:**
- `role="status" aria-live="polite"` adicionados — leitores de tela anunciam quando o snack aparece

#### `web_interface/src/components/agent/RepositorioTab.jsx`

**Botão de pasta local no header de cada accordion:**

```jsx
<button
  onClick={e => { e.stopPropagation(); openFolder('canal_youtube', canal.nome).catch(() => {}); }}
  title={t('repo.open_folder_title', { nome: canal.nome })}
  ...>
  <svg /* ícone de pasta */ />
</button>
```

Posicionado entre o botão de export e o de lixeira. Abre `data/neural/{nome}/youtube/` no Explorer do Windows. Disponível para todos os canais (incluindo readonly).

**Chave de tradução:** `repo.open_folder_title` adicionada em `pt.json`, `en.json`, `es.json`.

#### `web_interface/src/locales/*.json`

Nova chave `chat.open_tooltip` em PT / EN / ES.

---

### Documentação

**Atualizada nesta sprint:**
- `Documentação do Produto/Política de Privacidade.md` — v1.2, paths atualizados: `cerebro/` → `neural/`, subpastas em inglês (`documents/`, `texts/`)
- `Documentação do Produto/Arquitetura Técnica.md` — funções de migração corrigidas
- `Documentação do Produto/Blueprint de Modularização.md` — referência a `CEREBRO_DIR` clarificada como alias; rota `/cerebro/*` anotada como nome legado de API
- `Documentação do Produto/Changelog Técnico — v1.0.md` (este arquivo) — paths em exemplos históricos corrigidos
- `Documentação do Produto/Acessibilidade e WCAG.md` — criado nesta sprint; auditoria WCAG 2.1 AA completa

---

### Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Nomes de rota `/cerebro/*` não renomeados | São API pública — renomear quebraria clientes que chamam diretamente; o storage interno já usa `NEURAL_DIR` |
| `CEREBRO_DIR = NEURAL_DIR` mantido como alias | Código legado (testes, shims) importa `CEREBRO_DIR` por nome; alias evita breaking change sem custo |
| Snack com `aria-live` em vez de `aria-atomic` | Conteúdo do snack é uma frase completa — `polite` anuncia quando o leitor de tela estiver ocioso, sem interromper leitura em andamento |

---

## Sprint 24/06/2026 — Branding, UX do modal de extração e dependências

**Commits:** `176dbfb` → HEAD  
**Versão:** v1.0.1 (build 2)  
**Branch:** main

### Contexto

Sprint de polimento pós-release: correção de branding, UX do modal de nomeação de projeto e atualização do contrato de dependências.

---

### Branding e e-mail de contato

**`electron/build_resources/license.txt`** — reescrito completamente:
- Todas as referências a `Brain'IAC` substituídas por `Tusab`
- Cláusula de privacidade local adicionada (item 5)
- E-mail de contato: `tusab@tusab.solutions`

**E-mail unificado para `tusab@tusab.solutions`** em:
- `electron/package.json` — campo `author.email`
- `web_interface/src/components/shared/ProSnackbar.jsx` — link mailto CTA do Pro
- `Documentação do Produto/Política de Privacidade.md` — todos os contatos
- Cabeçalhos `@author` de todos os 29 arquivos fonte do frontend

**Link de download** — `README.md` atualizado para usar URL direta do asset:
```
https://github.com/ahaugusto/tusab/releases/download/v1.0.1/Tusab.Setup.1.0.1.exe
```
O link anterior apontava para a página do release (exige login em repo privado); o link direto de asset é público independente da visibilidade do repositório.

---

### Backend

#### `tusab_engine/api/router_repositorio.py` — endpoint `/neural/projetos`

Campo `canais` adicionado ao objeto de cada projeto retornado:

```python
canais = []
if os.path.isdir(yt_dir):
    canais = [e.name for e in os.scandir(yt_dir) if e.is_dir()]
projetos.append({
    "nome": entry.name,
    "tipo": tipo,
    "n_arquivos": n_docs + n_txts + n_youtube,
    "canais": canais,          # ← novo
})
```

`canais` é a lista de slugs de canais extraídos dentro do projeto (subpastas de `youtube/`). Usado pelo frontend para detectar se um canal já foi extraído anteriormente.

---

### Frontend

#### `ExtractionModal.jsx` — step "Nome do projeto" (3 melhorias)

**1. Alerta de canal já extraído**

Quando o canal configurado (`canalNome` ou handle extraído da URL) já consta no campo `canais` de algum projeto retornado por `/neural/projetos`, exibe banner amber:

> ⚠️ Canal já extraído  
> **@fgv** já está no projeto **FGV**. Você pode adicionar ao mesmo projeto (vídeos novos serão extraídos) ou criar um projeto com outro nome.

**2. Chip selecionado com feedback visual forte**

Estado anterior: borda `border-primary/30`, fundo `bg-primary/15` — difícil de distinguir do estado inativo.  
Estado novo: fundo sólido `bg-primary`, texto branco, `shadow-md shadow-primary/30`, `scale-[1.03]` e ícone ✓ à esquerda.

**3. Select para >4 projetos**

Quando `projetos.length > 4`, os chips são substituídos por `<select>` nativo para evitar overflow do modal.

**4. Input oculto ao selecionar projeto existente** *(adicionado em seguida)*

Novo estado `projetoExistenteSelecionado`:
- Ao clicar num chip ou selecionar no `<select>`: `true` → o campo de texto e o hint de estrutura de pastas são ocultados; aparece card de confirmação com nome do projeto e botão "Trocar"
- Ao clicar "Trocar" ou editar o input manualmente: `false` → input e hint voltam

```jsx
{projetoExistenteSelecionado ? (
  <div className="card de confirmação com nome + botão Trocar">
    ...
  </div>
) : (
  <input type="text" ... />
)}
{!projetoExistenteSelecionado && <div className="hint estrutura de pastas">...</div>}
```

---

### Dependências

**`requirements.txt`** — reescrito com versões mínimas pinadas, organizado por seção:

| Seção | Pacotes |
|-------|---------|
| API / servidor | `fastapi>=0.136.3`, `uvicorn[standard]>=0.48.0`, `python-multipart>=0.0.32`, `starlette>=1.1.0` |
| Agente RAG | `rank-bm25>=0.2.2`, `sentence-transformers>=5.6.0`, `torch>=2.12.1`, `scikit-learn>=1.9.0` |
| Provedores IA | `openai>=2.41.1`, `anthropic>=0.109.1`, `google-generativeai>=0.8.6`, `google-genai>=2.6.0` |
| Google Drive | `google-auth>=2.53.0`, `google-auth-oauthlib>=1.4.0`, `google-auth-httplib2>=0.4.0`, `google-api-python-client>=2.196.0` |
| Documentos | `yt-dlp>=2026.6.9`, `pdfplumber>=0.11.9`, `python-docx>=1.2.0`, `openpyxl>=3.1.5`, `pandas>=3.0.3`, `reportlab>=5.0.0` |
| Sistema | `psutil>=7.2.2`, `python-dotenv>=1.2.2`, `requests>=2.34.2`, `cryptography>=48.0.0` |
| Testes | `pytest>=9.0.3` |
| Opcional | `pytesseract`, `faster-whisper`, `Pillow` (comentados) |

Dependências anteriormente ausentes adicionadas: `openpyxl`, `psutil`, `cryptography`, `python-dotenv`, `starlette`, `scikit-learn`.

---

### Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| `tusab@tusab.solutions` como e-mail único | CriAugu vai ter outros produtos; e-mail por produto facilita triagem e transferência futura |
| Link direto do `.exe` no README | Página do release exige login em repo privado; asset de release é público mesmo em repo privado |
| `canais` no endpoint de projetos | Alternativa (buscar via `/repositorio`) retornaria payload maior; campo pontual no endpoint certo é mais limpo |
| Input oculto ao selecionar existente | Reduz carga cognitiva — usuário que escolheu um projeto existente não precisa confirmar o nome novamente |
| `localStorage` para `canalConfigurado` | Canal selecionado no chat é preferência de sessão longa; perder ao recarregar forçava o usuário a re-selecionar após qualquer reload |

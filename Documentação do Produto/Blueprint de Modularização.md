# Blueprint de Modularização — Tusab Engine

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Status:** Proposta aprovada para execução incremental
**Criado em:** 12 de junho de 2026

---

## Por que modularizar?

O monólito atual (~3.000 linhas em 3 arquivos de raiz) funciona — e os locks e a suíte
de testes provam isso. Mas ele acumula três problemas que vão escalar:

| Problema | Sintoma hoje | Risco amanhã |
|---|---|---|
| `obter_caminho_dados()` duplicada em `motor_tusab.py` e `agent_tusab.py` | Mudança precisa ser feita 2× | 3 versões divergentes após a próxima edição |
| 32 rotas em um único arquivo de 1.296 linhas | Difícil localizar e revisar uma rota | Adicionar MCP server, auth ou rate-limit exige editar o mesmo arquivo em 5 lugares |
| `AppState` e `LogRedirector` misturados com rotas HTTP | Testar estado requer subir a API inteira | Logging estruturado (P3) vai refatorar exatamente essa classe |

A modularização resolve os três — sem quebrar os 23 testes existentes, sem mudar o
comportamento visível e sem exigir pausa na entrega de features.

---

## Restrições que a arquitetura respeita

| # | Restrição | De onde vem |
|---|---|---|
| R1 | `api_tusab.py` permanece na raiz como ponto de entrada | Electron o invoca via `python api_tusab.py` |
| R2 | `motor_tusab.py` e `agent_tusab.py` permanecem na raiz como shims | `electron/package.json` → `extraResources.filter` os lista explicitamente; testes os importam diretamente |
| R3 | `AppState` singleton vive em exatamente um lugar | `state_lock` (RLock) e `hist_lock` foram adicionados como par — separá-los seria risco |
| R4 | `LogRedirector` continua parseando strings de print com emoji | Contrato implícito com `motor_tusab.py`; quebrar isso silencia os logs da UI |
| R5 | `tusab.spec` (PyInstaller) usa `Analysis(['api_tusab.py'], ...)` | Auto-descobre imports; não precisará de mudanças se não usarmos `importlib.import_module` dinâmico |
| R6 | Cada passo de migração termina com pytest 23/23 verde | Garantia de não-regressão antes de avançar |
| R7 | Nome do pacote não pode ser `tusab/` | `tusab.spec` existe na raiz; diretório `tusab/` colidiria no namespace do Python |

---

## Estrutura alvo

```
tusab_engine/                   ← pacote novo (sem conflito com tusab.spec)
  __init__.py                      ← vazio; re-exports opcionais futuros
  storage.py                       ← paths + helpers atômicos (elimina duplicação)
  state.py                         ← AppState + LogRedirector (saem de api_tusab.py)
  motor/
    __init__.py                    ← re-exporta tusab_engine() para o shim
    youtube.py                     ← yt-dlp, mapeamento, extração de legendas
    drive.py                       ← OAuth Google Drive, upload
    processor.py                   ← sumarização, corte de chunks, CSV/JSON output
  agent/
    __init__.py                    ← re-exporta indexar(), chat_com_agente(), etc.
    config.py                      ← carregar_config() / salvar_config() (ponto único p/ keytar futuro)
    index.py                       ← _bm25_cache, _bm25_lock, indexar()
    chat.py                        ← _recuperar_contexto(), roteamento de LLM
    providers.py                   ← wrappers OpenAI / Anthropic / Gemini / Ollama / Groq
  api/
    __init__.py                    ← monta os routers no app FastAPI
    router_status.py               ← GET /status, GET /history, DELETE /historico/*
    router_extraction.py           ← POST /set-channel, /start, /stop, /pause, /resume
    router_drive.py                ← GET /drive/*, POST /drive/*
    router_agent.py                ← GET|POST /agent/* (chat, config, index, test-key)
    router_repositorio.py          ← GET /repositorio, POST|DELETE /cerebro/*
    router_static.py               ← serve_static fallback SPA

# Raiz — permanece como hoje, se torna fina:
api_tusab.py                    ← entrypoint: importa state, monta routers, sobe uvicorn
motor_tusab.py                  ← shim: from tusab_engine.motor import *
agent_tusab.py                  ← shim: from tusab_engine.agent import *
```

---

## Plano de migração (5 passos)

Cada passo é uma PR independente. pytest verde antes de fechar.

### Passo 1 — `storage.py`: eliminar duplicação de caminhos

**O que muda:** extrair `obter_caminho_dados()`, as constantes de path (`DATA_DIR`,
`CEREBRO_DIR`, etc.) e os helpers atômicos (`salvar_csv_atomico`, `salvar_json_atomico`)
para `tusab_engine/storage.py`. Atualizar `motor_tusab.py` e `agent_tusab.py`
para importar de lá.

**Benefício imediato:** a duplicação de `obter_caminho_dados()` — idêntica nos dois
arquivos hoje — vira uma fonte da verdade. Próxima mudança de path: 1 lugar.

**Risco:** zero — é mover código sem alterar lógica. Os shims continuam exportando
os mesmos símbolos.

**Teste de aceitação:** `pytest tests/ -v` → 23/23 verde.

---

### Passo 2 — `state.py`: isolar AppState e LogRedirector

**O que muda:** mover `AppState` e `LogRedirector` (e o bloco de `sys.stdout =
LogRedirector()`) para `tusab_engine/state.py`. `api_tusab.py` importa `state`
de lá.

**Benefício imediato:** logging estruturado (P3) e testes de concorrência unitários
podem importar `state` sem subir a API inteira.

**Cuidado especial (R4):** `LogRedirector.write()` continua **inalterado** —
os padrões de emoji que ele parseia são um contrato vivo com o motor. A única mudança
é o arquivo onde ele mora.

**Teste de aceitação:** `pytest tests/ -v` → 23/23 verde.

---

### Passo 3 — `agent/` package: mover agent_tusab.py

**O que muda:** conteúdo de `agent_tusab.py` migra para os módulos em
`tusab_engine/agent/`. `agent_tusab.py` na raiz vira shim de 3 linhas:

```python
# agent_tusab.py — shim de compatibilidade
from tusab_engine.agent import *           # noqa: F401,F403
from tusab_engine.agent.config import *    # noqa: F401,F403
```

**Benefício imediato:** `config.py` vira o ponto único de acesso às chaves de API —
substituir armazenamento em JSON por keytar (P3) passa a ser uma mudança de 1 arquivo.

**Teste de aceitação:** `pytest tests/ -v` → 23/23 verde. `smoke.ps1` verde no app real.

---

### Passo 4 — `motor/` package: mover motor_tusab.py

**O que muda:** conteúdo de `motor_tusab.py` migra para os módulos em
`tusab_engine/motor/`. `motor_tusab.py` na raiz vira shim.

**Benefício imediato:** `drive.py` fica isolado — autenticação OAuth tem seu próprio
arquivo. Quando vier rate-limiting por fonte (P0 pendente), cada source fica no
seu módulo.

**Atualizar `electron/package.json`:** adicionar `"tusab_engine/**"` ao
`extraResources.filter`.

**Atualizar `tusab.spec`:** não é necessário — PyInstaller auto-descobre
`tusab_engine/` via grafo de imports a partir de `api_tusab.py`.

**Teste de aceitação:** `pytest tests/ -v` → 23/23 verde. `smoke.ps1` verde.

---

### Passo 5 — `api/` routers: desafogar api_tusab.py

**O que muda:** as 32 rotas de `api_tusab.py` migram para routers FastAPI por
domínio (ver estrutura acima). `api_tusab.py` cai para ~80 linhas:
app criado, CORS adicionado, routers montados, uvicorn iniciado.

**Benefício imediato:** adicionar MCP server (P3) = novo arquivo `router_mcp.py` +
1 linha `app.include_router(mcp_router)`. Zero toque nos outros routers.

**Teste de aceitação:** `pytest tests/ -v` → 23/23 verde. `smoke.ps1` verde.
Revisão manual: endpoints no app Electron funcionando (extração, chat, Drive).

---

## Como acomoda o roadmap P3

| Item do roadmap | Onde encaixa na nova estrutura |
|---|---|
| **Servidor MCP** | `tusab_engine/api/router_mcp.py` — router independente, monta no mesmo app FastAPI |
| **Auth middleware / rate-limit** | `tusab_engine/api/middleware.py` — adicionado no `__init__.py` da api/, antes de montar routers |
| **Logging estruturado** | `tusab_engine/state.py` — `LogRedirector` substituído por wrapper de `structlog` em 1 arquivo |
| **Keychain (keytar)** | `tusab_engine/agent/config.py` — `carregar_config`/`salvar_config` são o único ponto de acesso; trocar JSON por keytar = mudar 2 funções |
| **Atualização automática da base + LRU do cache BM25** | `tusab_engine/agent/index.py` — `_bm25_cache` está isolado, fácil adicionar evição |
| **Hooks de domínio + Context no React (P3)** | Não afeta o backend — mas a separação de routers torna a API mais previsível para o frontend |

---

## Metadados de módulo (convenção leve)

Cada módulo interno pode exportar um `__metadata__` para tooling futuro (MCP
introspection, geração de docs, health checks):

```python
# tusab_engine/agent/chat.py
__metadata__ = {
    "domain":     "agent",
    "public_api": ["chat_com_agente", "chat_stream"],
    "deps":       ["index", "config", "providers"],
}
```

É uma convenção opcional — sem enforcement em runtime. Útil quando o servidor MCP
precisar listar capacidades.

---

## O que NÃO muda nesta migração

- Comportamento de qualquer endpoint
- Formato das respostas da API
- Padrões de print/emoji que o `LogRedirector` parseia
- Variável de ambiente `TUSAB_DATA_DIR`
- Mecanismo de isolamento dos testes (`conftest.py`)
- Os 3 arquivos de raiz (continuam existindo como shims ou entry point)

---

## Checklist de execução

- [ ] **P1** — Criar `tusab_engine/` + Passo 1 (storage) → pytest verde
- [ ] **P2** — Passo 2 (state) → pytest verde
- [ ] **P3** — Passo 3 (agent package) → pytest verde + smoke
- [ ] **P4** — Passo 4 (motor package) → pytest verde + smoke + electron/package.json
- [ ] **P5** — Passo 5 (api routers) → pytest verde + smoke + revisão manual Electron
- [ ] Atualizar `Execução do Relatório 360.md` com entrada de modularização
- [ ] Atualizar `README.md` com nova estrutura de pastas

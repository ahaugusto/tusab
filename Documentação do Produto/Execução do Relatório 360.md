# Execução do Relatório 360 — Diário de Evolução

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Documento-base:** [Relatório de Produto 360 — Junho 2026](Relatório%20de%20Produto%20360%20—%20Junho%202026.md)
**Criado em:** 11 de junho de 2026 · **Última atualização:** 19 de junho de 2026

---

## Para que serve este documento

O Relatório 360 diagnosticou o produto e definiu uma matriz de prioridades (P0 a P3).
Este documento acompanha a **execução** dessa matriz: o que já foi atacado, como foi
resolvido e por quê. Cada item concluído ganha três registros:

- **O que foi feito** — checklist objetivo das mudanças
- **Explicação técnica** — para quem vai manter o código
- **Explicação simples** — para entender o valor sem precisar ler código

### Como atualizar (instruções para futuras sessões)

1. Ao concluir um item da matriz, mude `○` para `✅` no checklist da seção 1 e anote a data.
2. Adicione uma entrada detalhada na seção 2, seguindo o modelo dos itens existentes
   (O que foi feito / Explicação técnica / Explicação simples).
3. Registre a sessão no histórico da seção 3.
4. Se um item for descartado ou substituído, use `✗` e registre o motivo — decisões
   descartadas documentadas valem tanto quanto as executadas.

---

## 1. Checklist geral (matriz P0–P3 do relatório)

### P0 — Antes de distribuir

| Status | Item | Data |
|--------|------|------|
| ✅ | Política de privacidade | 12/06/2026 |
| ✅ | Locks nas estruturas compartilhadas + escrita atômica CSV/JSON | 11/06/2026 |
| ✅ | Religar os 7 eventos de telemetria mortos | 11/06/2026 |
| ✅ | requirements-lock.txt com versões pinned | 12/06/2026 |
| ✅ | Script build.ps1 unificado (vite + cópia .py + electron) | 12/06/2026 |
| ✅ | Strings hardcoded → i18n | 12/06/2026 |
| ✅ | Rate limit test-key + max_length Pydantic + minimizar GET /agent/config | 12/06/2026 |

### P1 — Fundação de qualidade

| Status | Item | Data |
|--------|------|------|
| ✅ | smoke.ps1 → pytest + GitHub Actions mínimo *(antecipado de P1)* | 11/06/2026 |
| ✅ | Recovery de índice corrompido *(validação + mensagem + botão "Recriar índice" na UI)* | 12/06/2026 |
| ✅ | ModalWrapper único com focus trap + Escape (7 modais + 2 portals) | 13/06/2026 |
| ✅ | Mensagem "Ollama offline" + health check pré-chat | 12/06/2026 |
| ✅ | Toast de erro para falhas de API silenciosas | 13/06/2026 |
| ✅ | Polling com pausa em background (visibilitychange) | 12/06/2026 |

### P2 — Go-to-market (sem código)

| Status | Item | Data |
|--------|------|------|
| ○ | Primeira venda B2B formal (case AUVP como referência) | — |
| ○ | Landing page mínima | — |
| ○ | INPI + OAuth production + instalador oficial no GitHub Releases | — |
| ○ | Lemon Squeezy após validação de preço | — |

### P3 — Escala (v0.5+/v1.0)

| Status | Item | Data |
|--------|------|------|
| ○ | Refatoração incremental App.jsx (hooks de domínio + Context) | — |
| ✅ | Routers FastAPI por domínio + modularização completa do monólito Python | 12/06/2026 |
| ○ | Keychain para chaves de API (keytar) | — |
| ○ | Logging estruturado | — |
| ○ | Servidor MCP | — |
| ◐ | Atualização automática da base + evição LRU do cache BM25 | 19/06/2026 |

### Bônus (achados fora da matriz, implementados no caminho)

| Status | Item | Data |
|--------|------|------|
| ✅ | Chat stats persistentes por projeto (`_chat_stats.json` + `/agent/chat-stats`) | 19/06/2026 |
| ✅ | Visão Geral — inventário completo com KPIs, filtros e suporte a imagens/áudios | 19/06/2026 |
| ✅ | IndexarModal reescrita — busca, scroll, contagem, tamanho adequado para 100+ bases | 19/06/2026 |
| ✅ | Cancelamento com fila — modal pergunta continuar ou descartar; backend não auto-limpa | 19/06/2026 |
| ✅ | Reset total corrigido — path errado de índices, navegação para home, toast confirmação | 19/06/2026 |
| ✅ | Periodicidade Pro — sub-aba em Extração com hero, tabela preview e tag PRO | 19/06/2026 |
| ✅ | GuideModal — nova aba "Atalhos de teclado" com grupos e componente Kbd | 19/06/2026 |
| ✅ | HomeScreen — cards "Extrair conteúdo (YouTube)" e "Incluir conteúdo (Local)" | 19/06/2026 |
| ✅ | Admin simplificada — "Limpar" saiu da sidebar; periodicidade movida para Extração | 19/06/2026 |
| ✅ | Filtro de playlist IDs na extração (IDs ≠ 11 chars ou prefixo PL/UU/FL/RD/OL) | 19/06/2026 |

### Bônus originais (achados fora da matriz, corrigidos no caminho)

| Status | Item | Data |
|--------|------|------|
| ✅ | requirements.txt listava `google-genai` mas o código usa `google-generativeai` | 11/06/2026 |

**Legenda:** ✅ concluído · ◐ parcial · ○ pendente · ✗ descartado

---

## 2. Itens executados em detalhe

### 2.1 ✅ Locks + escrita atômica (P0) — 11/06/2026

**Por que era P0:** o Relatório 360 identificou que três estruturas de dados eram
acessadas por múltiplas threads sem proteção, e que os arquivos CSV/JSON eram
reescritos centenas de vezes por extração sem garantia de integridade. Um crash no
momento errado corrompia o histórico ou o índice — inaceitável na máquina de um
cliente pagante.

**O que foi feito:**
- [x] `state_lock` (RLock) protegendo `state.stats` e `state.logs` em `api_tusab.py`
- [x] `hist_lock` protegendo `state.chat_histories` nos 3 pontos de acesso (chat, stream, clear)
- [x] `_bm25_lock` protegendo o cache de índices em `agent_tusab.py` (canal principal + canais extras)
- [x] Helpers `salvar_csv_atomico()` e `salvar_json_atomico()` em `motor_tusab.py`
- [x] Substituídas as 6 escritas de CSV do motor de extração
- [x] Substituídas as escritas de JSON: índice BM25, agent_config.json, summaries, meta do canal e os 3 manifests do repositório

**Explicação técnica:**
O `LogRedirector` (que intercepta os `print()` do motor rodando em background thread)
fazia incrementos read-modify-write em `state.stats` enquanto o endpoint `/status`
lia o mesmo dict a cada 2 segundos — race condition clássica que perdia incrementos
e entregava snapshots inconsistentes à UI. Agora toda mutação acontece dentro de
`with state.state_lock:` e o `/status` copia o dict sob lock antes de serializar.
Usamos `RLock` (reentrante) porque um `print()` executado dentro de uma região com
lock reentra no próprio `LogRedirector` — com `Lock` simples seria deadlock.
No cache BM25, dois chats simultâneos no mesmo canal disparavam dupla reconstrução
do índice (operação de segundos); o lock serializa o check-and-build.
Para persistência, o padrão write-to-temp + `os.replace()` garante atomicidade no
nível do sistema de arquivos: o `os.replace` é uma operação atômica no mesmo volume,
então o arquivo final ou é a versão antiga íntegra ou a nova íntegra — nunca um
intermediário truncado. Teste de concorrência na suíte valida 8 threads × 50
escritas sem perder um único incremento.

**Explicação simples:**
Imagine vários funcionários atualizando a mesma planilha de papel ao mesmo tempo,
sem combinar quem escreve quando — números somem, linhas saem pela metade. O lock é
a regra "um de cada vez segura a caneta". E a escrita atômica é como preparar a
página nova em separado e só trocar a folha quando ela está completa: se faltar luz
no meio do trabalho, a planilha antiga continua intacta. Antes, faltar luz na hora
errada podia deixar a planilha rasgada ao meio.

---

### 2.2 ✅ Telemetria religada (P0) — 11/06/2026

**Por que era P0:** 7 dos 11 eventos do PostHog estavam definidos mas nunca eram
chamados. O funil de ativação (instalar → extrair → indexar → perguntar) estava cego
nas etapas do meio — o produto evoluía por intuição, sem dados.

**O que foi feito:**
- [x] `extracaoIniciada(fontes)` — no confirmar da extração (`handleStartConfirm`, App.jsx)
- [x] `extracaoConcluida({videos_processados, videos_total, sem_legenda})` — no efeito que detecta "Finalizado ✓"
- [x] `provedorConfigurado(provider)` — ao salvar configuração do agente com sucesso
- [x] `repositorioAcessado()` / `relatorioAcessado()` — novo efeito observando a troca de abas
- [x] `buscaAmplaToggled(ativo)` — wrapper no `setBuscaAmpla` passado ao ChatDrawer
- [x] `documentoAdicionado(tipo)` — no RepositorioTab, após sucesso de texto colado e de upload (com a extensão do arquivo como tipo)

**Explicação técnica:**
Os handlers já existiam; faltava a chamada. Dois cuidados de implementação: (1) o
toggle de busca ampla recebe function updater (`v => !v`), então o wrapper resolve o
próximo valor antes de trackear — sem efeito colateral dentro do state updater do
React; (2) `extracaoConcluida` envia apenas agregados numéricos (contagens), nunca o
nome do canal — mantendo a conformidade LGPD estabelecida na auditoria anterior
(evento `canalConfigurado` já tinha perdido o parâmetro `{canal}` pelo mesmo motivo).
Tudo continua atrás do opt-in: sem consentimento, `track()` é no-op.

**Explicação simples:**
O app tinha velocímetro, mas os cabos não estavam ligados ao motor. Agora estão:
dá para ver quantos usuários começam uma extração e quantos terminam, quem adiciona
documentos, qual provedor de IA as pessoas escolhem e se usam a busca ampla. Na
prática, isso responde a pergunta mais importante de produto: **onde as pessoas
travam?** — e as próximas decisões passam a ser baseadas em evidência, não em
achismo. Tudo continua dependendo do "sim" explícito do usuário na telemetria.

---

### 2.3 ✅ Suíte pytest + CI (P1, antecipado) — 11/06/2026

**Por que foi antecipado:** zero testes + refactors de concorrência na mesma sessão
seria operar no escuro exatamente no código mais delicado. A suíte foi criada junto
com os fixes para validá-los.

**O que foi feito:**
- [x] `tests/conftest.py` — isolamento total: `TUSAB_DATA_DIR` aponta para diretório temporário antes de importar a app; testes nunca tocam dados reais
- [x] `tests/test_api.py` — 17 testes de integração espelhando o smoke.ps1: status, history, repositório, validação de URL (incluindo flag de yt-dlp maliciosa), test-key inline, chat sem índice, histórico forjado ignorado, texto colado (criar/listar/deletar), serve estático e path traversal
- [x] `tests/test_confiabilidade.py` — 6 testes do sprint: escrita atômica de CSV/JSON/config, índice corrompido, índice vazio, e concorrência real (8 threads no LogRedirector + 8 threads no chat_histories)
- [x] `.github/workflows/ci.yml` — dois jobs paralelos a cada push/PR na main: pytest (Python 3.12, Ubuntu, com dist mínimo fabricado para os testes de serve estático) e build do frontend (Node 20, `npm ci` + `vite build`)
- [x] Resultado: **23/23 verdes** localmente; smoke.ps1 manteve 10/10 no app real

**Explicação técnica:**
O `TestClient` do FastAPI executa os endpoints in-process, sem subir servidor — os
testes rodam em ~5s. O ponto não óbvio é o conftest: `api_tusab` redireciona
`sys.stdout/stderr` para o `LogRedirector` no import (design do app), então a fixture
restaura os streams para o pytest reportar normalmente. O isolamento via variável de
ambiente funciona porque `motor_tusab.obter_caminho_dados()` prioriza
`TUSAB_DATA_DIR` — o mesmo mecanismo que o Electron usa em produção, reutilizado
para teste. No CI, em vez de compilar o frontend inteiro no job de backend, um
`index.html` mínimo é fabricado — suficiente para exercer o code path real do
`serve_static` e do fallback de path traversal.

**Explicação simples:**
Antes, cada mudança no código era testada manualmente — abrir o app, clicar, torcer.
Agora existem 23 verificações automáticas que rodam em 5 segundos e cobrem os fluxos
críticos, incluindo as proteções de segurança. E o GitHub passou a rodar essas
verificações sozinho a cada alteração enviada: se algo quebrar, o aviso chega antes
de qualquer usuário perceber. É a diferença entre revisar o carro de ouvido e ter um
painel de diagnóstico que acende a luz certa.

---

### 2.4 ◐ Recovery de índice corrompido (P1, parcial) — 11/06/2026

**O que foi feito:**
- [x] Validação ao carregar o índice em `_recuperar_contexto()`: JSON inválido, chave ausente ou lista de chunks vazia geram `ValueError` com mensagem orientando o usuário ("O índice está corrompido ou vazio. Vá em Configurar Agente e clique em 'Indexar Agora' para recriá-lo.")
- [x] Testes cobrindo índice truncado e índice vazio
- [x] **Concluído (12/06/2026):** botão "Recriar índice" direto na mensagem de erro do chat — usa prop `onRecriarIndice` passada do App.jsx para ChatDrawer.jsx

**Explicação técnica:**
O `json.load` sem proteção fazia o chat estourar com stack trace genérico quando o
arquivo `{canal}_index.json` estava truncado. Agora o bloco de carga captura
`JSONDecodeError/KeyError/ValueError/TypeError` e converte em erro de domínio que o
endpoint já sabe serializar como `{error, message}`. Importante: a escrita atômica
(item 2.1) torna a corrupção por crash quase impossível daqui em diante — esta
validação cobre os casos restantes (disco cheio, edição manual, antivírus).

**Explicação simples:**
Se o "fichário" do mentor estiver rasgado, antes o app simplesmente travava sem
explicação. Agora ele percebe o problema e diz exatamente o que fazer: reindexar.
E com a escrita atômica do item 2.1, a causa mais comum de fichário rasgado
(desligamento no meio da escrita) deixou de existir.

---

### 2.5 ✅ Bônus: SDK do Gemini errado no requirements — 11/06/2026

**O que foi feito:**
- [x] `requirements.txt`: `google-genai` → `google-generativeai`

**Explicação técnica:**
O código importa `google.generativeai` (SDK clássico), que é distribuído pelo pacote
`google-generativeai`. O requirements listava `google-genai` — o SDK novo, de API
incompatível, que inclusive já havia sido descartado para embeddings (registrado em
Proposta de melhorias). Funcionava na máquina de desenvolvimento porque os dois
estavam instalados; numa instalação limpa (CI, máquina nova, build do instalador),
o chat com Gemini quebraria em runtime com `ModuleNotFoundError`. Achado pelo CI
recém-criado — exatamente o tipo de bug que builds reproduzíveis pegam.

**Explicação simples:**
A lista de compras pedia um ingrediente parecido, mas errado. Na cozinha de casa
ninguém notava, porque o ingrediente certo já estava na despensa. Na primeira vez
que alguém fosse cozinhar em outra cozinha (um computador novo), a receita falharia.
O teste automático novo encontrou isso no primeiro dia — bom sinal de que o
investimento em testes já se pagou.

---

### 2.6 ✅ Modularização do monólito Python → `tusab_engine/` (P3) — 12/06/2026

**Por que era P3:** os três arquivos raiz somavam ~3 000 linhas e cresciam sem
separação de responsabilidades — cada bugfix exigia entender o arquivo inteiro.
O `api_tusab.py` acumulava estado global, roteamento, lógica de negócio,
autenticação OAuth e dois sistemas de chat. Qualquer nova feature amplificava
a entropia.

**O que foi feito:**
- [x] Criado pacote `tusab_engine/` com 3 subpacotes e 9 módulos
- [x] `tusab_engine/storage.py` — caminhos de dados, constantes e helpers atômicos (elimina duplicata idêntica que existia em `motor_tusab.py` e `agent_tusab.py`)
- [x] `tusab_engine/state.py` — `AppState` singleton, `LogRedirector` e `_debug_excepthook` (extraídos do `api_tusab.py`)
- [x] `tusab_engine/agent/` — 3 módulos: `config.py`, `index.py` (BM25), `chat.py` (RAG); `agent_tusab.py` vira shim de re-exports
- [x] `tusab_engine/motor/` — 2 módulos: `drive.py` (OAuth + upload Drive) e `extraction.py` (engine principal); `motor_tusab.py` vira shim de re-exports
- [x] `tusab_engine/api/` — 4 roteadores FastAPI (`router_status`, `router_extraction`, `router_agent`, `router_repositorio`); `api_tusab.py` cai de 1 189 → 165 linhas
- [x] `electron/package.json` — `extraResources.filter` atualizado com `"tusab_engine/**"` para o build do instalador
- [x] `tests/test_confiabilidade.py` — import de `LogRedirector` corrigido para `tusab_engine.state`
- [x] Suíte pytest: **23/23 verde** em todos os 5 passos da migração

**Explicação técnica:**
O maior risco da migração era o `LogRedirector` (intercepta `sys.stdout` no import)
e o `AppState` singleton — ambos precisam existir antes dos outros módulos e não
podem ser importados duas vezes. Resolvido com import order: `motor_tusab` e
`agent_tusab` carregam primeiro, só então `from tusab_engine.state import state`
dispara o redirect (ordem idêntica ao original). O nome do pacote é `tusab_engine/`
e não `tusab/` para evitar colisão com `tusab.spec` (spec do PyInstaller) na
raiz. O shim pattern nos três arquivos raiz preserva todos os `motor_tusab.X` e
`agent_tusab.X` do `api_tusab.py` sem modificar o código chamador — zero risco
de regressão nos endpoints. A hierarquia de dependências é acíclica:
`api → agent/motor → storage`, sem nenhum import circular. O bug latente
`threading` não importado no `run_motor` do `api_tusab.py` foi corrigido
ao mover a função para `router_extraction.py` com import explícito.

**Explicação simples:**
Os três arquivos eram como uma cozinha onde a receita, o fogão, a geladeira e o
livro de contabilidade ficavam todos na mesma gaveta. Agora cada coisa está no
armário certo: armazenamento, estado do app, motor de extração, agente de IA e
rotas da API — cada um no seu lugar, com uma etiqueta clara. O `api_tusab.py`
virou apenas a recepção: recebe a visita e manda para o departamento certo, sem
tentar resolver tudo sozinho. Sem mudar nenhuma funcionalidade, o código ficou 7×
menor no arquivo principal e muito mais fácil de manter.

---

---

### 2.7 ✅ P0 completo: segurança, i18n, build e privacidade (P0/P1) — 12/06/2026

**O que foi feito:**

- [x] `requirements-lock.txt` criado com todas as 76 dependências pinned (`pip freeze`)
- [x] `Field(max_length=...)` nos 5 modelos Pydantic de `router_agent.py` (até 4 000 chars para mensagem, 300 para api_key, 30 para provider, 120 para canal_nome)
- [x] Rate limit 5s em `POST /agent/test-key` — variável global `_test_key_last`; rejeita com mensagem amigável se abusado
- [x] `GET /agent/config` agora retorna `"***"` em vez da chave real — chave sai do JSON do frontend, não vaza em logs ou DevTools
- [x] 11 chaves i18n novas: `tabs.repositorio`, `tabs.relatorio`, `ops.deselect_all`, `agent.ollama_offline`, `agent.rebuild_index`, `chat.*` (6 chaves de UI do ChatDrawer) — nos 3 locales (pt, en, es)
- [x] App.jsx: `'Repositório'`/`'Relatório'` → `t('tabs.repositorio')`/`t('tabs.relatorio')` em 3 pontos (desktop nav, mobile nav, header title map); `'Desmarcar tudo'` → `t('ops.deselect_all')`; tema mobile → `t('footer.light/dark')`
- [x] App.jsx: `isVisibleRef` + evento `visibilitychange` — polling de `/status` (2s) e `/agent/status` (3s) pausado quando aba está em background
- [x] App.jsx: check Ollama offline em `handleChatSend` — se `agentProvider === 'ollama'` e `!ollamaStatus.running`, insere mensagem de erro local sem chamar o backend
- [x] App.jsx: prop `onRecriarIndice={handleAgentIndex}` passada ao ChatDrawer
- [x] ChatDrawer.jsx: todos os 7 strings hardcoded substituídos por `t()` · ícone `RefreshCw` adicionado · botão "Recriar índice" + prop `onRecriarIndice` na bolha de erro
- [x] `build.ps1` criado: parâmetros `-SkipFrontend`/`-SkipElectron`; executa `npm run build` no frontend, copia `.py` + `tusab_engine/` + `scripts/` para `electron/resources/python/`, executa `npm run dist` no Electron
- [x] `Documentação do Produto/Política de Privacidade.md` criada: LGPD/GDPR completa (transferência internacional, direitos, bases legais, retenção, segurança, menores)
- [x] **23/23 pytest verde** após todas as mudanças

**Explicação técnica:**
O mascaramento da api_key no GET `/agent/config` é necessário porque o frontend logava o objeto inteiro nos DevTools do Electron — um usuário com acesso físico à máquina poderia ver a chave no console. O rate limit no `test-key` impede varredura de chaves por força bruta via script. O `visibilitychange` não destrói os intervalos (continuam existindo), apenas pula a chamada HTTP quando `document.hidden === true` — abordagem mais simples e menos propensa a races que criar/destruir timers. O check Ollama offline é feito no frontend antes de chamar o backend porque o backend retornaria um erro genérico de timeout; a mensagem local é instantânea e específica.

**Explicação simples:**
Todos os itens do "Antes de distribuir" estão concluídos. O app para de mandar perguntas ao servidor quando a aba está escondida (poupa bateria e CPU). Se o usuário esqueceu de abrir o Ollama antes de perguntar, o chat diz imediatamente "Ollama offline" — sem esperar 30s de timeout. E quando qualquer resposta do agente dá erro, aparece um botão "Recriar índice" diretamente na conversa, sem precisar navegar para outra aba.

---

---

### 2.8 ✅ Smoke test Electron dev mode + fix ELECTRON_RUN_AS_NODE — 12/06/2026

**O que foi feito:**
- [x] Diagnóstico do crash do Electron em dev mode (`require('electron')` retornava string em vez da API)
- [x] Causa raiz identificada: `ELECTRON_RUN_AS_NODE=1` definida pelo VS Code — faz o Electron ignorar toda a inicialização do browser process e rodar como Node.js puro
- [x] Fix em `build.ps1`: `$env:ELECTRON_RUN_AS_NODE = $null` adicionado antes de qualquer invocação do Electron
- [x] Smoke test dev mode: Electron inicializado, backend respondendo, app vivo por 8s+ sem crashes ✅
- [x] Reinstalação de `electron/node_modules` feita e confirmada sem efeito (problema era ambiental, não de instalação)

**Explicação técnica:**
Quando `ELECTRON_RUN_AS_NODE=1`, o binário `electron.exe` ignora `browser_init.js` (que configura `process.type = 'browser'`, registra `require('electron')` como módulo built-in, etc.) e executa como runtime Node.js puro. Nesse modo, `require('electron')` resolve para o pacote npm (`node_modules/electron/index.js`) que exporta o path do binário (string) — resultando em `app === undefined` e crash imediato em `app.isPackaged`. A variável é definida pelo VS Code para usar o Electron embutido como ambiente Node.js para extensões e tarefas internas; processos filhos a herdam automaticamente. O fix no `build.ps1` remove a variável antes de qualquer npm/electron call. Para `npm run dev` manual dentro do VS Code, basta rodar `$env:ELECTRON_RUN_AS_NODE=$null` uma vez na sessão do terminal integrado.

**Explicação simples:**
O VS Code (o editor onde desenvolvemos) usa o próprio Electron internamente e deixa uma "etiqueta" no ambiente dizendo "rode o Electron como se fosse só um Node.js". Quando abrimos o app pelo terminal integrado do VS Code, o Electron da aplicação herdava essa etiqueta e ignorava toda a inicialização gráfica — como uma TV que, ao receber o sinal errado, entra em modo serviço em vez de mostrar a imagem. Bastou remover a etiqueta para o app abrir normalmente.

---

### 2.9 ✅ Setup de empacotamento + smoke test do app empacotado — 12/06/2026

**O que foi feito:**
- [x] `electron/python_env/` criado: Python 3.12.10 Windows embeddable (64-bit), pip 26.1.2, 76 pacotes do `requirements-lock.txt` instalados; verificado `import fastapi, uvicorn, rank_bm25` → OK
- [x] `electron/bin/yt-dlp.exe` baixado: versão 2026.03.17 (17,6 MB); `yt-dlp.exe --version` confirmado
- [x] `build.ps1` corrigido: encoding reescrito de UTF-8 para UTF-16 LE (encoding nativo do PowerShell 5.1) — scripts UTF-8 com chars especiais eram lidos incorretamente, gerando `TerminatorExpectedAtEndOfString`
- [x] `build.ps1 -Dir` executado com sucesso: Vite build (2 244 módulos, 3,1s) + electron-builder `--dir` (win-unpacked)
- [x] Smoke test do app empacotado: `dist_electron/win-unpacked/tusab.exe` lançado, backend FastAPI respondeu `HTTP 200 /status` em 2s; `python_env/`, `bin/yt-dlp.exe` e `app.asar` confirmados na estrutura correta
- [x] Aviso documentado: `FutureWarning google.generativeai` — SDK Gemini clássico deprecado, não impacta funcionamento; pendente migração para `google-genai` em versão futura

**Explicação técnica:**
O Python 3.14.0 embeddable foi descartado por bug conhecido no Windows (stdlib zip não carregado corretamente, mesmo com `.pth` correto). Python 3.12.10 resolveu. O `python312._pth` foi escrito sem BOM (`[System.Text.UTF8Encoding]::new($false)`) — o `Set-Content -Encoding UTF8` do PowerShell 5.1 escreve UTF-8 WITH BOM (`﻿`), que corromperia o caminho `python312.zip` adicionando `﻿python312.zip`. O `build.ps1` acumulava erro de parser (`TerminatorExpectedAtEndOfString`) mesmo após edição porque o `Edit` tool salvava UTF-8, que o PowerShell 5.1 lê como ANSI/Windows-1252; caracteres multi-byte de PT-BR no código (hífens especiais, acentos) viravam sequências inválidas dentro de strings, quebrando o parser. A solução definitiva foi `[System.IO.File]::WriteAllText(..., [System.Text.Encoding]::Unicode)` — UTF-16 LE com BOM, que PowerShell 5.1 lê nativamente.

**Explicação simples:**
Para entregar o app num computador novo (sem Python instalado), precisamos empacotar o Python junto — como incluir a cozinha na caixa de entrega. Isso requer montar o ambiente Python corretamente (versão 3.12, todos os ingredientes) e colocar o `yt-dlp.exe` (ferramenta de download do YouTube) na pasta certa. Com tudo no lugar, o `build.ps1 -Dir` montou o app completo e o `tusab.exe` empacotado iniciou corretamente, com o servidor respondendo em 2 segundos — o mesmo que o app de desenvolvimento. O produto está funcionalmente empacotável para Windows.

---

### 2.10 ✅ ModalWrapper + focus trap + Escape (P1) — 13/06/2026

**O que foi feito:**
- [x] `ModalWrapper.jsx` criado em `components/shared/` — componente único de backdrop para todos os modais
- [x] Escape key → `onClose` (com prop `disableEscape` para casos sem fechamento por teclado)
- [x] Clique no backdrop → `onClose` (com prop `disableBackdrop`)
- [x] Focus trap: Tab/Shift+Tab circulam apenas dentro do `role="dialog"`, nunca saem
- [x] Auto-focus no primeiro elemento focalizável ao abrir
- [x] Restaura o foco no elemento que estava ativo antes de abrir (ao fechar)
- [x] `aria-modal="true"` + `role="dialog"` + `aria-label` em todos os modais
- [x] Aplicado em 5 modais com overlay full-screen: GuideModal, ExtractionModal, PostExtractionModal, DriveWarningModal, Onboarding
- [x] Aplicado em 2 portals inline: RepositorioTab (limpar base) e RelatorioTab (limpar histórico)
- [x] ConsentModal (banner bottom) não alterado — não é overlay, não tem Escape intencional
- [x] Build validado: `✓ 2245 modules transformed` sem erros

**Explicação técnica:**
Antes, cada modal reimplementava (ou omitia) independentemente o backdrop, o Escape e o foco. O `ModalWrapper` centraliza tudo num único componente: usa `motion.div` (framer-motion) como backdrop animado, mantém `prevFocus` via `useRef` para restauração, e registra/remove o listener de Escape via `useEffect` com cleanup. O focus trap intercepta `Tab`/`Shift+Tab` no `onKeyDown` do `div[role="dialog"]`, calcula os elementos focalizáveis via seletor CSS e redireciona ciclicamente. Os dois portals em `RepositorioTab` e `RelatorioTab` usam `ReactDOM.createPortal` com `document.body` — o `ModalWrapper` funciona corretamente dentro de portals porque não depende de posicionamento relativo. `Onboarding` usa `disableBackdrop` (o usuário deve escolher "Pular" ou "Concluir", não clicar ao lado acidentalmente).

**Explicação simples:**
Antes, fechar um modal pela tecla Esc dependia de cada tela ter implementado isso — e a maioria não tinha. O foco do teclado também "escapava" do modal (Tab podia selecionar botões atrás do overlay). Agora existe um "molde de modal" único: toda janela de confirmação/aviso que abre no app herda automaticamente o Esc para fechar, o Tab que circula só dentro dela e o foco devolvido ao botão certo ao fechar. São 7 lugares no app que agora se comportam da mesma forma, sem exceções.

---

---

### 2.11 ✅ Visão Geral, Reset fix, Periodicidade Pro e UX — 19/06/2026

**Por que foi feito:** O produto estava crescendo em dados (YouTube, docs, imagens, áudios) mas não tinha uma tela que mostrasse o inventário completo. O reset total tinha um bug crítico de path que deixava índices BM25 intactos mesmo após limpar. A atualização automática de canais precisava de um ponto de entrada na UI antes de ser implementada no backend.

**O que foi feito:**

*Visão Geral (VisaoGeralTab):*
- [x] Reescrita completa: 5 KPIs (Projetos, Arquivos, Chunks BM25, Vídeos, Interações)
- [x] Suporte a imagens e áudios além de YouTube/docs/textos — `subtipoDoc()` classifica por extensão
- [x] Cabeçalhos de coluna acessíveis (texto + emoji, não só emoji)
- [x] Projetos aparecem mesmo sem arquivos .txt — contagem via `videos_mapeados` do CSV
- [x] 6 filtros: Todos, YouTube, Docs, Imagens, Áudios, Textos
- [x] Card "Relatório" substituído por "Visão Geral" na HomeScreen

*Chat stats persistentes:*
- [x] `_atualizar_chat_stats()` grava `_chat_stats.json` por projeto em `management/`
- [x] `GET /agent/chat-stats` retorna stats acumuladas por projeto (perguntas, refs usadas)
- [x] `fetchChatStats()` integrado na Visão Geral

*IndexarModal:*
- [x] Extraída como componente separado de `RepositorioTab`
- [x] `max-w-lg`, altura `min(80vh, 640px)`, layout flex com header/footer fixos
- [x] Campo de busca com auto-focus; "Selecionar todos" escopo filtrado; badge YouTube; botão com contagem

*Cancelamento com fila:*
- [x] Backend: `run_motor()` não limpa mais `extraction_queue` no cancelamento
- [x] Frontend: modal pergunta "Continuar fila" ou "Cancelar e limpar fila" quando há itens na fila

*Reset total — bug crítico corrigido:*
- [x] Backend: path `DADOS_DIR + "agent_index"` → `INDEX_DIR` (era `Tusab/agent_index` em vez de `Tusab/data/agent_index`)
- [x] Backend: limpa `state.stats`, `state.logs`, `canal_url`, `extraction_queue`, `chat_histories` em memória
- [x] Frontend: `prevExtractionStatus.current = ''` e `prevIsRunningRef.current = false` antes de zerar estado
- [x] Frontend: `setShowHome(true)` navega para a home + `setProgressToast` exibe "Todos os dados foram apagados"
- [x] Frontend: botão "Limpar" removido da sidebar — exclusivo na aba Admin

*Periodicidade Pro (sub-aba de Extração):*
- [x] Nova sub-aba "Periodicidade" com badge `PRO` no switcher de sub-abas
- [x] Hero card: descrição da feature, chips das características, link para tusab.solutions
- [x] Tabela preview: lista canais extraídos com frequência mockada e toggle desabilitado
- [x] Card de Periodicidade removido da aba Admin (estava como "Em breve")

*GuideModal:*
- [x] Nova aba "Atalhos de teclado" com grupos Chat e Navegação
- [x] Componente `Kbd` estilizado para exibir teclas
- [x] Shift+C (abrir chat), Esc (fechar chat), Shift+E/R/B/V/M/I/A (navegação)

*HomeScreen:*
- [x] Card 1: "Extrair conteúdo" + sub-badge "YouTube"
- [x] Card 2: "Incluir conteúdo" + sub-badge "Local"

**Explicação técnica:**
O bug do reset era silencioso: `os.path.join(DADOS_DIR, "agent_index")` produzia `Tusab\agent_index` — pasta inexistente — então o loop de deleção nunca encontrava arquivos e o `except Exception: pass` engolia o erro. A correção usa diretamente `INDEX_DIR` de `storage.py` (`Tusab\data\agent_index`). O padrão de refs (`prevExtractionStatus`, `prevIsRunningRef`) era necessário porque os effects do React reagem à mudança de estado — sem zerar os refs antes de atualizar o estado, o effect de "extração finalizou" poderia reativar o painel de status com os valores antigos antes do próximo render. A sub-aba Periodicidade foi implementada como UI pura (sem backend) marcada com PRO — o backend já tem o `AutoUpdateConfigRequest` e as rotas `/auto-update/*` implementadas em `router_extraction.py`, aguardando apenas o scheduler (APScheduler ou similar).

**Explicação simples:**
A Visão Geral virou o painel de controle completo do Tusab: mostra tudo que foi indexado, quantas perguntas foram feitas em cada projeto, e filtra por tipo de arquivo. O reset total parava de funcionar silenciosamente — limpava os arquivos mas deixava o "catálogo" intacto, então os projetos continuavam aparecendo. Agora apaga tudo, volta para a tela inicial e confirma com um aviso verde. A aba de Periodicidade mapeia a feature de atualização automática para os usuários Pro — deixa claro o que vai existir, sem quebrar nada no produto atual.

---

## 3. Histórico de sessões

| Data | Sessão | Itens |
|------|--------|-------|
| 11/06/2026 | Sprint de confiabilidade | P0: locks + escrita atômica ✅ · telemetria ✅ · P1: pytest + CI ✅ · recovery de índice ◐ · bônus requirements ✅ |
| 12/06/2026 | Modularização do monólito | P3: tusab_engine/ completo (storage · state · agent · motor · api) · api_tusab.py 1 189 → 165 linhas · electron-builder atualizado · 23/23 pytest ✅ |
| 12/06/2026 | P0 completo + UX P1 | P0: requirements-lock ✅ · build.ps1 ✅ · i18n 11 chaves ✅ · rate-limit/Pydantic/mascaramento ✅ · política de privacidade ✅ · P1: Ollama offline ✅ · recriar-índice UI ✅ · visibilitychange polling ✅ · 23/23 pytest ✅ |
| 12/06/2026 | Smoke test Electron dev mode | Diagnóstico ELECTRON_RUN_AS_NODE=1 (VS Code define esta var que faz Electron rodar como Node.js puro, sem browser process) · fix em build.ps1 · smoke test dev mode ✅ (Electron vivo 8s+) |
| 12/06/2026 | Setup empacotamento + smoke test packaged | python_env/ (Python 3.12.10 + 76 pacotes) ✅ · bin/yt-dlp.exe ✅ · build.ps1 encoding fix (UTF-8→UTF-16 LE) ✅ · build completo --dir ✅ · tusab.exe packaged smoke test HTTP 200 em 2s ✅ |
| 13/06/2026 | P1: ModalWrapper + NSIS + toast erros | ModalWrapper (focus trap + Escape + backdrop, 7 modais + 2 portals) ✅ · Toast de erro (4 ações silenciosas) ✅ · NSIS installer (tusab Setup 2.0.0.exe) ✅ · logo dark mode corrigida ✅ · onboarding tela 1 refinada ✅ |
| 15–19/06/2026 | Freemium groundwork + UX | Pro groundwork (exports zip/docx/xlsx/pdf) · ProSnackbar · canal limit · repositório drag-and-drop + upload imagens · barra de busca avançada · relatório com filtros/views · chat textarea · drive disconnect · Visão Geral v1 |
| 19/06/2026 | Visão Geral v2 + Reset fix + Periodicidade Pro | Visão Geral: KPIs, imagens/áudios, acessibilidade, videos_mapeados ✅ · IndexarModal: busca + scroll ✅ · Cancelamento com fila: modal fork ✅ · Reset total: path fix (INDEX_DIR), home nav + toast ✅ · Chat stats persistentes (_chat_stats.json) ✅ · Periodicidade: sub-aba Extração com hero Pro + tabela preview ✅ · Admin: Limpar saiu da sidebar ✅ · HomeScreen cards renomeados ✅ · GuideModal: aba atalhos ✅ · 15/15 smoke tests ✅ |

---

## 4. Próximo alvo sugerido

**P0 e P1 concluídos. Freemium groundwork implementado. Site publicado em tusab.solutions.**

### Próximos passos técnicos (por prioridade)

**Código — Alta prioridade:**
1. **Periodicidade Pro — backend** — scheduler real (APScheduler ou `schedule`) que dispara `tusab_engine()` nos horários configurados por canal; config já persistida via `/auto-update/config`
2. **Refatoração App.jsx** (P3) — extrair abas como componentes autônomos; App.jsx está com ~2 100 linhas
3. **Keychain para API keys** (P3) — `keytar` para armazenar chaves de forma segura no sistema operacional

**Código — Média prioridade:**
4. **Sidebar — ícone Agente** Settings→Wrench + item Admin com Settings
5. **Chat — sobreposição botão vs scroll-to-top** — z-index/posição
6. **Admin — Notificações do sistema** — alertas de disco, versão nova, índice desatualizado

**Go-to-market (P2, sem código):**
1. **OAuth em produção** — liberado pela política de privacidade já aprovada
2. **GitHub Releases** — disponibilizar o instalador publicamente
3. **INPI** — registro de marca (em andamento)
4. **Lemon Squeezy** — pagamentos após validação de preço com primeiros clientes

### Riscos mapeados para a feature de Periodicidade
- **Scheduler no Electron:** APScheduler em thread separada pode conflitar com o shutdown do uvicorn — usar `atexit` ou `lifespan` do FastAPI para cleanup seguro
- **Múltiplas extrações simultâneas:** o `run_motor()` atual é single-threaded (usa `state.evento_cancelar`); o scheduler precisaria enfileirar (via `extraction_queue`) em vez de disparar diretamente
- **Notificações desktop no Windows:** requer `win10toast` ou Electron's `Notification` API — o backend não tem acesso direto ao desktop; melhor acionar via IPC Electron
- **Sem risco de breaking change:** as rotas `/auto-update/*` já existem e o frontend já chama `saveAutoUpdateConfig`; a feature é puramente aditiva

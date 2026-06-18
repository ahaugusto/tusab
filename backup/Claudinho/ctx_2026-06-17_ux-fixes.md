# Contexto — Sessão 2026-06-17 (UX fixes)

## O que foi feito nesta sessão

### 1. Query expansion — toggle na configuração do agente
- `tusab_engine/agent/chat.py`: `_recuperar_contexto()` agora lê `config.get('query_expansion', False)` — desligado por padrão. Expansion só roda se o usuário ativar explicitamente
- `web_interface/src/App.jsx`:
  - Estado `queryExpansion` (default `false`)
  - Carregado do `agent_config.json` no mount (`r.data.query_expansion`)
  - Toggle "Busca inteligente" adicionado na seção de configuração do agente, após o bloco de API key
  - Salva imediatamente em `agent_config.json` ao toggling (merge com config existente)
  - Label claro: "Gera variações da sua pergunta para encontrar mais resultados. Adiciona 1–3s por resposta."

### 2. Markdown — quebras de parágrafo
- `ChatDrawer.jsx`: pré-processamento com regex antes de passar ao ReactMarkdown:
  `msg.content.replace(/(?<!\n)\n(?!\n)(?![-*+\d])/g, '\n\n')`
  Normaliza `\n` simples entre parágrafos para `\n\n` (padrão Markdown), preservando listas e blocos de código

### 3. Selects em dark mode
- Todos os `<select>` recebem `style={{ colorScheme: 'dark' }}` + background sólido `bg-[#1a2035]` em dark mode
- Arquivos: App.jsx, RelatorioTab.jsx, RepositorioTab.jsx, OllamaSetup.jsx, SidebarContent.jsx
- Problema: `<option>` não herda background do `<select>` no browser — renderizavam com fundo branco do SO

### 4. Accordions — direção do ícone corrigida
- App.jsx: 3 accordions (configOpen, telemetryOpen, indexOpen) usavam `rotate: open ? 180 : 0` com `ArrowUp`
- Corrigido para `rotate: open ? 0 : 180` — fechado aponta pra baixo (convida a abrir), aberto aponta pra cima

## Nota sobre geração de documentos pelo chat
- O chat RAG **não tem** funcionalidade de geração de documentos — ele apenas responde perguntas com base no índice BM25
- Os endpoints de export existem (`/export/resumo-canal` .docx, `/export/tabela-videos` .xlsx, `/export/relatorio-pdf`) mas são acionados pela UI, não pelo chat
- Para gerar documentos via chat seria necessário: detecção de intenção na mensagem + chamada ao endpoint de export + link de download na resposta — funcionalidade não implementada

## Estado do Ollama update
- `ensureOllama()` no Electron só instala se não estiver presente — NÃO faz update
- O Ollama tem auto-update nativo (verifica versão no boot) — comportamento correto, não interferir

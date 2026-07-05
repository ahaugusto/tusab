# Design System Tusab — Inventário de Componentes

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Criado:** 03/jul/2026 · Complementa [Design System — Tusab.md](Design System — Tusab.md) (tokens/fundações). Este documento mapeia **moléculas e organismos** — o que existe de fato em `web_interface/src/components/` (37 arquivos, ~12.500 linhas).

Legenda de status Figma: ✅ na lib v1 · 🔜 escopo v2 · 📋 mapeado (sem prioridade)

---

## 1. Shell do aplicativo

### 1.1 Navbar lateral (App.jsx `<nav>`) 🔜
Coluna fixa de ícones por aba, filtrada pelo perfil (`regras`). Item: botão de ícone `rounded-xl` com estado ativo (`bg-primary/15 text-primary`) vs inativo (`text-slate-500 hover:bg-white/8`).
**Badges de estado no item** (dot `w-1.5 h-1.5 rounded-full animate-pulse` no canto):
- `extracao`: dot `bg-warning` quando `isRunning`
- `admin`: dot `bg-warning` quando `appUpdateInfo` presente
- `agente`: dot `bg-secondary` quando agente configurado

### 1.2 Header de página (App.jsx:1456) 🔜
`px-4..8 py-3..4 flex justify-between border-b backdrop-blur-sm` + sombra suave. **Dois estados exclusivos**:
- **Ocioso**: `<h1>` título da aba (`text-xl/2xl font-bold`) + subtítulo `@canal` em `text-xs`
- **Extração ativa**: `StatusDot` + label "STATUS" (`text-[11px] uppercase tracking-widest`) + status vivo (`aria-live="polite"`) colorido por estado + ETA (`Loader2 animate-spin` + "~Xmin restantes")

À direita: chip de perfil (some quando Drive autenticado — WARN-25), chip verde Drive, toggle tema, botão de menu mobile.

### 1.3 Sidebar (SidebarContent.jsx, 478 linhas) 🔜
Painel de controle da extração: logo, input de URL com wrapper de foco (borda sinaliza, não o input — padrão de inputs §6.1), botões Iniciar/Pausar/Cancelar, fila (lista + reordenação), DriveToggle (ver Toggle ✅), select de idioma, links legais. Mobile: drawer com backdrop.

---

## 2. Sistema de modais

### 2.1 O contrato — `ModalWrapper` (shared/) 🔜
Todo modal DEVE passar por ele: `createPortal(modal, document.body)` · backdrop `bg-black/75` (customizável) · `role="dialog"` + `aria-modal` + focus trap + restauração de foco · `aria-hidden` no `#root` com contador (`openCount`) · props: `zIndex` (obrigatória ao empilhar sobre landing), `skipAriaHidden`, `disableBackdrop`, `disableEscape`, `label`.
Corpo canônico: `bg-[#0C1122] border-white/15` (dark) / `bg-white border-slate-200` (light), `rounded-2xl shadow-2xl`, `max-height: min(90vh, ...)` com scroll interno.

### 2.2 Inventário dos modais (14) 📋

| Modal | Arquivo | Padrão específico |
|-------|---------|-------------------|
| ExtractionModal | extraction/ (522 l.) | Wizard de 3 steps (projeto → URL → fontes) com stepper; alerta amber de canal já extraído; card de confirmação ao selecionar projeto existente |
| PostExtractionModal | extraction/ | Ações pós-extração (indexar, Drive, relatório) |
| ReferenciarModal | chat/ (462 l.) | Busca federada: input de busca + filtro por base + resultados agrupados por canal com seleção múltipla + highlight âmbar do termo |
| QueueManagerModal | modals/ | Lista reordenável da fila |
| CancelQueueModal | modals/ | Confirmação destrutiva (padrão danger) |
| ResetModal | modals/ | Confirmação destrutiva com digitação de confirmação |
| ProHintModal / ProSnackbar | modals/, shared/ | Upsell Pro |
| UpdateSuccessModal | modals/ | Pós-update com versão + link de novidades |
| AlterarPerfilModal | shared/ | Troca de perfil |
| AprofundarModal | shared/ | Sumarização LLM com progresso em tempo real |
| ConsentModal | shared/ | Telemetria opt-in; `fixed z-50` próprio + prop `zIndex` (bug v1.0.13) |
| DriveWarningModal | shared/ | Aviso único pré-OAuth |
| GuideModal | shared/ | Guia por perfil |
| Onboarding | shared/ (339 l.) | 2 ModalWrappers (step perfil + steps 1–8), ambos exigem `zIndex` + `skipAriaHidden` (bugs v1.0.12–17) |
| IndexarModal | dentro de RepositorioTab | Checkboxes por projeto; desmarcar todas desabilita Confirmar |

**Regra de ouro:** modal novo = `ModalWrapper` + revisão do `/design-system`. Os 4 bugs de z-index/aria da história vieram todos de desvios deste contrato.

---

## 3. Chat (ChatDrawer.jsx — 2.376 linhas, o maior organismo) 🔜

### 3.1 Drawer
Painel lateral direito `fixed`, dois tamanhos (normal / expandido via `Shift+< >`), header com título + base ativa + toolbar, corpo com scroll (`custom-scrollbar`), input fixo embaixo. Botão flutuante de abertura com glow pulsante + badge de status.

### 3.2 Bolhas de mensagem (4 papéis)
`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed` + sombra dark com `inset highlight`:
- **user**: `bg-primary/25 border-primary/35` + `rounded-br-sm` (canto reto no lado do autor), alinhada à direita
- **assistant**: `bg-white/8 border-white/10` + `rounded-bl-sm`, markdown renderizado (ReactMarkdown + GFM), alinhada à esquerda
- **error**: `bg-danger/15 border-danger/30 text-danger`
- **queued**: à direita, estilo esmaecido aguardando vez
- **export**: bolha-link de download com ícone

### 3.3 Chips de contexto na bolha
`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border` — **cor por modo**: `@` arquivo = âmbar (`bg-amber-500/20 border-amber-500/40`), `@@` trecho = ciano (`bg-cyan-500/20 border-cyan-500/40`). Emoji + modo em mono 9px + label truncado 140px.

### 3.4 Fontes da resposta
Lista pós-resposta: título do vídeo/doc + link `▶ MM:SS` (abre YouTube no minuto) + botão "Trecho" que expande o chunk original + botões 👍/👎 (feedback RLHF local).

### 3.5 Dropdown de menção (`@` / `@@`)
Flutuante sobre o input: lista de arquivos (modo `@`) ou resultados BM25 com termo destacado em âmbar (modo `@@`), navegável por teclado, loading state próprio.

### 3.6 Input + toolbar
Textarea auto-expansível com wrapper de foco; toolbar: toggle Busca Ampla, 🔍 Referenciar, limpar conversa; chips de fontes fixadas acima do input; fila de mensagens (contador; máx. 5).

### 3.7 Estados do chat
- **Streaming**: cursor pulsante na bolha assistant + frases de loading com dicas de uso rotativas
- **`sem_contexto: true`**: botão inline "Indexar base agora" dentro da mensagem
- **Sem base selecionada**: modal de seleção (com `baseModalDismissedRef` para não reabrir em loop)
- **Saudação/CONVERSA**: resposta sem fontes

---

## 4. Feedback global ("situações") 🔜

| Componente | Anatomia | Uso |
|-----------|----------|-----|
| **ProgressToast** (shared/) | `fixed bottom-24 right-6 z-50 max-w-xs rounded-2xl border p-4 shadow-2xl` + Framer (y+scale); tipos success/error/info (CheckCircle2/AlertCircle/Info); botão opcional "próximo passo" com ArrowRight; auto-close 6s; **desloca-se com o drawer aberto** (`offsetRight`) | Confirmações pós-ação com CTA de próximo passo |
| **Snackbar de indexação** (RepositorioTab) | `fixed bottom-24 left-1/2 -translate-x-1/2 zIndex 99999` pill `rounded-xl shadow-2xl text-xs font-bold pointer-events-none` via portal | Indexação concluída |
| **Banner de update** (App.jsx) | `fixed bottom-4` card warning com 2 estados (baixando + link manual / pronto + botão instalar); só fora da HomeScreen | electron-updater |
| **StatusDot** (App.jsx) | dot colorido por estado da extração (running=pulse, paused=warning) | Header |
| **Notificação nativa** (Electron) | `new Notification` com clique-ação | Extração/chat/update em background |

## 5. Estados vazios, loading e erro (padrões transversais) 🔜

- **Empty state**: ícone grande `text-slate-600` + título `text-xs font-bold` + descrição `text-[10px]` + CTA tonal — usado em Repositório vazio, Histórico vazio, Relatório sem canal
- **Loading de seção**: `Loader2 animate-spin` + texto `text-[10px] text-slate-500`; skeleton não é usado (decisão: spinners)
- **Erro de seção**: InlineFeedback ✅ (`role="alert"`)
- **Progresso de operação longa**: barra `h-1.5 rounded-full bg-white/10` + fill `bg-secondary` com `transition-all duration-300` + % — usada em pull de modelo Ollama, indexação, Aprofundar base
- **Métricas indisponíveis** (MonitorTab): card amber com título/descrição/CTA — padrão para qualquer feature degradada declarar-se (lição do psutil)

## 6. Formulários 📋

- **6.1 Input com wrapper de foco**: o container recebe `border + ring` no foco; o input interno tem `outline: none` (index.css). Wrapper: `rounded-lg border px-2 py-1 bg-white/5 border-white/15`
- **6.2 Textarea do chat**: auto-resize, mesmo padrão de wrapper
- **6.3 Select nativo estilizado**: `rounded-lg border text-[11px]` (idioma, projeto no Estudo)
- **6.4 Checkbox custom**: quadrado `rounded border` com check `bg-primary` (IndexarModal, fontes de extração)
- **6.5 API key input**: com botão olho (mostrar/ocultar) e placeholder mascarado `••••`
- **6.6 Sub-tabs**: underline `border-b-2 border-primary` no ativo, `text-slate-500` no inativo — **nunca pill/segmented** (decisão v1.0.11)

## 7. Dados e conteúdo 📋

- **StatCard** (shared/) 🔜: `p-4/5 rounded-2xl flex gap-4 border hover:border-primary/40` + ícone em caixa `p-3 rounded-xl bg-{color}/15 text-{color}` + label `text-[11px] uppercase tracking-widest` + valor `text-xl/2xl font-bold` (reduz se >8 chars) + botão pasta opcional. `role="status"`. ⚠️ usa `bg-${color}/15` interpolado — classes precisam estar no safelist do Tailwind
- **LogLine** (shared/): linha mono com cor semântica **derivada do conteúdo** (`logMeta()`: ✅→secondary, ❌→danger, ⚠️→warning, 🧠→violet, 📡→cyan, ☁️→violet) + label de acessibilidade
- **Tabela de vídeos** (RelatorioTab): header `text-[10px] uppercase`, linhas `text-[11px]` com hover, badges de status por vídeo
- **Accordion de canal** (RepositorioTab): header clicável com contadores + chevron, corpo com lista de arquivos e ações
- **Sparkline + GaugeBar** (MonitorTab): SVG polyline 200×40 + barra `h-1.5` com fill colorido
- **Flashcard 3D** (EstudoTab): flip animado frente/verso + progress bar de sessão

## 8. Superfícies especiais 📋

- **LandingScreen**: CircuitBackground (canvas PCB animado, `interactive={false}`) + logo com pulso (`usePulseLogo`) + seletores de idioma/tema + CTA — **sem `autoFocus`** (invariante v1.0.17)
- **HomeScreen**: CircuitBackground `interactive={true}` (glow no mouse) + cards por perfil
- **CircuitBackground**: constantes no topo (`GRID`, `NUM_PATHS`, `MAX_PULSES`, `PULSE_SPEED`, `MOUSE_RADIUS`)
- **help.html** (Electron, fora do React): réplica do tema em CSS puro — mudanças de token precisam ser replicadas manualmente ⚠️

---

## 9. Escopo Figma v2 (proposto, em ordem de valor)

1. **Chat kit**: bolhas (4 papéis) + chips @/@@ + fonte com ▶ timestamp + input/toolbar — o organismo mais visto do produto
2. **Modal template**: ModalWrapper como componente com slots (header/body/footer) + variante de confirmação destrutiva
3. **Shell**: navbar item (com variants de badge) + header (2 estados) 
4. **Feedback**: ProgressToast (3 tipos) + snackbar + banner de update
5. **Formulários**: input wrapper, select, checkbox, sub-tabs
6. **StatCard + empty state + progress bar**

## 10. Dívidas de consistência encontradas no levantamento

| Item | Problema | Ação sugerida |
|------|----------|---------------|
| `StatCard` com `bg-${color}/15` interpolado | Classe dinâmica pode ser purgada pelo Tailwind | Mapear para classes estáticas ou safelist |
| `ConsentModal` fora do ModalWrapper | `fixed z-50` próprio já causou bug (v1.0.13) | Migrar para ModalWrapper (DS-1) |
| Snackbar de indexação com `zIndex 99999` inline | Fora da escala de z-index | Tokenizar camadas de z-index no DS |
| `help.html` com tema duplicado em CSS puro | Drift silencioso ao mudar tokens | Checklist de release: conferir help.html a cada mudança de token |
| Sombras dark ad-hoc no chat (`boxShadow` inline) | Não tokenizadas | Criar effect styles no Figma v2 + documentar as 2 elevações |

# Acessibilidade e WCAG — Tusab

**Auditoria realizada em:** 24/06/2026  
**Padrão de referência:** WCAG 2.1 nível AA  
**Escopo:** Interface web em `web_interface/src/`

---

## Status Geral

| Área | Conformidade |
|------|-------------|
| Estrutura HTML semântica | ✅ Conforme |
| Foco visível e navegação por teclado | ✅ Conforme (global via `index.css`) |
| prefers-reduced-motion | ✅ Conforme (global via `index.css`) |
| Modais com trap de foco e aria-modal | ✅ Conforme (`ModalWrapper.jsx`) |
| Skip-nav link | ✅ Conforme (`App.jsx`) |
| lang no HTML | ✅ Conforme (`index.html`: `lang="pt-BR"`) |
| Contraste de texto (AA) | ⚠️ Maioria OK — exceções documentadas abaixo |
| Labels em formulários | ⚠️ Textarea do chat sem label |
| Tooltips acessíveis via teclado | ⚠️ Tooltip da sidebar só via hover |
| aria-live para conteúdo dinâmico | ⚠️ Parcial — snack e streaming do chat |

---

## Decisões de Implementação

### Foco visível global

Implementado em `web_interface/src/index.css` com `:focus-visible`:

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

Todos os botões interativos usam a constante `BTN_FOCUS` definida em `App.jsx`:
```js
const BTN_FOCUS = 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none';
```

### prefers-reduced-motion

Todas as animações Framer Motion são reduzidas quando o usuário configura preferência no SO:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Modais

`ModalWrapper.jsx` implementa:
- `role="dialog"`
- `aria-modal="true"`
- `aria-label={label}` (recebe prop)
- Trap de foco automático via `useEffect` com `focusTrap`

---

## Problemas Identificados e Status

### Críticos (WCAG AA — devem ser corrigidos)

| ID | Critério WCAG | Problema | Arquivo | Status |
|----|--------------|---------|---------|--------|
| A01 | 1.4.3 Contraste | `text-slate-400` light mode (≈ 3.2:1) nos cards da HomeScreen — abaixo do mínimo 4.5:1 | `HomeScreen.jsx:223` | 🔴 Pendente |
| A02 | 1.4.3 Contraste | `text-slate-400` dark mode (≈ 3.0:1) no tagline da LandingScreen — abaixo de 4.5:1 | `LandingScreen.jsx:101` | 🔴 Pendente |
| A03 | 1.3.1 Info e Relacionamentos | Textarea do chat sem `<label>` associada — placeholder não substitui label | `ChatDrawer.jsx:1081` | 🔴 Pendente |

### Importantes (recomendados para conformidade)

| ID | Critério WCAG | Problema | Arquivo | Status |
|----|--------------|---------|---------|--------|
| B01 | 4.1.3 Mensagens de Status | Snack de chat sem `aria-live` — leitores de tela não anunciam | `App.jsx:1614` | ✅ Corrigido (v1.0.1) — `role="status" aria-live="polite"` adicionado |
| B02 | 2.4.3 Ordem de Foco | Tooltip do agente na sidebar só visível via hover, não via focus | `App.jsx:1090` | ✅ Corrigido (v1.0.1) — `group-focus:opacity-100` adicionado |
| B03 | 4.1.2 Nome, Função, Valor | Switch de busca ampla sem `aria-label` descritivo | `ChatDrawer.jsx:468` | 🟡 Aceito — `role="switch"` e `aria-checked` presentes |
| B04 | 1.3.5 Identificar Propósito | Dropdown de @menção sem `role="listbox"` | `ChatDrawer.jsx:1019` | 🔴 Pendente |
| B05 | 2.4.6 Cabeçalhos e Labels | Ausência de `<h1>` semântico em LandingScreen | `LandingScreen.jsx` | 🔴 Pendente |
| B06 | 4.1.3 Mensagens de Status | Respostas do assistente no streaming sem `aria-live` | `ChatDrawer.jsx:967` | 🔴 Pendente |
| B07 | 1.1.1 Conteúdo Não Textual | Botões de ação (copiar, PDF, doc) com `title` mas sem `aria-label` | `ChatDrawer.jsx:905-960` | 🔴 Pendente |

### Menores (boas práticas)

| ID | Problema | Arquivo | Status |
|----|---------|---------|--------|
| C01 | Emojis decorativos sem `aria-hidden` nos cards da HomeScreen | `HomeScreen.jsx:42` | 🟡 Aceito — emoji como texto não prejudica leitores |
| C02 | `h2` do modal Onboarding sem `id` para `aria-labelledby` | `Onboarding.jsx:121` | 🔴 Pendente |
| C03 | Cards de perfil no Onboarding seriam semanticamente melhor como `role="radio"` | `Onboarding.jsx:128-139` | 🔴 Pendente |
| C04 | Botão do logo no drawer mobile sem `aria-label` explícito | `App.jsx:1132` | 🔴 Pendente |

---

## Snack de Primeiro Acesso

### Comportamento esperado

O snack `"Pergunte à sua base →"` é exibido automaticamente **4 segundos após** a primeira indexação ser detectada em sessão, **desde que** o usuário nunca tenha aberto o chat antes.

**Condições para exibição:**
1. `agentStatus.indexed === true` (há ao menos uma base BM25 indexada)
2. `chatJaAberto === false` (localStorage `tusab_chat_ja_aberto` ≠ `'1'`)
3. `chatSnackFiredRef.current === false` (disparou no máximo uma vez por sessão)

**Duração:** 10 segundos, depois some automaticamente.

**Se o snack não aparece:** o usuário provavelmente já abriu o chat em alguma sessão anterior. Isso é comportamento intencional — o snack é guia de descoberta para novos usuários, não um banner permanente.

**Para resetar (dev/testes):**
```js
localStorage.removeItem('tusab_chat_ja_aberto')
```

### Acessibilidade

O container do snack tem `role="status" aria-live="polite"` — leitores de tela anunciam o texto quando ele aparece, sem interromper a leitura em andamento.

---

## Tooltip do Chat

### Tooltip do botão flutuante (FAB)

O botão flutuante de chat (canto inferior direito) exibe um tooltip nativo via atributo `title` ao hover/focus. Renderizado pelo browser — compatível com todos os leitores de tela.

```jsx
<motion.button
  title={t('chat.open_tooltip')}
  aria-label={t('chat.open_tooltip')}
  ...
/>
```

Chaves de tradução: `chat.open_tooltip` em `pt.json`, `en.json`, `es.json`.

### Tooltip do agente na sidebar

A aba "Agente" na sidebar exibe um tooltip com status do provider configurado quando há provider ativo (Groq, OpenAI, Ollama etc.). Aparece ao hover **e** ao focus (`group-hover:opacity-100 group-focus:opacity-100`).

```html
<!-- Estado: "Agente pronto · groq" ou "Ollama ativo · llama3.2" -->
<div role="tooltip" class="... group-hover:opacity-100 group-focus:opacity-100 ...">
```

**Se o tooltip não aparece:** o agente não está configurado (`agentStatus.configured === false`) **e** o Ollama não está rodando (`ollamaStatus?.running === false`). Configure um provider na aba Agente.

---

## Checklist de Conformidade WCAG 2.1 AA

### Perceptível (Princípio 1)

| Critério | Título | Status |
|---------|--------|--------|
| 1.1.1 | Conteúdo Não Textual | ⚠️ Parcial — botões de ação do chat sem aria-label |
| 1.2.x | Mídia Baseada em Tempo | ✅ N/A — sem áudio/vídeo na interface |
| 1.3.1 | Informações e Relacionamentos | ⚠️ Textarea do chat sem label |
| 1.3.2 | Sequência Significativa | ✅ Conforme — ordem DOM é lógica |
| 1.3.3 | Características Sensoriais | ✅ Conforme |
| 1.3.4 | Orientação | ✅ Conforme — sem bloqueio de rotação |
| 1.3.5 | Identificar Propósito de Entrada | ⚠️ Dropdown de menção sem role |
| 1.4.1 | Uso de Cor | ✅ Conforme — informação nunca só por cor |
| 1.4.2 | Controle de Áudio | ✅ N/A |
| 1.4.3 | Contraste (Mínimo) | ⚠️ 2 falhas: HomeScreen cards + Landing tagline |
| 1.4.4 | Redimensionar Texto | ✅ Conforme — unidades relativas (rem/em) |
| 1.4.5 | Imagens de Texto | ✅ Conforme — texto real em todos os casos |
| 1.4.10 | Refluxo | ✅ Conforme — layout responsivo |
| 1.4.11 | Contraste de Componentes | ✅ Conforme — bordas e controles visíveis |
| 1.4.12 | Espaçamento de Texto | ✅ Conforme |
| 1.4.13 | Conteúdo em Hover ou Focus | ⚠️ Tooltip de agente só no hover (corrigido em v1.0.1) |

### Operável (Princípio 2)

| Critério | Título | Status |
|---------|--------|--------|
| 2.1.1 | Teclado | ✅ Conforme — tudo acessível por teclado |
| 2.1.2 | Sem Armadilha de Teclado | ✅ Conforme — trap de foco apenas em modais |
| 2.1.4 | Atalhos de Teclado | ✅ Documentado — `C` abre chat, `B/E/A/I/M/V/H` trocam abas, `Esc` fecha |
| 2.2.1 | Limite de Tempo | ✅ Conforme — sem sessões com timeout automático |
| 2.3.1 | Três Flashes | ✅ Conforme — sem flashes |
| 2.4.1 | Ignorar Blocos | ✅ Conforme — skip-nav link presente |
| 2.4.2 | Página com Título | ✅ Conforme — `<title>Tusab</title>` |
| 2.4.3 | Ordem de Foco | ✅ Conforme — ordem DOM = ordem lógica |
| 2.4.4 | Finalidade do Link | ✅ Conforme — todos os links e botões com label |
| 2.4.6 | Cabeçalhos e Labels | ⚠️ LandingScreen sem h1 |
| 2.4.7 | Foco Visível | ✅ Conforme — ring visível via BTN_FOCUS + index.css |
| 2.5.1 | Gestos de Ponteiro | ✅ Conforme — sem gestos multitouch obrigatórios |
| 2.5.3 | Label no Nome | ✅ Conforme — aria-labels descritivos |

### Compreensível (Princípio 3)

| Critério | Título | Status |
|---------|--------|--------|
| 3.1.1 | Idioma da Página | ✅ Conforme — `lang="pt-BR"` no HTML |
| 3.1.2 | Idioma das Partes | ✅ i18n via react-i18next |
| 3.2.1 | Em Foco | ✅ Conforme — foco não muda contexto |
| 3.2.2 | Em Entrada | ✅ Conforme — mudanças requerem ação |
| 3.3.1 | Identificação de Erro | ✅ Conforme — erros com mensagem textual |
| 3.3.2 | Rótulos ou Instruções | ⚠️ Textarea do chat sem label (placeholder apenas) |

### Robusto (Princípio 4)

| Critério | Título | Status |
|---------|--------|--------|
| 4.1.1 | Análise | ✅ Conforme — JSX compilado para HTML válido |
| 4.1.2 | Nome, Função, Valor | ⚠️ Switch de busca e dropdown sem roles completos |
| 4.1.3 | Mensagens de Status | ⚠️ Streaming do assistente sem aria-live |

---

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `C` | Abrir/fechar chat (quando fora de input) |
| `Esc` | Fechar chat / colapsar chat expandido |
| `<` / `>` | Expandir / recolher chat lateral |
| `B` | Ir para aba Repositório |
| `E` | Ir para aba Extração |
| `A` | Ir para aba Admin |
| `I` | Ir para aba Agente |
| `M` | Ir para aba Monitor |
| `V` | Ir para Visão Geral |
| `H` | Ir para Histórico |

---

## Próximos Passos (Backlog de Acessibilidade)

**Prioridade alta:**
- [ ] Corrigir contraste em `HomeScreen.jsx` — mudar `text-slate-400` → `text-slate-600` em descrições de cards (light mode)
- [ ] Corrigir contraste em `LandingScreen.jsx` — mudar tagline `text-slate-400` → `text-slate-300` (dark mode)
- [ ] Adicionar `<label className="sr-only">` à textarea do chat em `ChatDrawer.jsx`

**Prioridade média:**
- [ ] Adicionar `aria-live="polite"` ao container de streaming do assistente no chat
- [ ] Adicionar `role="listbox"` e `role="option"` no dropdown de @menção
- [ ] Adicionar `aria-label` nos botões de ação (copiar, exportar PDF/doc/xlsx)
- [ ] Adicionar `<h1 className="sr-only">` na LandingScreen

**Prioridade baixa:**
- [ ] `id` no h2 do Onboarding + `aria-labelledby` no dialog
- [ ] `aria-label` no botão do logo no drawer mobile
- [ ] Considerar `role="radio"` nos cards de perfil do Onboarding

---

## Ferramentas para Auditorias Futuras

- **axe DevTools** — extensão Chrome/Firefox para varredura automatizada
- **NVDA** (Windows) — leitor de tela gratuito para testes
- **Colour Contrast Analyser** — ferramenta desktop para medir contraste
- **axe-core** no Jest — `@axe-core/react` para testes automatizados de acessibilidade

---

*Mantido pela equipe CriAugu. Atualizar após cada release significativo.*

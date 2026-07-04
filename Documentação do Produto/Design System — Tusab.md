# Design System Tusab

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Criado:** 03/jul/2026 · **Fonte da verdade:** este documento reflete o código em produção (levantamento por grep em `web_interface/src/`, jul/2026). Divergência entre doc e código = bug de documentação; abrir correção.

---

## 1. Princípios

1. **Dark-first** — o tema escuro é o principal (`darkMode: 'class'` no Tailwind); o light é derivado. Todo componente nasce com os dois estados via ternário `darkMode ? ... : ...`.
2. **Densidade compacta** — o Tusab é uma ferramenta de trabalho, não um site. A escala tipográfica opera 2 pontos abaixo do padrão web (corpo em 12px, apoio em 10–11px).
3. **Acessibilidade não é camada, é fundação** — focus ring universal, `prefers-reduced-motion`, contrastes WCAG documentados no próprio CSS, `aria-*` obrigatório em interativos.
4. **Tokens antes de valores** — cor sempre via token semântico (`primary`, `warning`...), nunca hex solto em componente. Exceção documentada: superfícies dark via opacidade de branco (seção 2.3).

---

## 2. Cores

### 2.1 Tokens semânticos (`tailwind.config.js`)

| Token | Valor | Uso |
|-------|-------|-----|
| `primary` | `var(--color-primary)` — **#1558B0** (light) / **#4B9FE8** (dark) | Ação principal, links, foco, seleção. Contraste ≥5:1 nos dois modos (WCAG AA) |
| `secondary` | `#10B981` (emerald) | Sucesso, estados "ativo/conectado/indexado" |
| `accent` | `#06B6D4` (cyan) | Destaques informativos, chips de trecho fixado |
| `warning` | `#F59E0B` (amber) | Atualizações, alertas não-destrutivos, badges de atenção |
| `danger` | `#EF4444` (red) | Erros, ações destrutivas (deletar, reset) |
| `muted` | `#64748B` (slate-500) | Texto de apoio, ícones inativos |

`primary` é o **único token que muda por modo** — via CSS variable em `index.css`, não via classe `dark:`. Novos tokens que precisem variar por modo seguem o mesmo padrão (CSS var em `:root` / `.dark`).

### 2.2 Superfícies dark (hex fixos)

| Token | Valor | Uso |
|-------|-------|-----|
| `background` | `#080C18` | Fundo do app |
| `sidebar` | `#0C1122` | Sidebar e modais escuros (`bg-[#0C1122]`) |
| `card` | `#111827` | Cartões sólidos |
| `border` | `#1E2A40` | Bordas estruturais |

### 2.3 Elevação dark por opacidade de branco (padrão dominante — medido)

Em vez de hex por nível, o dark usa **branco com opacidade** sobre o fundo:

| Classe | Usos | Papel |
|--------|------|-------|
| `bg-white/3`–`bg-white/5` | ~130 | Superfície de card/section sobre o fundo (`bg-white/4` é o corpo de seção padrão) |
| `bg-white/8`–`bg-white/10` | ~140 | Hover, superfície interativa, chips |
| `border-white/8`–`border-white/10` | ~160 | Borda padrão de card/section |
| `border-white/15`–`border-white/20` | ~120 | Borda de controle interativo, hover |

**Regra:** card/section padrão dark = `bg-white/4 border-white/10`; equivalente light = `bg-white border-slate-200 shadow-sm`.

### 2.4 Light mode

Escala `slate` do Tailwind: texto `slate-700/800`, apoio `slate-400/500`, superfícies `bg-white`/`bg-slate-50`/`bg-slate-100`, bordas `border-slate-200`. Acentos coloridos usam a variante clara (`bg-amber-50 border-amber-200`, `bg-violet-50 text-violet-700`, `bg-emerald-50 border-emerald-200`).

---

## 3. Tipografia

**Famílias:** `Inter` (sans, corpo) · `JetBrains Mono` (mono — versões, IDs, nomes de modelo).

### Escala real (usos medidos em jul/2026)

| Classe | Tamanho | Usos | Papel |
|--------|---------|------|-------|
| `text-xs` | 12px | 266 | **Corpo padrão** — parágrafos, botões, títulos de card (`text-xs font-bold`) |
| `text-[10px]` | 10px | 252 | Apoio/caption — descrições, labels de seção (`uppercase tracking-wider`), badges |
| `text-[11px]` | 11px | 154 | Corpo secundário — mensagens de status, erros inline |
| `text-sm` | 14px | 81 | Títulos de página/seção principal |
| `text-[9px]` | 9px | 49 | Micro — metadados dentro de badges, tamanhos de arquivo |
| `text-base`+ | 16px+ | ~35 | Somente números de destaque (stats do Monitor: `text-2xl font-bold`) e hero da landing |

### Pesos e composições canônicas

- Título de seção de card: `text-xs font-bold uppercase tracking-wider`
- Label de coluna/categoria: `text-[10px] font-bold uppercase tracking-widest text-slate-500`
- Corpo de descrição: `text-[10px] leading-relaxed text-slate-500`
- Valor de stat: `text-2xl font-bold` + unidade em `text-xs text-slate-400`
- Código/versão: `font-mono` (`text-[10px] font-mono font-bold`)

**Regra:** não introduzir tamanhos fora da escala (`text-[13px]` etc.) — se precisar de um intermediário, o design está errado.

---

## 4. Espaçamento

Escala Tailwind padrão (base 4px). Composições canônicas medidas:

| Contexto | Padrão | Usos |
|----------|--------|------|
| Botão/controle | `px-3 py-2` (compacto) ou `px-4 py-2` (padrão) | 107/92 |
| Botão pequeno / chip | `px-2.5 py-1.5` | ~60 |
| Header de card/section | `px-5 py-3.5` | padrão fixo |
| Corpo de card/section | `p-4` ou `p-5` | 34/33 |
| Badge/pill | `px-2 py-0.5` | ~50 |
| Gap entre ícone e texto | `gap-1.5` ou `gap-2` | 92/174 |
| Empilhamento vertical de seções | `space-y-4` | 25 |
| Empilhamento interno | `space-y-2` / `space-y-3` | 27/22 |

---

## 5. Raio de borda

| Classe | Valor | Usos | Papel |
|--------|-------|------|-------|
| `rounded-xl` | 12px | 228 | **Controles** — botões, inputs, alertas inline |
| `rounded-lg` | 8px | 117 | Itens de lista, botões de ícone pequenos |
| `rounded-full` | — | 116 | Pills, badges, toggles, dots de status |
| `rounded-2xl` | 16px | 83 | **Cards e seções** — todo container de conteúdo |

**Regra:** container = `2xl`, controle = `xl`, item de lista = `lg`, pill/toggle = `full`. Sem `rounded-md`/`rounded-sm`.

---

## 6. Botões

### Foco (obrigatório em TODO interativo)
`BTN_FOCUS` de `constants/index.js`:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
```
Complementado pelo focus ring global de `index.css` (outline 2px `--color-primary`, offset 3px).

### Variantes canônicas

| Variante | Dark | Light | Uso |
|----------|------|-------|-----|
| **Primária (CTA)** | `bg-warning text-white hover:bg-warning/90 font-bold` | idem | Ações de destaque (Instalar e reiniciar) |
| **Primária tonal** | `bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25` | `bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100` | Ação principal de seção (Verificar atualização) |
| **Ghost/outline** | `border border-white/15 text-slate-400 hover:text-white hover:bg-white/8` | `border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100` | Ações secundárias (Cancelar) |
| **Destrutiva** | `bg-danger/15 text-danger border-danger/30` ou sólida `bg-danger text-white` | equivalente red-50 | Deletar, reset |
| **Ícone** | `p-1.5 rounded-lg text-slate-500 hover:bg-white/8` | `text-slate-400 hover:bg-slate-100` | Fechar, expandir — **`aria-label` obrigatório** |

**Estados:** `disabled:opacity-60 disabled:cursor-not-allowed`; loading = `Loader2` do lucide com `animate-spin` substituindo o ícone, texto muda ("Verificando…").
**Anatomia:** `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${BTN_FOCUS}`.

---

## 7. Componentes padrão

### Card/Section (o container universal)
```jsx
<section className={`rounded-2xl border overflow-hidden
  ${darkMode ? 'bg-white/4 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
  <div className={`px-5 py-3.5 flex items-center gap-2
    ${darkMode ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
    <Icone size={13-14} />
    <h3 className="text-xs font-bold uppercase tracking-wider flex-1">Título</h3>
    {/* badge/status à direita */}
  </div>
  <div className="p-5 space-y-3">{/* conteúdo */}</div>
</section>
```
Variante de alerta (update): `bg-warning/5 border-warning/25` (dark) / `bg-amber-50 border-amber-200` (light).

### Modal — SEMPRE via `ModalWrapper` (`components/shared/ModalWrapper.jsx`)
- `createPortal(modal, document.body)` — **nunca omitir o segundo argumento** (React #299, invariante 12)
- z-index **via prop `zIndex`**, nunca via wrapper pai (portal ignora contexto — bugs v1.0.12–15)
- `skipAriaHidden` quando renderizar sobre a landing
- Backdrop `bg-black/75` padrão; `role="dialog"`, `aria-modal`, focus trap e restauração de foco inclusos
- Nunca `autoFocus` em elemento do `#root` com modal aberta (invariante do aria-hidden, v1.0.17)

### Toggle switch
`role="switch"` + `aria-checked`; trilho `w-9 h-5` (sidebar) ou `w-11 h-6` (painéis) `rounded-full`; thumb branco com `transition`; cor: `bg-secondary` (ativo/conectado), `bg-primary` (processo), `bg-white/15|slate-200` (off). Estado de loading = `Loader2` girando dentro do trilho.

### Badge/pill
`text-[10px] font-bold px-2 py-0.5 rounded-full` + par cor/fundo tonal (`bg-warning/20 text-warning`). Versão mono para versões: `font-mono bg-white/8 text-slate-400`.

### Feedback inline
- Erro: `text-[11px] text-danger flex items-center gap-1` + `<AlertTriangle size={10}/>` + `role="alert"`
- Aviso: mesmo padrão em `text-warning`
- Status pós-ação: `role="status"`, cor por tom (`secondary` ok / `primary` info / `warning` problema)
- Snackbar: `fixed bottom-24/6 left-1/2 -translate-x-1/2 rounded-xl shadow-2xl text-xs font-bold` via portal

### Ícones
`lucide-react`, tamanhos 9–14px acompanhando o texto (10→9-10, xs→12-14). Decorativo = `aria-hidden="true"`; funcional sozinho = `aria-label` no botão.

---

## 8. Motion

- Transição global: 150ms `cubic-bezier(0.4,0,0.2,1)` em cores/opacity/shadow/transform (index.css) — não redeclarar
- Entradas/saídas: Framer Motion (`AnimatePresence`, `initial/animate/exit` com `opacity` + `y` de 20–40px)
- Pulso de atenção: `animate-pulse` em dots de status (`w-1.5 h-1.5 rounded-full bg-warning animate-pulse`)
- **`prefers-reduced-motion` é respeitado globalmente** — nunca sobrescrever

---

## 9. Acessibilidade (resumo normativo)

1. Focus visível universal (ring `primary`, offset 3px) — inputs sinalizam foco no wrapper
2. Contrastes âncora documentados: primary 5.2:1/5.0:1, scrollbar 3.1:1 (WCAG 1.4.11)
3. `aria-label` em todo botão de ícone; `role` correto (switch/dialog/alert/status)
4. `sr-only` disponível para contexto extra de leitor de tela
5. `aria-hidden` no `#root` durante modais (gerenciado pelo ModalWrapper — não replicar manualmente)

---

## 10. Anti-padrões (aprendidos a caro — ver `agents/_historia.md`)

| Nunca | Porquê |
|-------|--------|
| `createPortal` sem `document.body` | React #299 crash (v1.0.21) |
| z-index em div pai de componente com portal/`fixed` próprio | Ignorado pelo browser (v1.0.12–13) |
| `autoFocus` em elemento do `#root` com modal que seta `aria-hidden` | Trava silenciosa do onboarding (v1.0.17) |
| Pill/segmented em sub-abas | Padrão é underline `border-b-2 border-primary` (v1.0.11) |
| Hex solto em componente | Sempre token; superfícies dark via `white/N` |
| Tamanho de fonte fora da escala | A escala tem 6 degraus; intermediário = repensar hierarquia |
| Interativo sem `BTN_FOCUS` | Quebra WCAG 2.4.7 |

---

## 11. Roadmap do Design System

| Fase | Entrega | Gatilho |
|------|---------|---------|
| DS-1 | Extrair componentes recorrentes para `components/shared/` (`Card`, `Button`, `Badge`, `Toggle`, `InlineFeedback`) consumindo os padrões deste doc | Próxima feature de UI que tocar 3+ arquivos |
| DS-2 | Tokens de superfície dark como CSS vars (hoje `white/N` inline) | Junto com DS-1 |
| DS-3 | Tema por edição (Tusab Enterprise pode exigir identidade visual própria por contrato) | Fase 1 do plano B2B |
| DS-4 | Biblioteca Figma sincronizada com os tokens (via MCP Figma) | Quando houver designer externo colaborando |

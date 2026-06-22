## O que muda

<!-- Descreva o que foi alterado e por quê. Uma linha por mudança principal. -->

-

## Tipo de mudança

- [ ] Bug fix
- [ ] Nova feature
- [ ] Refactor
- [ ] Docs / configuração
- [ ] Outro: ___

---

## ✅ Smoke tests

```
.venv\Scripts\python.exe smoke_test.py
```

- [ ] 15/15 verde antes do merge

---

## 🔗 Checklist de impacto de dependências

> Consulte `Documentação do Produto/Mapa de Impacto de Dependências.md` para detalhes.
> Marque apenas os módulos que este PR toca.

### Backend

<details>
<summary><strong>motor/extraction.py</strong></summary>

- [ ] Algum `print()` com emoji foi alterado?  
  → Atualizar padrões em `tusab_engine/state.py:LogRedirector.write()`
- [ ] Estrutura dos arquivos `.txt` gerados mudou?  
  → Atualizar `agent/index.py:_parsear_todos_chunks()`

</details>

<details>
<summary><strong>tusab_engine/state.py</strong></summary>

- [ ] Alguma chave de `state.stats` foi renomeada ou removida?  
  → Atualizar `useStatus.js`, `ExtractionTab`, `StatCard`, reset em `App.jsx`
- [ ] `state.chat_histories` estrutura mudou?  
  → Atualizar `router_agent.py` e `useChatEngine.js`

</details>

<details>
<summary><strong>tusab_engine/storage.py</strong></summary>

- [ ] Alguma constante de path mudou?  
  → Executar migração de arquivos existentes antes de alterar
- [ ] Nova constante adicionada?  
  → Garantir que respeita `TUSAB_DATA_DIR` via `obter_caminho_dados()`

</details>

<details>
<summary><strong>agent/index.py</strong> (schema de chunks)</summary>

- [ ] Alguma chave dos chunks mudou (ex: `texto` → `content`)?  
  → Atualizar `chat.py:_recuperar_contexto()` e `_enriquecer_documento()`
- [ ] Todos os índices existentes precisam ser re-gerados após o deploy?

</details>

<details>
<summary><strong>agent/chat.py</strong></summary>

- [ ] Formato do stream mudou (protocolo de yield)?  
  → Atualizar `useChatEngine.js:parseMessageStream()`
- [ ] Campo `sem_contexto` foi removido ou renomeado?  
  → ChatDrawer usa esse campo para exibir "Indexar base agora"
- [ ] Enum `PERSONAS` mudou?  
  → Atualizar `_PERSONAS_VALIDAS` em `router_agent.py`

</details>

<details>
<summary><strong>router_agent.py</strong></summary>

- [ ] Shape de `/agent/status` mudou?  
  → Atualizar `useAgentConfig.js:DEFAULT_AGENT_STATUS`
- [ ] Algum campo do response foi renomeado?  
  → Buscar `agentStatus.{campo}` em todos os componentes frontend

</details>

### Frontend

<details>
<summary><strong>localStorage / sessionStorage</strong></summary>

- [ ] Alguma chave foi renomeada?  
  → Escrever migração: `localStorage.setItem(nova, localStorage.getItem(velha))`

</details>

<details>
<summary><strong>usePerfil.js — slugs de perfil</strong></summary>

- [ ] Algum slug em `PERFIS_META` foi renomeado?  
  → **Nunca renomear slug** sem migração explícita de localStorage

</details>

<details>
<summary><strong>services/api.js</strong></summary>

- [ ] Assinatura de alguma função mudou (parâmetros, URL, method)?  
  → Buscar todos os consumers: hooks e componentes que importam a função

</details>

---

## 📋 Mapa de Impacto atualizado?

- [ ] O `Mapa de Impacto de Dependências.md` foi atualizado se este PR introduz ou altera um contrato
- [ ] O `Changelog Técnico — v1.0.md` foi atualizado com a seção desta sprint

---

## Observações

<!-- Qualquer contexto adicional, decisão técnica não óbvia, ou coisa que o revisor deve saber. -->

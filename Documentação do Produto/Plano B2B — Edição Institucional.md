# Plano B2B — Tusab Edição Institucional

**© 2026 CriAugu — CNPJ 65.131.075/0001-57**
**Criado:** 02/jul/2026 · **Status:** aprovado em conceito, aguardando gatilho de execução

---

## Contexto e decisão

Em jul/2026 descobrimos que a stack semântica (torch + sentence-transformers + scikit-learn + keybert, ~2,5 GB) nunca entrou no `python_env` empacotado — CrossEncoder e KeyBERT sempre degradaram graciosamente no app instalado. O produto B2C distribuído é BM25 + FTS5, e funciona bem (zero reclamações de qualidade atribuíveis ao gap).

**Decisão:** transformar o acidente em segmentação deliberada.

| | Tusab (B2C) | Tusab Institucional (B2B) |
|---|---|---|
| Pipeline RAG | BM25 + FTS5 | BM25 + FTS5 + CrossEncoder + KeyBERT |
| Instalador | ~223 MB | ~1,5 GB |
| Hardware alvo | PC modesto (Estudante) | Estação corporativa |
| Semântica futura | Embeddings via Ollama (sem torch) | Stack completa + embeddings |
| Distribuição | GitHub Releases + auto-update | Deploy gerenciado por TI |

**Por que faz sentido:**
- A restrição que impede a stack no B2C (RAM, latência em CPU fraca, tamanho de download) não existe em hardware corporativo
- Corpus institucional (documentos internos, atas, transcrições de reunião) tem vocabulário mais heterogêneo — re-ranqueamento semântico rende mais que em transcrição de YouTube
- Local-first vira requisito de compliance (LGPD): o segmento onde "nada sai da máquina" fecha contrato
- "Busca semântica avançada" é diferenciador legível em proposta enterprise

**Alerta registrado:** a stack semântica é UM ingrediente, não O produto B2B. Instituição compra multiusuário, permissões, deploy, suporte e auditoria — nada disso existe hoje. Não prometer em proposta comercial o que não existe.

---

## Fase 0 — Pré-requisitos (antes de qualquer venda)

1. **Validar o valor semântico com corpus real** — benchmark interno A/B: mesmas perguntas contra base institucional (atas, PDFs internos), BM25+FTS5 vs +CrossEncoder. O "+236ms" de dev nunca foi validado com usuário; não vender o que não foi medido.
2. **Telemetria B2C como bússola** — `busca_ampla_toggled` no PostHog: se ninguém usa Busca Ampla no B2C, o apelo do re-ranqueamento como feature vendável é menor do que parece.
3. **Definir a persona compradora** — coordenador pedagógico (Tusab School), gestor de conhecimento, compliance officer. Os docs B2B em `Documentação do Produto/` já mapeiam segmentos.

## Fase 1 — Empacotamento (gatilho: primeiro lead B2B concreto)

1. **`requirements-institucional.txt`** — requirements.txt + torch (CPU), sentence-transformers, scikit-learn, keybert
2. **Script de build do python_env** — parametrizado por edição, roda `pip install -r` no ambiente limpo e valida com diff (invariante 15 automatizada). Nunca mais sync manual.
3. **Build variant no electron-builder** — `productName: "Tusab Institucional"`, `appId` distinto (`com.criaugu.tusab.institucional`), instalador separado
4. **Canal de update separado** — releases em repo privado com token, ou `latest.yml` em canal próprio; edição institucional NÃO atualiza pelo canal público
5. **QA específico** — checklist itens 6–8 + verificação de que CrossEncoder carrega e KeyBERT enriquece no app instalado (não confiar na degradação graciosa: ela mascara, como mascarou no B2C)
6. **Licenciamento** — chave por instituição com validação offline (local-first não pode depender de servidor de licença)

## Fase 2 — Escalabilidade técnica

1. **Modelo de implantação** — decidir entre:
   - (a) **Por estação** (recomendado para começar): instalação por seat, dados locais por máquina — zero mudança de arquitetura, vende licenças
   - (b) **Servidor departamental**: FastAPI já é servível em rede, mas exigiria auth, TLS, permissões por base e revisão dos locks (`agent_chat_lock` serializa o LLM — N usuários = fila) — só com contrato que pague o desenvolvimento
2. **Bases por departamento** — estrutura `data/neural/{projeto}` já suporta; falta UI de organização e permissões
3. **Deploy para TI** — NSIS silent install (`/S`), configuração pré-provisionada (provider, idioma, telemetria off por padrão em ambiente corporativo)
4. **Versionamento LTS** — instituição atualiza menos; manter branch estável com backports de segurança

## Fase 3 — Escalabilidade comercial

1. **Pricing** — por seat vs por instituição; ancorar no custo de alternativa (NotebookLM Enterprise exige nuvem Google — dealbreaker de compliance é o argumento)
2. **Pilotos** — 1–2 instituições com desconto em troca de estudo de caso; Tusab School como primeiro verticals (docs já existem)
3. **Material** — proposta com privacidade/LGPD como âncora, benchmark da Fase 0 como evidência

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Dois python_envs para manter (invariante 15 mostrou a fragilidade) | Script de build único parametrizado — nunca sync manual |
| Valor semântico não validado | Fase 0 obrigatória antes de proposta comercial |
| B2B exige o que não existe (admin, multiusuário, SSO) | Começar por licença por estação; prometer só o que está no instalador |
| Distração do B2C (motor de aquisição) | Gatilho por lead: nada da Fase 1 começa sem interessado concreto |

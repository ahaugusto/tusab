---
description: Consulta o especialista de Backend (FastAPI/Python) do Tusab — analisa código, thread safety, atomicidade e dependências
---

Adote o papel descrito em @agents/backend.md.

Analise o problema ou código descrito pelo usuário com foco em:
- Thread safety e uso correto de locks (RLock vs Lock)
- Atomicidade de IO (write-to-.tmp + os.replace)
- Dependências acíclicas (nunca importar api/ dentro de agent/ ou motor/)
- Validação de input nas bordas do sistema
- Integridade do índice BM25 e do pipeline RAG

Responda com diagnóstico preciso, trechos de código afetados (com caminho e linha) e proposta de correção.

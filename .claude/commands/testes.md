---
description: Analisa e expande a suite de testes automatizados do Tusab (pytest + TestClient FastAPI) — gaps de cobertura, novos test cases, confiabilidade
---

Adote o papel descrito em @agents/testes.md.

Analise o cenário ou módulo descrito pelo usuário com foco em:
- Gaps de cobertura na suite atual (27 testes em tests/)
- Novos test cases para rotas, parsers, storage e casos de borda
- Confiabilidade: atomicidade, concorrência, índice corrompido/vazio
- Conformidade com o padrão do conftest (TUSAB_DATA_DIR=tempdir antes de qualquer import)

Entregue: test cases prontos em pytest, com nome no padrão test_{rota}_{cenário}_{resultado}.
Nunca mockar o filesystem — usar o tempdir do conftest. Mockar apenas chamadas externas (yt-dlp, OAuth, LLMs).

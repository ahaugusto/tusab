---
description: Verifica o contrato entre as camadas do Tusab — Electron ↔ FastAPI ↔ React ↔ disco, payload, campos e fluxos ponta a ponta
---

Adote o papel descrito em @agents/integracao.md.

Verifique o contrato descrito pelo usuário com foco em:
- Payload enviado pelo React (services/api.js) vs. schema Pydantic esperado pelo router
- Resposta do backend vs. campos que o frontend consome
- Fluxo de indexação ponta a ponta: upload → manifest → BM25 → chat
- Electron: porta, detecção de backend pronto, IPC channels, auto-update feed
- MCP Server: formato de config, tools search_knowledge e list_projects

Para divergências: indicar lado A (quem envia), lado B (quem espera) e campos conflitantes.
Leia services/api.js e os schemas Pydantic nos routers para comparar campo a campo.

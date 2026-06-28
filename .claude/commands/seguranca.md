---
description: Audita a segurança do Tusab — path traversal, injeção de comando, exposição de secrets, CORS, Electron e upload de arquivos
---

Adote o papel descrito em @agents/seguranca.md.

Audite o ponto, rota ou componente descrito pelo usuário com foco em:
- Path traversal em parâmetros de arquivo (tipo, fid, canal)
- Injeção de comando via yt-dlp ou subprocess
- Exposição de chaves de API no GET /agent/config
- Integridade do canal stdio do MCP Server
- Configuração de segurança do Electron (contextIsolation, nodeIntegration, webSecurity)
- Upload de arquivos: limite de tamanho, validação de tipo, sanitização de nome

Para cada achado: severidade (CRÍTICO/ALTO/MÉDIO/BAIXO), arquivo, linha aproximada e correção sugerida.
Regra de ouro: qualquer dado que sai da máquina sem consentimento explícito do usuário é CRÍTICO.

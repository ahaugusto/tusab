---
id: seguranca
title: Segurança
sidebar_label: Segurança
slug: /seguranca
---

# Segurança

O Tusab roda localmente na máquina do usuário — um diferencial de privacidade, mas isso não elimina riscos. Três superfícies de ataque existem mesmo num app desktop local: a API FastAPI em `localhost:8001`, entradas do usuário (URLs, uploads, texto colado) e a interface React rodando no Electron.

## O que já era seguro desde o início

- **Electron com boas práticas** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload script explícito
- **Subprocessos seguros** — yt-dlp sempre executado via lista de argumentos, nunca `shell=True` (impede shell injection)
- **Arquivos sensíveis no `.gitignore`** — `credentials.json`, `token.json`, `.env`, `agent_config.json` nunca foram commitados
- **Sanitização de nomes de arquivo** — regex remove caracteres especiais antes de salvar uploads em disco

## Auditoria e correções aplicadas

Duas rodadas de auditoria de código end-to-end (junho de 2026) cobriram subprocess injection, path traversal, validação de entrada, segurança do Electron, armazenamento de segredos, CORS, XSS e dependências. Doze achados identificados e corrigidos:

| # | Correção | Severidade |
|---|----------|------------|
| 1 | CORS restrito a `localhost:8001` (antes: `allow_origins=["*"]`) | Crítico |
| 2 | ID de playlist do yt-dlp validado por regex antes de compor comandos | Crítico |
| 3 | Upload limitado a 50 MB antes de processar | Alto |
| 4 | Delete de arquivo protegido contra path traversal (`os.path.realpath()`) | Alto |
| 5 | `dangerouslySetInnerHTML` eliminado do React | Médio |
| 6 | Chaves de API migradas para keychain do SO via `safeStorage` | Médio |
| 7 | Limites de tamanho em todos os campos Pydantic (`max_length`) | Baixo |
| 8 | Path traversal no servidor de arquivos estáticos corrigido | Alto |
| 9 | Prompt injection mitigado com delimitadores XML no prompt do RAG | Médio |
| 10 | Query injection do Google Drive corrigida com escaping de aspas | Médio |
| 11 | URL do YouTube validada por regex whitelist | Baixo |
| 12 | Histórico do chat movido para o servidor — payload do cliente ignorado | Baixo |

### Exemplo — CORS

**Antes:** `allow_origins=["*"]`, `allow_credentials=True` — qualquer site aberto no navegador do usuário, ou qualquer processo local, podia fazer requisições à API sem restrição.

**Depois:** `allow_origins=["http://localhost:8001", "http://127.0.0.1:8001"]`, `allow_credentials=False` — só o próprio app pode chamar a API.

### Exemplo — prompt injection no pipeline RAG

O prompt monta cada componente com delimitadores XML semânticos:

```
<source id="1">
<title>...</title>
<date>...</date>
<link>...</link>
<content>...</content>
</source>

<conversation_history>...</conversation_history>

<question>...</question>
```

O modelo recebe uma estrutura explícita: conteúdo dentro de `<source>` é tratado como dado de referência, não como instrução. A pergunta é limitada a 2.000 caracteres.

### Exemplo — path traversal no delete

```python
real_path = os.path.realpath(txt_path)
real_subdir = os.path.realpath(subdir)
if not real_path.startswith(real_subdir + os.sep):
    return {"error": True, "message": "Caminho inválido"}
```

`os.path.realpath()` resolve o caminho absoluto real — incluindo qualquer `../` ou symlink — e verifica que ele está de fato dentro da pasta permitida antes de qualquer operação de delete.

## Postura geral

- Sem servidor central para ser atacado ou comprometido
- Dados nunca saem da máquina sem consentimento explícito
- Electron configurado com as melhores práticas de isolamento
- Os 12 fixes fecham as superfícies de ataque realistas para a fase atual de distribuição

**O que ainda falta para uma postura enterprise:** token de autenticação local para a API (modo servidor), dependências com versões fixadas, testes automatizados cobrindo endpoints de segurança críticos.

Para o tratamento de dados pessoais (LGPD/GDPR), veja [Privacidade](/privacidade).

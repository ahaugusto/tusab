# Harnesses sob demanda

Scripts de verificação que chamam **rede real, LLM real ou processo real** —
por isso não fazem parte da suite `pytest` (`tests/`), que é toda
determinística/mockada por design. Rodar manualmente antes de publicar uma
release, ou depois de mexer na área correspondente.

| Script | Quando rodar | O que pega |
|--------|---------------|-----------|
| `verificar_release.py` | Depois de publicar qualquer release no GitHub | `latest.yml` ausente/incorreto — quebra silenciosa do auto-update (bug real da v1.0.40) |
| `verificar_formato_chat.py` | Depois de mexer em `_FMT_INSTR` ou qualquer prompt de chat | Regressão de formatação (negrito/lista) que só aparece numa resposta real do LLM |
| `verificar_mcp_server.py` | Depois de mexer em `mcp_server.py` | Escrita em stderr (corromperia o canal stdio) — invariante que só se rompe em execução real |

## Uso

```powershell
# Auto-update — depois de publicar
.venv\Scripts\python.exe scripts\harness\verificar_release.py v1.0.40 --repo ahaugusto/tusab

# Formatação do chat — backend precisa estar rodando com um canal indexado
.venv\Scripts\python.exe scripts\harness\verificar_formato_chat.py --canal FGV

# MCP server — sobe o processo sozinho, não precisa do backend rodando
.venv\Scripts\python.exe scripts\harness\verificar_mcp_server.py --projeto FGV
```

Todos retornam exit code `0` (sucesso) ou `1` (falha) — dá pra encadear num
checklist de release sem parsear output.

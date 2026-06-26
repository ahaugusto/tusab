# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Servidor MCP (Model Context Protocol) stdio para o Tusab.

Expõe duas tools para editores de código (Claude Code, Cursor, Continue.dev):
  - search_knowledge: busca BM25 na base de conhecimento indexada
  - list_projects:    lista projetos disponíveis em data/indexes/

Execução standalone:
    .venv\\Scripts\\python.exe tusab_engine\\mcp_server.py

Comunicação via stdio JSON-RPC 2.0 (linha por linha).
NÃO importa tusab_engine.state para evitar o LogRedirector.
"""

import sys
import os
import json
import glob as _glob

# ── Path setup ────────────────────────────────────────────────────────────────
# Garante que a raiz do projeto está no sys.path para importar tusab_engine.*
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

# ── Log de diagnóstico (NÃO usa stderr — polui o protocolo stdio) ─────────────
_LOG_PATH = os.path.join(_root, 'data', 'mcp_server.log')


def _log(msg: str):
    """Grava mensagem de diagnóstico em data/mcp_server.log."""
    try:
        os.makedirs(os.path.dirname(_LOG_PATH), exist_ok=True)
        with open(_LOG_PATH, 'a', encoding='utf-8') as f:
            import time as _time
            f.write(f"[{_time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass


# ── Redireciona stderr para o log (evita poluir o protocolo stdio) ────────────
class _StderrToLog:
    def write(self, s):
        if s.strip():
            _log(f"[stderr] {s.rstrip()}")

    def flush(self):
        pass


sys.stderr = _StderrToLog()

# ── Importações lazy do motor (feitas dentro das funções para isolar erros) ───

def _get_index_dir() -> str:
    """Retorna o caminho de data/indexes/ sem importar state."""
    from tusab_engine.storage import INDEX_DIR
    return INDEX_DIR


def _search_knowledge(query: str, project: str = None, top_k: int = 6) -> list:
    """Executa BM25 e retorna chunks relevantes."""
    from tusab_engine.agent.chat import _recuperar_contexto
    from tusab_engine.agent.config import carregar_config

    config = carregar_config()

    # Se project não foi especificado, tenta usar o canal_indexado da config
    canal_nome = project or config.get('canal_indexado', '')
    if not canal_nome:
        # Tenta usar o primeiro projeto disponível
        projetos = _list_projects()
        if not projetos:
            return []
        canal_nome = projetos[0]

    chunks = _recuperar_contexto(
        pergunta=query,
        canal_nome=canal_nome,
        n=top_k,
        config=config,
        canais_extras=None,
        fontes_fixadas=None,
        busca_ampla=False,
        perfil='',
    )

    resultado = []
    for c in chunks:
        resultado.append({
            'titulo': c.get('titulo', ''),
            'texto':  c.get('texto', ''),
            'link':   c.get('link', ''),
            'data':   c.get('data', ''),
            'canal':  c.get('canal', canal_nome),
            'score':  c.get('score', 0.0),
        })
    return resultado


def _list_projects() -> list:
    """Lista projetos disponíveis a partir dos arquivos de índice JSON."""
    try:
        index_dir = _get_index_dir()
        if not os.path.isdir(index_dir):
            return []
        projetos = []
        for path in _glob.glob(os.path.join(index_dir, '*.json')):
            nome = os.path.splitext(os.path.basename(path))[0]
            # Remove sufixo _index se existir (convenção legada)
            if nome.endswith('_index'):
                nome = nome[:-len('_index')]
            if nome:
                projetos.append(nome)
        return sorted(projetos)
    except Exception as e:
        _log(f"Erro em list_projects: {e}")
        return []


# ── Definição das tools MCP ───────────────────────────────────────────────────

_TOOLS = [
    {
        "name": "search_knowledge",
        "description": (
            "Busca na base de conhecimento local do Tusab usando BM25. "
            "Retorna os chunks mais relevantes de transcrições do YouTube, "
            "documentos e textos indexados."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Consulta em linguagem natural para busca na base de conhecimento.",
                },
                "project": {
                    "type": "string",
                    "description": (
                        "Nome do projeto (pasta) onde buscar. "
                        "Se omitido, usa o projeto padrão configurado ou o primeiro disponível."
                    ),
                },
                "top_k": {
                    "type": "integer",
                    "description": "Número máximo de chunks a retornar (padrão: 6).",
                    "default": 6,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_projects",
        "description": (
            "Lista todos os projetos disponíveis na base de conhecimento do Tusab "
            "(aqueles que já foram indexados e possuem arquivo de índice BM25)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
]


# ── Handlers JSON-RPC ─────────────────────────────────────────────────────────

def _handle_initialize(req_id, params):
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "tusab", "version": "1.0.0"},
        },
    }


def _handle_tools_list(req_id, params):
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {"tools": _TOOLS},
    }


def _handle_tools_call(req_id, params):
    name = params.get("name", "")
    args = params.get("arguments", {})

    try:
        if name == "search_knowledge":
            query   = args.get("query", "")
            project = args.get("project") or None
            top_k   = int(args.get("top_k", 6))
            if not query:
                raise ValueError("O parâmetro 'query' é obrigatório.")
            chunks = _search_knowledge(query, project, top_k)
            texto  = json.dumps(chunks, ensure_ascii=False, indent=2)

        elif name == "list_projects":
            projetos = _list_projects()
            texto    = json.dumps(projetos, ensure_ascii=False)

        else:
            raise ValueError(f"Tool desconhecida: '{name}'")

    except Exception as e:
        _log(f"Erro na tool '{name}': {e}")
        texto = f"Erro: {e}"

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {
            "content": [{"type": "text", "text": texto}],
        },
    }


def _error_response(req_id, code: int, message: str):
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": code, "message": message},
    }


# ── Loop principal stdio ──────────────────────────────────────────────────────

def _send(obj):
    """Serializa e envia uma mensagem JSON para o stdout."""
    line = json.dumps(obj, ensure_ascii=False)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def main():
    _log("Servidor MCP Tusab iniciado.")

    # Garante que stdin/stdout operam em modo texto UTF-8 sem buffer
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        try:
            req = json.loads(raw_line)
        except json.JSONDecodeError as e:
            _log(f"JSON inválido recebido: {e} — linha: {raw_line[:120]}")
            _send(_error_response(None, -32700, f"Parse error: {e}"))
            continue

        req_id  = req.get("id")          # None para notificações
        method  = req.get("method", "")
        params  = req.get("params") or {}

        _log(f"Recebido: method={method} id={req_id}")

        # Notificações (sem id) — não requerem resposta
        if req_id is None:
            if method == "notifications/initialized":
                _log("Cliente inicializado (notificação recebida).")
            continue

        # Dispatcher
        try:
            if method == "initialize":
                resp = _handle_initialize(req_id, params)

            elif method == "tools/list":
                resp = _handle_tools_list(req_id, params)

            elif method == "tools/call":
                resp = _handle_tools_call(req_id, params)

            else:
                resp = _error_response(req_id, -32601, f"Método não suportado: '{method}'")

        except Exception as e:
            _log(f"Erro interno ao processar '{method}': {e}")
            resp = _error_response(req_id, -32603, f"Erro interno: {e}")

        _send(resp)

    _log("Servidor MCP Tusab encerrado (EOF no stdin).")


if __name__ == "__main__":
    main()

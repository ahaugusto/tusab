# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Harness sob demanda: sobe o `mcp_server.py` de verdade como subprocesso e
fala JSON-RPC 2.0 com ele via stdio — a única forma de pegar uma violação
do invariante "mcp_server.py nunca importa tusab_engine.state" (que
corromperia o canal stdio silenciosamente, sem lançar exceção nenhuma
visível em teste unitário).

A suite pytest só verifica o schema de GET /agent/mcp/config — nunca
executa o processo real. Este harness executa.

Uso:
    .venv\\Scripts\\python.exe scripts\\harness\\verificar_mcp_server.py
    .venv\\Scripts\\python.exe scripts\\harness\\verificar_mcp_server.py --projeto FGV
"""
import argparse
import json
import pathlib
import subprocess
import sys
import time

TIMEOUT_RESPOSTA = 10  # segundos por request
RAIZ_PROJETO = pathlib.Path(__file__).resolve().parents[2]  # scripts/harness/ → raiz do repo


def _enviar(proc, obj) -> dict:
    linha = json.dumps(obj, ensure_ascii=False) + "\n"
    proc.stdin.write(linha)
    proc.stdin.flush()

    inicio = time.time()
    while time.time() - inicio < TIMEOUT_RESPOSTA:
        raw = proc.stdout.readline()
        if raw.strip():
            return json.loads(raw)
    raise TimeoutError(f"Sem resposta em {TIMEOUT_RESPOSTA}s para {obj.get('method')}")


def verificar(projeto: str | None) -> bool:
    print("Subindo mcp_server.py como subprocesso...")
    proc = subprocess.Popen(
        [sys.executable, str(RAIZ_PROJETO / "tusab_engine" / "mcp_server.py")],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", bufsize=1, cwd=str(RAIZ_PROJETO),
    )
    ok = True
    try:
        # 1. initialize
        resp = _enviar(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        if "result" in resp and resp["result"].get("serverInfo", {}).get("name") == "tusab":
            print("  [PASS] initialize responde com serverInfo.name='tusab'")
        else:
            print(f"  [FAIL] initialize retornou inesperado: {resp}")
            ok = False

        # 2. tools/list
        resp = _enviar(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        nomes = {t["name"] for t in resp.get("result", {}).get("tools", [])}
        esperadas = {"search_knowledge", "list_projects"}
        if esperadas.issubset(nomes):
            print(f"  [PASS] tools/list retorna {sorted(nomes)}")
        else:
            print(f"  [FAIL] tools/list não retornou as tools esperadas: {nomes}")
            ok = False

        # 3. tools/call → list_projects (não depende de projeto existir)
        resp = _enviar(proc, {
            "jsonrpc": "2.0", "id": 3, "method": "tools/call",
            "params": {"name": "list_projects", "arguments": {}},
        })
        texto = resp.get("result", {}).get("content", [{}])[0].get("text", "")
        try:
            projetos = json.loads(texto)
            print(f"  [PASS] list_projects retorna lista válida ({len(projetos)} projeto(s))")
        except (json.JSONDecodeError, TypeError):
            print(f"  [FAIL] list_projects não retornou JSON válido: {texto[:200]!r}")
            ok = False

        # 4. tools/call → search_knowledge (só roda se um projeto foi passado)
        if projeto:
            resp = _enviar(proc, {
                "jsonrpc": "2.0", "id": 4, "method": "tools/call",
                "params": {"name": "search_knowledge", "arguments": {"query": "teste", "project": projeto, "top_k": 3}},
            })
            texto = resp.get("result", {}).get("content", [{}])[0].get("text", "")
            try:
                chunks = json.loads(texto)
                print(f"  [PASS] search_knowledge('{projeto}') retorna lista válida ({len(chunks)} chunk(s))")
            except (json.JSONDecodeError, TypeError):
                print(f"  [FAIL] search_knowledge não retornou JSON válido: {texto[:200]!r}")
                ok = False

    finally:
        proc.stdin.close()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

        stderr_restante = proc.stderr.read()
        if stderr_restante.strip():
            print(f"  [FAIL] processo escreveu em stderr — corromperia o canal stdio: {stderr_restante[:300]!r}")
            ok = False
        else:
            print("  [PASS] stderr do processo permaneceu limpo (invariante do canal stdio preservado)")

    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projeto", default=None, help="Nome de um projeto já indexado, para testar search_knowledge")
    args = parser.parse_args()

    sucesso = verificar(args.projeto)
    print()
    print("RESULTADO: OK" if sucesso else "RESULTADO: FALHOU")
    sys.exit(0 if sucesso else 1)

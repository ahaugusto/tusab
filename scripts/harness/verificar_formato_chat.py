# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Harness sob demanda: valida que o LLM configurado (Ollama por padrão)
realmente devolve markdown formatado (negrito, lista, tabela quando
pertinente) conforme instruído em `_FMT_INSTR` (tusab_engine/agent/chat.py).

A suite pytest inteira usa TestClient + mocks — nunca chama um LLM de
verdade, então uma regressão de prompt (ex: alguém reescreve _FMT_INSTR
e perde a instrução de negrito) nunca seria pega automaticamente. Este
harness faz a chamada real e falha se os marcadores esperados sumirem.

Requer: backend rodando em localhost:8001, com um canal já indexado.

Uso:
    .venv\\Scripts\\python.exe scripts\\harness\\verificar_formato_chat.py --canal FGV
"""
import argparse
import json
import re
import sys
import urllib.request

API_BASE = "http://localhost:8001"

# Cada caso: pergunta que deveria puxar um tipo de formatação + regex que
# precisa aparecer na resposta. Perguntas propositalmente ambíguas o
# suficiente pra funcionar em qualquer canal indexado com conteúdo real.
CASOS = [
    {
        "nome": "negrito_em_lista",
        "pergunta": "Liste os principais pontos discutidos, com os termos-chave em destaque.",
        "regex_esperado": r"\*\*[^*\n]+\*\*",
        "descricao": "resposta deve conter pelo menos um termo em **negrito**",
    },
    {
        "nome": "lista_com_topicos",
        "pergunta": "Quais são os temas abordados? Responda em tópicos.",
        # GFM aceita "-" ou "*" como marcador de lista — ambos renderizam
        # igual no ReactMarkdown (remark-gfm). O prompt pede "-", mas o
        # modelo às vezes usa "*"; isso não é regressão, é variação válida.
        "regex_esperado": r"^\s*[-*]\s+\S",
        "descricao": "resposta deve conter pelo menos uma linha de lista Markdown (\"- \" ou \"* \")",
        "flags": re.MULTILINE,
    },
]


def _chamar_chat(mensagem: str, canal: str) -> str:
    payload = json.dumps({
        "mensagem": mensagem, "canal_nome": canal, "hist": [], "busca_ampla": False,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/agent/chat", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=150) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body.get("resposta", "")


def verificar(canal: str) -> bool:
    print(f"Verificando formatação do chat contra o canal '{canal}'...")
    ok = True
    for caso in CASOS:
        try:
            resposta = _chamar_chat(caso["pergunta"], canal)
        except Exception as e:
            print(f"  [FAIL] {caso['nome']}: erro ao chamar /agent/chat: {e}")
            ok = False
            continue

        flags = caso.get("flags", 0)
        if re.search(caso["regex_esperado"], resposta, flags):
            print(f"  [PASS] {caso['nome']}: {caso['descricao']}")
        else:
            print(f"  [FAIL] {caso['nome']}: {caso['descricao']}")
            print(f"         resposta recebida (primeiros 300 chars): {resposta[:300]!r}")
            ok = False
    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--canal", required=True, help="Nome do canal/projeto já indexado para testar")
    args = parser.parse_args()

    sucesso = verificar(args.canal)
    print()
    print("RESULTADO: OK" if sucesso else "RESULTADO: FALHOU — possível regressão em _FMT_INSTR ou no prompt")
    sys.exit(0 if sucesso else 1)

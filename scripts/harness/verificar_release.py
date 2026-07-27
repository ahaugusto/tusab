# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Harness sob demanda: valida que uma release publicada no GitHub tem tudo
que o electron-updater precisa pra funcionar. Roda ANTES de considerar
uma release completa — não faz parte do pytest (precisa de rede real).

Motivação: v1.0.40 foi publicada sem o `latest.yml` (só .exe + .blockmap
foram anexados via `gh release upload`) e o auto-update falhou com 404
numa máquina real — só descoberto por teste manual do usuário. Ver
`agents/_historia.md`, invariante 23.

Uso:
    .venv\\Scripts\\python.exe scripts\\harness\\verificar_release.py v1.0.40
    .venv\\Scripts\\python.exe scripts\\harness\\verificar_release.py v1.0.40 --repo ahaugusto/tusab
"""
import argparse
import base64
import hashlib
import re
import sys
import urllib.request

REPO_PADRAO = "ahaugusto/tusab-public"
ARQUIVOS_OBRIGATORIOS = {"latest.yml"}  # .exe/.blockmap variam de nome por versão


def _baixar(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as resp:
        if resp.status not in (200,):
            raise RuntimeError(f"HTTP {resp.status} ao baixar {url}")
        return resp.read()


def _parsear_latest_yml(conteudo: str) -> dict:
    """Parser mínimo — evita depender de PyYAML só pra isso."""
    dados = {}
    m_path = re.search(r'^path:\s*(.+)$', conteudo, re.MULTILINE)
    m_sha  = re.search(r'^sha512:\s*(.+)$', conteudo, re.MULTILINE)
    m_size = re.search(r'^\s*size:\s*(\d+)$', conteudo, re.MULTILINE)
    if m_path: dados['path'] = m_path.group(1).strip()
    if m_sha:  dados['sha512'] = m_sha.group(1).strip()
    if m_size: dados['size'] = int(m_size.group(1))
    return dados


def verificar(tag: str, repo: str) -> bool:
    base = f"https://github.com/{repo}/releases/download/{tag}"
    ok = True

    print(f"Verificando release {tag} em {repo}...")

    # 1. latest.yml existe e é parseável
    try:
        conteudo = _baixar(f"{base}/latest.yml").decode('utf-8')
    except Exception as e:
        print(f"  [FAIL] latest.yml não encontrado ou inacessível: {e}")
        print("         electron-updater vai falhar com 404 ao verificar atualização.")
        return False
    print("  [PASS] latest.yml acessível")

    info = _parsear_latest_yml(conteudo)
    if not info.get('path') or not info.get('sha512'):
        print(f"  [FAIL] latest.yml malformado: {info}")
        return False
    print(f"  [PASS] latest.yml aponta para {info['path']}")

    # 2. O .exe referenciado existe e o sha512 bate
    try:
        exe_bytes = _baixar(f"{base}/{info['path']}")
    except Exception as e:
        print(f"  [FAIL] {info['path']} não encontrado: {e}")
        return False
    print(f"  [PASS] {info['path']} acessível ({len(exe_bytes):,} bytes)")

    if info.get('size') and len(exe_bytes) != info['size']:
        print(f"  [FAIL] tamanho não bate: latest.yml diz {info['size']}, arquivo real tem {len(exe_bytes)}")
        ok = False
    else:
        print("  [PASS] tamanho do arquivo bate com latest.yml")

    sha_real = hashlib.sha512(exe_bytes).digest()
    sha_real_b64 = base64.b64encode(sha_real).decode()
    if sha_real_b64 != info['sha512']:
        print(f"  [FAIL] sha512 não bate — arquivo corrompido ou latest.yml desatualizado")
        print(f"         esperado: {info['sha512']}")
        print(f"         real:     {sha_real_b64}")
        ok = False
    else:
        print("  [PASS] sha512 do .exe bate com latest.yml")

    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", help="Tag da release, ex: v1.0.40")
    parser.add_argument("--repo", default=REPO_PADRAO, help=f"Repositório (default: {REPO_PADRAO})")
    args = parser.parse_args()

    sucesso = verificar(args.tag, args.repo)
    print()
    print("RESULTADO: OK — auto-update deve funcionar" if sucesso else "RESULTADO: FALHOU — não publicar/anunciar esta release ainda")
    sys.exit(0 if sucesso else 1)

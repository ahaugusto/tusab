# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Gera THIRD_PARTY_NOTICES.txt (raiz do repositório) para o instalador do Tusab desktop: cada
biblioteca embutida com a licença por inteiro. MIT, BSD e Apache exigem que o aviso acompanhe as
cópias distribuídas, e o build da tela (Vite) apaga os comentários de licença.

Cobre:
  - Python: os pacotes de requirements-lock.txt (o python_env do instalador), lidos do .venv;
  - Tela: a árvore de produção de web_interface/package.json (o que vai em web_interface/dist).
O Electron já leva as próprias licenças (LICENSE.electron.txt e LICENSES.chromium.html).

Rodar depois de mudar dependências e versionar o resultado (o CI só copia o arquivo):
    .venv\\Scripts\\python.exe scripts/gerar_avisos_desktop.py
"""

import json
import re
import sys
from importlib import metadata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LICENCA_ARQ = re.compile(r"^(licen[sc]e|copying|notice)", re.I)

# Texto padrão para pacotes MIT que não trazem o próprio arquivo de licença.
TEXTO_MIT = """MIT License

Copyright (c) {autor}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""


def pacotes_python():
    nomes = []
    for linha in (RAIZ / "requirements-lock.txt").read_text(encoding="utf-8").splitlines():
        linha = linha.split("#")[0].strip()
        if "==" in linha:
            nomes.append(linha.split("==")[0].split("[")[0].strip())
    saida = []
    for nome in sorted(set(nomes), key=str.lower):
        try:
            dist = metadata.distribution(nome)
        except metadata.PackageNotFoundError:
            saida.append((nome, "?", "não instalado no .venv: ver o pacote no PyPI", "", ""))
            continue
        meta = dist.metadata
        licenca = meta.get("License-Expression") or ""
        if not licenca:
            classes = [c.split("::")[-1].strip() for c in meta.get_all("Classifier") or [] if c.startswith("License ::")]
            licenca = "; ".join(classes) or (meta.get("License") or "").splitlines()[0:1] and (meta.get("License") or "").splitlines()[0] or "ver o projeto"
        url = meta.get("Home-page") or next((u.split(",", 1)[-1].strip() for u in meta.get_all("Project-URL") or []), "")
        textos = []
        for arq in dist.files or []:
            if LICENCA_ARQ.match(Path(str(arq)).name):
                try:
                    textos.append(Path(dist.locate_file(arq)).read_text(encoding="utf-8", errors="replace").strip())
                except OSError:
                    pass
        texto = "\n\n".join(dict.fromkeys(textos)) or (meta.get("License") or "").strip() or f"Licença declarada: {licenca}."
        saida.append((meta["Name"], meta["Version"], licenca, url, texto))
    return saida


def pacotes_tela():
    raiz = RAIZ / "web_interface"
    vistos = {}

    def achar(nome, de: Path):
        d = de
        while True:
            p = d / "node_modules" / nome
            if (p / "package.json").exists():
                return p
            if d.parent == d:
                return None
            d = d.parent

    def visitar(nome, de):
        pasta = achar(nome, de)
        if pasta is None or pasta in vistos:
            return
        pkg = json.loads((pasta / "package.json").read_text(encoding="utf-8"))
        vistos[pasta] = pkg
        for dep in {**pkg.get("dependencies", {}), **pkg.get("optionalDependencies", {})}:
            visitar(dep, pasta)

    for dep in json.loads((raiz / "package.json").read_text(encoding="utf-8")).get("dependencies", {}):
        visitar(dep, raiz)

    saida = []
    for pasta, pkg in sorted(vistos.items(), key=lambda x: x[1]["name"].lower()):
        lic = pkg.get("license") if isinstance(pkg.get("license"), str) else (pkg.get("license") or {}).get("type", "ver o repositório")
        repo = pkg.get("repository")
        repo = repo if isinstance(repo, str) else (repo or {}).get("url", "") or pkg.get("homepage", "")
        textos = [f.read_text(encoding="utf-8", errors="replace").strip()
                  for f in sorted(pasta.iterdir()) if f.is_file() and LICENCA_ARQ.match(f.name)]
        autor = pkg.get("author") if isinstance(pkg.get("author"), str) else (pkg.get("author") or {}).get("name", "")
        if textos:
            texto = "\n\n".join(textos)
        elif str(lic).startswith("MIT"):
            texto = TEXTO_MIT.format(autor=autor or "the authors")
        else:
            texto = f"Licença declarada: {lic}. O pacote não traz arquivo de licença; ver {repo or 'o registro npm'}."
        saida.append((pkg["name"], pkg.get("version", "?"), lic, repo.replace("git+", ""), texto))
    return saida


def main():
    linhas = [
        "AVISOS DE TERCEIROS — Tusab desktop",
        "",
        "O Tusab é distribuído sob a Elastic License 2.0 (ver LICENSE). Ele usa as bibliotecas abaixo, sem",
        "modificação, nos termos das licenças de cada uma, reproduzidas aqui por inteiro. Também usa o yt-dlp",
        "(Unlicense) e o Electron, que levam as próprias licenças. Resumo das principais: THIRD_PARTY_NOTICES.md.",
        "",
    ]
    resumo = []
    for titulo, lista in (("Motor (Python)", pacotes_python()), ("Tela (JavaScript)", pacotes_tela())):
        linhas += ["=" * 78, f"{titulo}: {len(lista)} pacotes", "=" * 78, ""]
        for nome, versao, lic, url, texto in lista:
            linhas += ["-" * 78, f"{nome}@{versao} — {lic}"] + ([url] if url else []) + ["-" * 78, texto, ""]
        resumo.append(f"{titulo}: {len(lista)}")
    (RAIZ / "THIRD_PARTY_NOTICES.txt").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print("THIRD_PARTY_NOTICES.txt pronto (" + " · ".join(resumo) + ").")


if __name__ == "__main__":
    sys.exit(main())

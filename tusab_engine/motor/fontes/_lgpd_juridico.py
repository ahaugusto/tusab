# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Salvaguardas de privacidade compartilhadas pelas fontes de jurisprudência
(stf.py, tcu.py, tst.py) — Lei 13.709/2018 (LGPD).

Princípio de minimização (LGPD, art. 6º, III): o corpus local do Tusab só
precisa do conteúdo jurídico (ementa, decisão, relatório, voto, inteiro
teor, indexação). Dados pessoais de partes, advogados e signatários não
agregam nada à recuperação por tema e não devem ser gravados em disco.

Defesa em camadas:
1. Cada adaptador escolhe explicitamente quais campos da API viram texto
   (lista branca) — campos como `partes_lista_texto` (STF), `INTERESSADOS`/
   `ADVOGADO` (TCU) e `codCPFSignatario` (TST) nunca são gravados.
2. Blocos de qualificação das partes dentro do inteiro teor são removidos:
   o cabeçalho em colunas do STF (que se REPETE no início de cada seção —
   relatório, voto, votos dos demais ministros — confirmado ao vivo), as
   linhas "RECTE.(S): ..." do extrato de ata e o "em que é Recorrente
   FULANO e Recorrido EMPRESA" do TST.
3. Os nomes de pessoa colhidos nesses blocos (e, no TCU, dos campos de
   responsáveis/advogados, lidos só em memória) viram um dicionário de
   redação: toda ocorrência no texto corrido — "Responsável 1: Fulano de
   Tal", "o depoimento de Fulano" — é trocada por "[nome omitido — LGPD]".
   Também a forma curta "Prenome Sobrenome" de nomes com 3+ palavras.
4. CPF (inclusive o formato parcialmente mascarado do TCU, "XXX.956.260-XX")
   e números de inscrição na OAB são mascarados por regex.

Pessoas jurídicas e entes públicos (União, Estado, partido, associação,
empresa LTDA/S.A.) não são dado pessoal e ficam no texto — removê-los
tornaria a decisão ilegível. Risco residual documentado: pessoa citada só
no texto corrido, sem aparecer em bloco de qualificação nem em campo de
partes (ex.: testemunha), não é detectável sem NER.
"""

import re
import unicodedata

# Teto por documento salvo — relatórios do TCU passam de 280 mil caracteres.
LIMITE_CHARS_DOCUMENTO = 200_000

_AVISO_PARTES = "[qualificação das partes omitida — LGPD]"
_AVISO_NOME = "[nome omitido — LGPD]"

# CPF completo (123.456.789-01, separadores opcionais) e o formato
# parcialmente mascarado publicado pelo TCU (XXX.956.260-XX).
_RE_CPF = re.compile(r'(?<![\w.])[X\d]{3}\.?[X\d]{3}\.?[X\d]{3}-[X\d]{2}(?![\w])')
# Inscrição OAB: "26.348/OAB-CE", "OAB/DF 12.345", "OAB-DF 22885", "(63906/GO)" em extrato de ata.
_RE_OAB = re.compile(
    r'\d{1,3}(?:\.\d{3})*\s*/\s*OAB\s*-?\s*[A-Z]{2}'
    r'|OAB\s*[-/]\s*[A-Z]{2}\s*(?:n[ºo°]\s*)?\d{1,3}(?:\.?\d{3})*(?:-?[A-Z])?'
    r'|\(\d{3,7}[A-Z]?/[A-Z]{2}\)'
)

# Rótulo de parte do STF: "RECTE.(S)", "ADV.(A/S)", "PROC.(A/S)(ES)", "AM. CURIAE.".
_ROTULO_PARTE = r'[A-ZÀ-Ü][A-ZÀ-Ü. ]{1,30}\.?\s*\((?:S|A/S|ES|AS|A)\)(?:\s*\([A-Z/]+\))*'
_RE_LINHA_ROTULO = re.compile(
    r'^\s*(?:RELATORA?(?:\(A\))?|REDATORA?(?:\(A\))?\s+DO\s+AC[ÓO]RD[ÃA]O|REVISORA?(?:\(A\))?'
    r'|' + _ROTULO_PARTE + r'|AM\.\s*CURIAE\.?)\s*$'
)
# Extrato de ata: rótulo e valor na mesma linha — "AGTE.(S): M.X.Q.S.".
_RE_ROTULO_COM_VALOR = re.compile(r'^[ \t]*(' + _ROTULO_PARTE + r')[ \t]*:(.*)$', re.MULTILINE)

# Início de seção no inteiro teor do STF (comparado sem espaços: "RE LAT Ó RI O").
_SECOES_STF = (
    "RELATÓRIO", "RELATORIO", "VOTO", "EMENTA", "ACÓRDÃO", "ACORDAO", "EXTRATODEATA",
    "DEBATE", "ANTECIPAÇÃO", "ESCLARECIMENTO", "OBSERVAÇÃO", "CONFIRMAÇÃO", "ADITAMENTO",
    "DECISÃO", "DECISAO", "APARTE", "EXPLICAÇÃO", "QUESTÃODEORDEM", "PROPOSTA",
    "RETIFICAÇÃO", "MANIFESTAÇÃO", "INTEIROTEOR", "SUPREMOTRIBUNALFEDERAL",
)

# TST (e padrão comum a outros tribunais), em duas formas vistas ao vivo:
#   "..., em que é Recorrente\nFULANO\ne Recorrido\nEMPRESA S.A.\n."
#   "..., em que é AGRAVANTE FULANO e são AGRAVADOS EMPRESA LTDA e OUTRA LTDA ."
# O bloco termina numa linha só com ".", num " ." (espaço antes do ponto, usado
# pelo modelo do TST depois do último nome) ou num fim de frase seguido de
# linha em caixa normal ("Contra o r. despacho", "A reclamante interpôs") —
# os nomes das partes vêm sempre em caixa alta. Rótulos em qualquer caixa.
_ROTULOS_TST = (r'Recorrentes?|Agravantes?|Embargantes?|Reclamantes?|Autora?|Autores|Impetrantes?|Requerentes?'
                r'|Suscitantes?|Exequentes?|Recorrid[oa]s?|Agravad[oa]s?|Embargad[oa]s?|Reclamad[oa]s?|R[ée]us?'
                r'|Requerid[oa]s?|Suscitad[oa]s?|Executad[oa]s?|Impetrad[oa]s?|Interessad[oa]s?')
_RE_QUALIFICACAO_EM_QUE = re.compile(
    r'(em\s+que\s+(?:é|são|figuram?\s+como)\s+(?i:' + _ROTULOS_TST + r'))'
    r'(.{0,1500}?)'
    r'(\n[ \t]*\.[ \t]*(?=\n|$)|[ \t]\.[ \t]*(?=\n|$)|\.[ \t]*\n(?=[ \t]*[A-ZÀ-Ü](?:[a-zà-ü]|[ \t]+[a-zà-ü])))',
    re.DOTALL,
)
_RE_SEPARA_PARTES_TST = re.compile(
    r'(?i)(?:\b(?:e\s+)?(?:é|são)\s+(?:' + _ROTULOS_TST + r')\b)|\s+e\s+|\n|,|(?:^|\s)(?:' + _ROTULOS_TST + r')(?=\s|$)'
)

# Termos que indicam pessoa jurídica / ente público (não é dado pessoal).
_INSTITUCIONAL = (
    "UNIÃO", "UNIAO", "ESTADO", "MUNICÍPIO", "MUNICIPIO", "DISTRITO FEDERAL", "MINISTÉRIO", "MINISTERIO",
    "PROCURADOR", "PROCURADORIA", "ADVOCACIA", "ADVOGADO-GERAL", "DEFENSOR", "DEFENSORIA", "ASSEMBLEIA",
    "PARTIDO", "ASSOCIAÇÃO", "ASSOCIACAO", "SINDICATO", "CONFEDERAÇÃO", "FEDERAÇÃO", "LTDA", "S.A", "S/A",
    "EIRELI", " ME ", "BANCO", "EMPRESA", "COMPANHIA", " CIA", "INSTITUTO", "CONSELHO", "TRIBUNAL", "MESA ",
    "PRESIDENTE", "GOVERNADOR", "PREFEITO", "SUPERIOR", "FUNDAÇÃO", "FUNDACAO", "FUNDO", "AGÊNCIA", "AGENCIA",
    "CÂMARA", "CAMARA", "SENADO", "CONGRESSO", "COOPERATIVA", "ORDEM DOS", "SECRETARIA", "SECRETÁRIO",
    "UNIVERSIDADE", "SERVIÇO", "SERVICO", "AUTARQUIA", "CAIXA", "PETROBRAS", "INSS", "COMISSÃO", "COMITÊ",
    "MINISTRO", "MIN.", "JUIZ", "JUÍZO", "VARA ", "COMARCA", "GRUPO", "HOLDING", "TECNOLOGIA", "COMÉRCIO",
    "INDÚSTRIA", "SOCIEDADE", "ENTIDADE", "CENTRAL", "NACIONAL", "BRASIL", "OUTRO(A/S)",
)
_CONECTIVOS = {"da", "de", "do", "das", "dos", "e", "di", "del", "van", "von"}


def _limpar_nome(nome: str) -> str:
    nome = re.sub(r'\(.*?\)', ' ', nome or "")
    nome = re.sub(r'(?i)\s+e\s+outr[oa]s?\b.*$', '', nome)
    return re.sub(r'\s+', ' ', nome).strip(" .,;:-–—\t")


def _parece_pessoa(nome: str) -> bool:
    """Nome próprio de pessoa física provável: 2-8 palavras capitalizadas, sem
    termo institucional e sem iniciais anonimizadas (M.X.Q.S.)."""
    tokens = nome.split()
    if not 2 <= len(tokens) <= 8:
        return False
    maiusculo = f" {nome.upper()} "
    if any(t in maiusculo for t in _INSTITUCIONAL):
        return False
    for t in tokens:
        if t.lower() in _CONECTIVOS:
            continue
        if not re.match(r"^[A-ZÀ-Ü][A-Za-zÀ-ü'\-]+$", t):
            return False
    return True


def _nomes_de(valores) -> set:
    nomes = set()
    for v in valores:
        nome = _limpar_nome(v)
        if _parece_pessoa(nome):
            nomes.add(nome)
    return nomes


def extrair_nomes_de_campo(texto: str) -> set:
    """Nomes de pessoa de um campo de partes/responsáveis/advogados (ex.: TCU
    INTERESSADOS = "3. Responsáveis: Fulano de Tal (XXX.956.260-XX); Beltrano
    Souza (XXX...)"). Usado só em memória, como dicionário de redação."""
    if not texto:
        return set()
    texto = re.sub(r'<[^>]+>', '\n', texto)
    texto = re.sub(r'\(.*?\)', ' ', texto)
    pedacos = re.split(r'[;,\n]|\s\d+(?:\.\d+)*\.\s|\s+e\s+', texto)
    return _nomes_de(p.rsplit(":", 1)[-1] for p in pedacos)


def _secao(linha: str) -> bool:
    compacto = re.sub(r'\s+', '', linha).upper()
    return any(compacto.startswith(s) for s in _SECOES_STF)


def _remover_cabecalhos_stf(texto: str, nomes: set) -> str:
    """Remove TODOS os blocos de cabeçalho em colunas (rótulos seguidos de
    linhas ': VALOR' e continuações em caixa alta), colhendo os valores."""
    linhas = texto.split("\n")
    saida, i = [], 0
    while i < len(linhas):
        if not _RE_LINHA_ROTULO.match(linhas[i]):
            saida.append(linhas[i])
            i += 1
            continue
        j, valores, ultimo_valor = i, [], False
        while j < len(linhas):
            linha = linhas[j]
            if not linha.strip() or _RE_LINHA_ROTULO.match(linha):
                pass
            elif linha.lstrip().startswith(":"):
                valores.append(linha.lstrip()[1:].strip())
                ultimo_valor = True
            elif ultimo_valor and not re.search(r'[a-zà-ü]', linha) and not _secao(linha):
                valores[-1] += " " + linha.strip()
            else:
                break
            j += 1
        if valores:
            nomes.update(_nomes_de(valores))
            saida.append(_AVISO_PARTES)
            i = j
        else:  # rótulo solto sem valores — não é cabeçalho, mantém
            saida.append(linhas[i])
            i += 1
    return "\n".join(saida)


def _redigir_rotulos_com_valor(texto: str, nomes: set) -> str:
    def troca(m):
        nomes.update(_nomes_de([m.group(2)]))
        return _AVISO_PARTES
    return _RE_ROTULO_COM_VALOR.sub(troca, texto)


def _redigir_qualificacao_em_que(texto: str, nomes: set) -> str:
    def troca(m):
        pedacos = [p for p in _RE_SEPARA_PARTES_TST.split(m.group(2)) if p and p.strip()]
        nomes.update(_nomes_de(p.strip().title() if p.isupper() else p for p in pedacos))
        return f"em que {_AVISO_PARTES}.\n"
    return _RE_QUALIFICACAO_EM_QUE.sub(troca, texto)


def _variantes(nome: str) -> set:
    tokens = nome.split()
    variantes = {nome}
    if len(tokens) >= 3:
        variantes.add(f"{tokens[0]} {tokens[-1]}")
    return variantes


_VARIANTES_LETRA = {
    "a": "[aáàâãä]", "e": "[eéèêë]", "i": "[iíìîï]", "o": "[oóòôõö]", "u": "[uúùûü]", "c": "[cç]",
}


def _padrao_nome(nome: str) -> str:
    """Regex tolerante a acento e hífen — o campo da API traz "Geraldo Antonio"
    e "Aben-Athar", o texto do acórdão traz "Geraldo Antônio" e "Aben Athar"
    (visto ao vivo no TCU)."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", nome) if not unicodedata.combining(c)).lower()
    tokens = [t for t in re.split(r'[\s\-]+', sem_acento) if t]
    partes = ["".join(_VARIANTES_LETRA.get(c, re.escape(c)) for c in t) for t in tokens]
    return r'(?<![\wÀ-ü])' + r'[\s\-]+'.join(partes) + r'(?![\wÀ-ü])'


def redigir_nomes(texto: str, nomes) -> str:
    """Troca cada ocorrência (sem diferenciar caixa, acento ou hífen) dos nomes pelo aviso."""
    alvos = set()
    for nome in nomes:
        alvos |= _variantes(nome)
    for alvo in sorted(alvos, key=len, reverse=True):  # nome completo antes da forma curta
        texto = re.sub(_padrao_nome(alvo), _AVISO_NOME, texto, flags=re.IGNORECASE)
    return texto


def sanitizar_texto_juridico(texto: str, nomes_extras=()) -> str:
    """Aplica as salvaguardas de LGPD sobre texto já convertido de HTML.
    `nomes_extras`: nomes de pessoas vindos de campos de partes da própria
    API (lidos só em memória) para redigir também no texto corrido."""
    if not texto:
        return ""
    nomes = set(_nomes_de(nomes_extras))
    texto = _remover_cabecalhos_stf(texto, nomes)
    texto = _redigir_rotulos_com_valor(texto, nomes)
    texto = _redigir_qualificacao_em_que(texto, nomes)
    texto = redigir_nomes(texto, nomes)
    texto = _RE_CPF.sub("[CPF omitido]", texto)
    texto = _RE_OAB.sub("[OAB omitida]", texto)
    return re.sub(r'\n{3,}', "\n\n", texto).strip()


def limitar_texto(texto: str, limite: int = LIMITE_CHARS_DOCUMENTO) -> str:
    """Corta no limite por documento, sinalizando o corte no próprio texto."""
    if len(texto) <= limite:
        return texto
    return texto[:limite].rstrip() + "\n\n[texto truncado no limite de 200.000 caracteres do Tusab]"

# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Utilitários de comparação de termo de busca com texto, para fontes cujo
servidor ordena por data (Agência Brasil) ou aplica stemming agressivo
demais (STF: "saneamento" e "saneador" viram o mesmo radical no
Elasticsearch, trazendo acórdãos sobre despacho saneador numa busca por
saneamento básico). Comparação sem acento e sem caixa.
"""

import re
import unicodedata

_RE_PALAVRA = re.compile(r'\w+', re.UNICODE)


def normalizar(texto: str) -> str:
    """Minúsculas e sem acentos — 'Tributária' -> 'tributaria'."""
    sem_acento = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in sem_acento if not unicodedata.combining(c)).lower()


def palavras_significativas(query: str, minimo: int = 4) -> list:
    """Palavras do termo com pelo menos `minimo` letras (descarta 'de', 'em', 'IA'...)."""
    return [p for p in _RE_PALAVRA.findall(normalizar(query)) if len(p) >= minimo]


def radical(palavra: str) -> str:
    """Radical aproximado para tolerar plural/flexão sem casar palavras de outra
    família: 'licitacao' -> 'licita' (casa 'licitacoes'), 'saneamento' ->
    'saneame' (não casa 'saneador')."""
    return palavra[:max(4, len(palavra) - 3)]


def contem_alguma(texto_normalizado: str, palavras: list) -> bool:
    return any(radical(p) in texto_normalizado for p in palavras)


def contem_todas(texto_normalizado: str, palavras: list) -> bool:
    return all(radical(p) in texto_normalizado for p in palavras)

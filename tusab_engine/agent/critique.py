# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Camada de crítica — Fase 5 da formalização do roteamento de intenção
("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Consolida o que antes estava disperso em chat.py: verificação de alucinação
(cobertura de vocabulário da resposta contra o corpus), confiança graduada
por sentença, detecção de lacuna numérica, e os limiares de gap de relevância
usados no filtro pós-CrossEncoder/BM25 de _recuperar_contexto().

[INVARIANTE] `isrel` em Critica é um sinal de FLUXO (decidir se tenta busca
ampla antes de desistir), nunca um FILTRO de chunk. "Score mínimo BM25 fixo
ou adaptativo" já foi tentado e descartado (v1.0.11–v1.0.26, ver
agents/_historia.md) — cortava resultados legítimos em corpus grande.
A rede de segurança pra qual chunk ENTRA no contexto continua sendo
score > 0 + FTS5, sem exceção. Não usar isrel pra filtrar candidatos.
"""

import re
from dataclasses import dataclass, field

from tusab_engine.agent.index import _STOPWORDS


@dataclass
class Critica:
    isrel: float          # 1.0 se _recuperar_contexto trouxe algo, 0.0 se vazio
    issup: float           # cobertura de vocabulário da resposta no corpus [0..1]; None se não avaliado
    por_sentenca: list = field(default_factory=list)  # confiança graduada (ver avaliar_confianca_por_sentenca)
    acao: str = 'ok'       # 'ok' | 'retry_busca_ampla' | 'sem_contexto'


# ── Limiares do filtro de lacuna de relevância (usado por _recuperar_contexto) ─
# CE (CrossEncoder, ms-marco-MiniLM-L-6-v2): score é um logit não-calibrado,
# tipicamente entre -11 e +11 — uma lacuna de 4.0 pro melhor candidato já
# indica "sem relação real", não apenas "um pouco menos relevante".
GAP_RELEVANCIA_CE = 4.0
# BM25 puro: escala varia por corpus (IDF), então usa proporção do melhor
# score, não valor absoluto — um candidato com menos de 20% do score do
# 1º colocado é, na prática, apenas overlap incidental de termos comuns.
RATIO_RELEVANCIA_BM25 = 0.2


def avaliar_relevancia_contexto(contexto: list, *, busca_ampla_ja_tentada: bool) -> Critica:
    """isrel binário: _recuperar_contexto trouxe algo (1.0) ou nada (0.0).

    Decide a ação (Critica.acao) que viabiliza o retry automático descrito no
    spec: contexto vazio E busca ampla ainda não tentada → 'retry_busca_ampla'
    (o chamador deve re-rodar _recuperar_contexto com busca_ampla=True antes
    de desistir); contexto vazio e busca ampla já tentada (ou já era a
    configuração do usuário) → 'sem_contexto'; contexto não vazio → 'ok'.

    Não lê disco, não chama LLM — puro, igual ao contrato de rotear().
    """
    isrel = 1.0 if contexto else 0.0
    if contexto:
        acao = 'ok'
    elif not busca_ampla_ja_tentada:
        acao = 'retry_busca_ampla'
    else:
        acao = 'sem_contexto'
    return Critica(isrel=isrel, issup=None, acao=acao)


# ── Fidelidade numérica ────────────────────────────────────────────────────────
#
# Modelos locais pequenos (ex: llama3.2:1b) podem preservar a estrutura de uma
# frase ao parafrasear um chunk denso em números mas apagar os números em si —
# "Decreto-Lei nº 1.001, de 21 de outubro de 1969" vira "Decreto-Lei nº., de
# de outubro de" na resposta (confirmado ao vivo, 29/jul/2026, ver
# agents/_historia.md). Não é alucinação (não inventa número errado) nem é
# pego por verificar_alucinacao/confianca_por_sentenca (nenhum dos dois lê o
# texto pra achar lacuna estrutural, só cobertura de vocabulário).
# "de de" e "nº." seguido de pontuação são a assinatura textual de um número
# apagado nesse padrão de frase em português — cobrem o caso real observado,
# não uma tentativa de cobrir todo tipo de omissão numérica possível.
_RE_LACUNA_NUMERICA = re.compile(r'\bde\s+de\b|n[ºo°]\.?\s*[,;.]', re.IGNORECASE)


def tem_lacuna_numerica(resposta: str) -> bool:
    return bool(_RE_LACUNA_NUMERICA.search(resposta))


# ── Verificação de alucinação (ISSUP) ─────────────────────────────────────────

def verificar_alucinacao(resposta: str, contexto: list, projeto_nome: str, trecho_injetado: bool = False):
    """Retorna (resposta_final, issup: float|None).

    issup é a cobertura de vocabulário da resposta contra o corpus recuperado
    — 1.0 = toda palavra de conteúdo da resposta aparece no corpus, 0.0 =
    nenhuma. Quando cobertura < 0.12, a resposta é substituída por uma
    mensagem de "não encontrei" (comportamento herdado, preservado aqui).

    Quando há trecho injetado, não filtramos: o usuário enviou conteúdo
    próprio da base e o LLM sempre vai usar vocabulário analítico diferente
    do corpus original — issup retorna None (não avaliado, não é alucinação).
    """
    if trecho_injetado:
        return resposta, None

    FRASES_NAO_ENCONTRADO = [
        'não encontrei', 'nao encontrei', 'not found',
        'não há informação', 'nao ha informacao',
        'não consta', 'nao consta',
    ]
    resposta_lower = resposta.lower()

    if any(f in resposta_lower for f in FRASES_NAO_ENCONTRADO):
        return resposta, None

    palavras_resposta = set(re.findall(r'\b[a-záéíóúàâêôãõç]{5,}\b', resposta_lower))
    palavras_resposta -= _STOPWORDS

    if not palavras_resposta:
        return resposta, None

    corpus_chunks = ' '.join(c['texto'].lower() for c in contexto)
    encontradas   = sum(1 for p in palavras_resposta if p in corpus_chunks)
    cobertura     = encontradas / len(palavras_resposta)

    # 0.12 em vez de 0.20 — LLMs legítimos usam sinônimos e paráfrases;
    # threshold muito alto descartaria respostas corretas que só parafraseiam.
    if cobertura < 0.12:
        handle = f'@{projeto_nome}' if projeto_nome else 'este canal'
        return (
            f'Não encontrei informações suficientes sobre esse tema no conteúdo de {handle}. '
            f'Tente reformular a pergunta ou verifique se o canal aborda esse assunto.'
        ), round(cobertura, 3)

    return resposta, round(cobertura, 3)


def avaliar_confianca_por_sentenca(resposta: str, contexto: list) -> list:
    """Mede a confiança de cada sentença da resposta contra o corpus recuperado.

    Complementa verificar_alucinacao() (que é binária: passa inteira ou é
    trocada por "não encontrei") com um sinal graduado por trecho — permite
    ao frontend destacar visualmente afirmações com baixo apoio no corpus,
    sem suprimir a resposta inteira. Mesma técnica de cobertura de vocabulário
    de verificar_alucinacao(), aplicada por sentença em vez de na resposta toda.

    Aceita tanto chunks de retrieval (campo 'texto'/'texto_original') quanto
    fontes já formatadas para o frontend (campo 'trecho', truncado a 600
    chars) — usado tanto pelo chat() quanto pelo endpoint de streaming.

    Retorna [{"texto", "confianca", "inicio", "fim"}, ...] — offsets de
    caractere na resposta original, para o frontend fazer highlight sem
    reprocessar a string. Lista vazia se não houver contexto ou resposta.
    """
    if not resposta or not contexto:
        return []

    sentencas = re.split(r'(?<=[.!?])\s+', resposta)
    corpus_texto = ' '.join(
        (c.get('texto') or c.get('texto_original') or c.get('trecho') or '').lower()
        for c in contexto
    )

    resultado = []
    cursor = 0
    for sent in sentencas:
        if not sent.strip():
            continue
        try:
            inicio = resposta.index(sent, cursor)
        except ValueError:
            continue  # sentença não encontrada no texto original — pula (não deveria ocorrer)
        fim = inicio + len(sent)
        cursor = fim

        palavras = set(re.findall(r'\b[a-záéíóúàâêôãõç]{5,}\b', sent.lower())) - _STOPWORDS
        if not palavras:
            confianca = 1.0  # sentença sem conteúdo verificável (conectivo, transição)
        else:
            encontradas = sum(1 for p in palavras if p in corpus_texto)
            confianca = round(encontradas / len(palavras), 3)

        resultado.append({"texto": sent, "confianca": confianca, "inicio": inicio, "fim": fim})

    return resultado

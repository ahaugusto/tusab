# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rota METADADOS — Fase 2 da formalização do roteamento de intenção
("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Responde perguntas sobre a PRÓPRIA base (quantos vídeos, qual o mais recente,
quando foi indexado, qual o tamanho) lendo diretamente os arquivos que já
guardam essa informação — nunca adivinhando via BM25/LLM.

Invariante do spec: "o número na resposta vem sempre do arquivo. Se o
executor não conseguir determinar o valor, ele degrada para BUSCA — nunca
chuta." Por isso responder_metadados() só retorna string quando tem certeza;
qualquer ambiguidade retorna None e o chamador segue o fluxo normal (BM25).

Deliberadamente sem chamada de LLM nesta primeira versão — o spec permite
usar LLM "só para redigir a frase", mas o template determinístico já entrega
a mesma garantia (zero risco de o LLM alterar o número) com menos superfície
de falha. Revisitar se o feedback 👎 mostrar que a resposta engessada incomoda.
"""

import os
import re
import time

from tusab_engine.storage import NEURAL_DIR, resumir_projetos_youtube
from tusab_engine.agent.index import _index_path, _carregar_meta_canal
from tusab_engine.agent.calibration import _carregar_profile


# ── Matchers determinísticos (pt/en/es) ───────────────────────────────────────
# Conservador por design (mesmo princípio da Fase 1): cobre as 3 perguntas
# citadas no spec como exemplo. Fora desse escopo, retorna None e a pergunta
# segue pro classificador LLM normal — nunca força METADADOS por engano.

_RE_CONTAGEM = re.compile(
    r'\b(quant[oa]s?\s+v[ií]deos|tamanho\s+da\s+base|qual\s+o\s+tamanho'
    r'|how\s+many\s+videos|size\s+of\s+the\s+base|how\s+big\s+is\s+the\s+base'
    r'|cu[aá]nt[oa]s?\s+v[ií]deos|tama[ñn]o\s+de\s+la\s+base)\b',
    re.IGNORECASE,
)

_RE_RECENCIA = re.compile(
    r'\b(v[ií]deo\s+mais\s+recente|mais\s+recente|[uú]ltimo\s+v[ií]deo'
    r'|most\s+recent\s+video|latest\s+video|newest\s+video'
    r'|v[ií]deo\s+m[aá]s\s+reciente|[uú]ltimo\s+video)\b',
    re.IGNORECASE,
)

_RE_INDEXACAO = re.compile(
    # "quando [essa base/o projeto/...] foi indexad[oa]" — \S{0,25} tolera um
    # sujeito curto no meio ("essa base", "o projeto") sem virar genérico
    # demais a ponto de casar frases sem relação nenhuma com indexação.
    r'\b(quando\s+(eu\s+)?indexei|quando\b.{0,25}\bfoi\s+indexad[oa]|base\s+desatualizada'
    r'|when\s+(did\s+i\s+)?index|when\b.{0,25}\bindexed'
    r'|cu[aá]ndo\s+index[eé]|cu[aá]ndo\b.{0,25}\bindex[oó])\b',
    re.IGNORECASE,
)


def _classificar_pergunta_metadados(pergunta: str) -> str:
    """Retorna 'CONTAGEM' | 'RECENCIA' | 'INDEXACAO' | None."""
    if _RE_RECENCIA.search(pergunta):
        return 'RECENCIA'
    if _RE_INDEXACAO.search(pergunta):
        return 'INDEXACAO'
    if _RE_CONTAGEM.search(pergunta):
        return 'CONTAGEM'
    return None


def _contar_docs_manifest(manifest_path: str) -> int:
    """Conta itens de um _manifest.json. Nunca lança — manifest ausente ou
    corrompido conta como 0, igual ao resto do projeto trata esse arquivo."""
    if not os.path.exists(manifest_path):
        return 0
    try:
        import json
        with open(manifest_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return len(data) if isinstance(data, list) else 0
    except Exception:
        return 0


def _resumo_do_projeto(projeto_prefixo: str) -> dict:
    """Agrega resumir_projetos_youtube() para um único projeto — um projeto
    pode ter mais de uma entrada de canal (multi-fonte), soma tudo."""
    entradas = [r for r in resumir_projetos_youtube() if r.get('projeto') == projeto_prefixo]
    if not entradas:
        return {}
    total_extraidos = sum(e.get('extraidos', 0) for e in entradas)
    total_mapeado    = sum(e.get('total_mapeado', 0) for e in entradas)
    ultimas = [e.get('ultima_extracao', '') for e in entradas if e.get('ultima_extracao')]
    return {
        'extraidos':      total_extraidos,
        'total_mapeado':  total_mapeado,
        'ultima_extracao': max(ultimas) if ultimas else '',
    }


def responder_metadados(pergunta: str, projeto_nome: str, projeto_prefixo: str, idioma: str = 'pt') -> str:
    """Retorna a resposta pronta (string) se a pergunta é de metadado E o
    executor consegue determinar o valor com certeza a partir dos arquivos
    reais. Retorna None em qualquer outro caso — o chamador degrada para
    BUSCA, nunca mostra 'não sei' quando o dado existe em disco nem inventa
    quando não existe.
    """
    try:
        categoria = _classificar_pergunta_metadados(pergunta)
        if not categoria:
            return None

        resumo = _resumo_do_projeto(projeto_prefixo)

        if categoria == 'CONTAGEM':
            if not resumo:
                return None
            doc_dir  = os.path.join(NEURAL_DIR, projeto_prefixo, 'documents', '_manifest.json')
            txt_dir  = os.path.join(NEURAL_DIR, projeto_prefixo, 'texts', '_manifest.json')
            n_docs   = _contar_docs_manifest(doc_dir) + _contar_docs_manifest(txt_dir)
            n_videos = resumo['extraidos']
            return _template('contagem', idioma, projeto=projeto_nome, videos=n_videos, docs=n_docs)

        if categoria == 'RECENCIA':
            if not resumo or not resumo.get('ultima_extracao'):
                return None
            return _template('recencia', idioma, projeto=projeto_nome, data=resumo['ultima_extracao'])

        if categoria == 'INDEXACAO':
            idx_path = _index_path(projeto_prefixo)
            if not os.path.exists(idx_path):
                return None
            try:
                indexed_at = os.path.getmtime(idx_path)
            except OSError:
                return None
            dias_atras = int((time.time() - indexed_at) // 86400)
            data_str = time.strftime('%d/%m/%Y %H:%M', time.localtime(indexed_at))
            return _template('indexacao', idioma, projeto=projeto_nome, data=data_str, dias=dias_atras)

        return None
    except Exception:
        return None


_TEMPLATES = {
    'pt': {
        'contagem':  "A base **{projeto}** tem **{videos}** vídeo(s) extraído(s) do YouTube e **{docs}** documento(s)/texto(s) — {total} fontes ao todo.",
        'recencia':  "A extração mais recente na base **{projeto}** foi em **{data}**.",
        'indexacao': "A base **{projeto}** foi indexada pela última vez em **{data}** ({dias} dia(s) atrás).",
    },
    'en': {
        'contagem':  "The **{projeto}** base has **{videos}** extracted YouTube video(s) and **{docs}** document(s)/text(s) — {total} sources total.",
        'recencia':  "The most recent extraction in the **{projeto}** base was on **{data}**.",
        'indexacao': "The **{projeto}** base was last indexed on **{data}** ({dias} day(s) ago).",
    },
    'es': {
        'contagem':  "La base **{projeto}** tiene **{videos}** video(s) de YouTube extraído(s) y **{docs}** documento(s)/texto(s) — {total} fuentes en total.",
        'recencia':  "La extracción más reciente en la base **{projeto}** fue el **{data}**.",
        'indexacao': "La base **{projeto}** se indexó por última vez el **{data}** (hace {dias} día(s)).",
    },
}


def _template(nome: str, idioma: str, **kwargs) -> str:
    tabela = _TEMPLATES.get(idioma, _TEMPLATES['pt'])
    fmt = tabela.get(nome, _TEMPLATES['pt'][nome])
    if 'videos' in kwargs and 'docs' in kwargs:
        kwargs['total'] = kwargs['videos'] + kwargs['docs']
    return fmt.format(**kwargs)

# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rota CALCULO — Fase 3 da formalização do roteamento de intenção
("Roteamento de Intenção — Spec de Implementação.md", 13/ago/2026).

Aritmética simples sobre números que vêm EXCLUSIVAMENTE do texto da pergunta
digitada pelo usuário — nunca de chunks recuperados via BM25 (PDFs,
transcrições, documentos de terceiros). Essa restrição é deliberada: números
extraídos de conteúdo de terceiro seriam exatamente o vetor de prompt
injection já sinalizado na avaliação do NVIDIA NOOA (10/ago/2026, ver
agents/_historia.md) — um documento malicioso poderia formatar um número
especificamente para virar uma expressão hostil se entrasse na pipeline de
cálculo. Revisado e aprovado por /seguranca em 14/ago/2026 (2 correções
aplicadas: ver avaliar_expressao — checagem de Pow antes de computar, e
checagem de tipo em Constant).

[REGRA DE OURO] Nunca eval()/exec(). Sem exceção, sem "só nesse caso".
"""

import re
import ast
import math

from tusab_engine.agent.router import Rota


ROTA_CALCULO = Rota(nome='CALCULO', precisa_retrieval=False, precisa_llm=False, custo_estimado_ms=0)


# ── Matcher determinístico ─────────────────────────────────────────────────────
# Conservador por design (mesmo princípio de pre_rotear/metadados): só
# reconhece CALCULO se, depois de remover a frase-gatilho, sobrar EXCLUSIVA-
# MENTE dígitos, operadores, ponto decimal, parênteses e espaço. Qualquer
# palavra ou caractere fora disso (nome de arquivo, "de", "vídeos"...) já
# não bate — cai pro fluxo normal (BUSCA), nunca força uma rota errada.

_GATILHOS = re.compile(
    r'^\s*(quanto\s+(é|e|vale|dá|da)|calcul[ae]|qual\s+(o\s+|é\s+o\s+)?resultado\s+de'
    r'|how\s+much\s+is|calculate|what(\'s|\s+is)\s+the\s+result\s+of'
    r'|cu[aá]nto\s+es|calcula|cu[aá]l\s+es\s+el\s+resultado\s+de)'
    r'\s*:?\s*',
    re.IGNORECASE,
)

# Só dígitos, operadores aritméticos, ponto decimal, parênteses, espaço.
# Deliberadamente NÃO aceita "%" como sufixo de porcentagem em linguagem
# natural ("15% de 200") — isso tem uma palavra ("de") no meio, que já
# reprova o matcher. "%" aqui só é válido como operador binário (módulo),
# ex. "17 % 5" — mesmo significado que Python.
_RE_EXPRESSAO_PURA = re.compile(r'^[\d\s+\-*/%.()]+$')

_MAX_EXPR_LEN = 200


def _extrair_expressao(pergunta: str) -> str:
    """Remove a frase-gatilho e pontuação final ('?', '.') — retorna None se
    o que sobra não for uma expressão puramente numérica/operadores."""
    pergunta = pergunta.strip()
    if len(pergunta) > _MAX_EXPR_LEN:
        return None
    sem_gatilho = _GATILHOS.sub('', pergunta, count=1).strip()
    sem_gatilho = sem_gatilho.rstrip('?!. ')
    if not sem_gatilho or not _RE_EXPRESSAO_PURA.match(sem_gatilho):
        return None
    # Precisa ter pelo menos um operador — "quanto é 42" sozinho não é
    # cálculo, é só um número (não deveria disparar essa rota).
    if not re.search(r'[+\-*/%]', sem_gatilho):
        return None
    return sem_gatilho


# ── Avaliador AST — nunca eval()/exec() ───────────────────────────────────────

_NOS_PERMITIDOS = (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant)
_BINOPS_PERMITIDOS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.FloorDiv, ast.Pow)
_UNARYOPS_PERMITIDOS = (ast.USub, ast.UAdd)

_MAX_DEPTH = 10
_MAX_MAGNITUDE = 1e15
# Estimativa de dígitos do resultado de a**b via log10(a) * b, sem computar
# a**b de verdade — rejeita ANTES do Python tentar representar um inteiro
# gigante (ex: 9**9**9 tem ~370 milhões de dígitos e travaria o processo
# tentando computar, não só tentando guardar o resultado).
_MAX_DIGITOS_POW = 15


def _validar_e_contar_profundidade(node, profundidade: int) -> bool:
    """Percorre a árvore ANTES de qualquer avaliação. Rejeita qualquer nó
    fora da whitelist, qualquer Constant que não seja int/float real
    (bloqueia string/bytes/complex/bool — ast.Constant cobre todos esses
    tipos, checar só o tipo do NÓ não basta), e profundidade > _MAX_DEPTH."""
    if profundidade > _MAX_DEPTH:
        return False
    if not isinstance(node, _NOS_PERMITIDOS):
        return False

    if isinstance(node, ast.Expression):
        return _validar_e_contar_profundidade(node.body, profundidade + 1)

    if isinstance(node, ast.Constant):
        # bool é subclasse de int em Python — rejeitar explicitamente.
        return isinstance(node.value, (int, float)) and not isinstance(node.value, bool)

    if isinstance(node, ast.BinOp):
        if not isinstance(node.op, _BINOPS_PERMITIDOS):
            return False
        return (
            _validar_e_contar_profundidade(node.left, profundidade + 1)
            and _validar_e_contar_profundidade(node.right, profundidade + 1)
        )

    if isinstance(node, ast.UnaryOp):
        if not isinstance(node.op, _UNARYOPS_PERMITIDOS):
            return False
        return _validar_e_contar_profundidade(node.operand, profundidade + 1)

    return False  # nó reconhecido pela whitelist de tipo, mas sem regra — nega por padrão


def _avaliar_no(node):
    """Avalia um nó JÁ VALIDADO por _validar_e_contar_profundidade — nunca
    chamar direto sem validar antes. Levanta exceção em overflow/divisão por
    zero; o chamador (avaliar_expressao) converte em None."""
    if isinstance(node, ast.Constant):
        return node.value

    if isinstance(node, ast.UnaryOp):
        valor = _avaliar_no(node.operand)
        return -valor if isinstance(node.op, ast.USub) else +valor

    if isinstance(node, ast.BinOp):
        esquerda = _avaliar_no(node.left)
        direita  = _avaliar_no(node.right)

        if isinstance(node.op, ast.Pow):
            # [CORREÇÃO /seguranca 14/ago/2026] Checar magnitude do
            # RESULTADO é tarde demais para Pow — o Python já tenta computar
            # a**b (potencialmente um inteiro com milhões de dígitos) antes
            # de qualquer check rodar. Estima via log10 e rejeita ANTES de
            # executar **, nunca depois.
            if esquerda not in (0, 0.0) and direita not in (0, 0.0):
                estimativa_digitos = abs(direita) * math.log10(abs(esquerda) + 1e-9)
                if estimativa_digitos > _MAX_DIGITOS_POW:
                    raise OverflowError("resultado de potenciação excede o limite permitido")
            resultado = esquerda ** direita
        elif isinstance(node.op, ast.Add):
            resultado = esquerda + direita
        elif isinstance(node.op, ast.Sub):
            resultado = esquerda - direita
        elif isinstance(node.op, ast.Mult):
            resultado = esquerda * direita
        elif isinstance(node.op, ast.Div):
            resultado = esquerda / direita
        elif isinstance(node.op, ast.Mod):
            resultado = esquerda % direita
        elif isinstance(node.op, ast.FloorDiv):
            resultado = esquerda // direita
        else:
            raise ValueError("operador não suportado")  # nunca deveria chegar aqui — já validado

        if abs(resultado) > _MAX_MAGNITUDE:
            raise OverflowError("resultado excede o limite permitido")
        return resultado

    raise ValueError("nó não suportado")  # nunca deveria chegar aqui — já validado


def avaliar_expressao(expr: str):
    """Avalia uma expressão aritmética pura com segurança. Retorna float ou
    None — None significa "não dá pra calcular com segurança", nunca uma
    exceção que o chamador precisa tratar. Nunca eval()/exec()."""
    if not expr or len(expr) > _MAX_EXPR_LEN:
        return None
    try:
        arvore = ast.parse(expr, mode='eval')
    except (SyntaxError, ValueError):
        return None

    if not _validar_e_contar_profundidade(arvore, profundidade=0):
        return None

    try:
        resultado = _avaliar_no(arvore.body)
    except (OverflowError, ZeroDivisionError, ValueError, TypeError):
        return None

    if not isinstance(resultado, (int, float)) or math.isnan(resultado) or math.isinf(resultado):
        return None
    return resultado


# ── Formatação da resposta ────────────────────────────────────────────────────

_TEMPLATES_RESULTADO = {
    'pt': "**{expr}** = **{resultado}**",
    'en': "**{expr}** = **{resultado}**",
    'es': "**{expr}** = **{resultado}**",
}


def _formatar_resultado(valor: float) -> str:
    # Resultado inteiro exato (ex: 4.0) mostra sem casas decimais — mais
    # legível pra "quanto é 2+2" responder "4", não "4.0".
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    if isinstance(valor, float):
        return f"{valor:.4f}".rstrip('0').rstrip('.')
    return str(valor)


def responder_calculo(pergunta: str, idioma: str = 'pt') -> str:
    """Retorna a resposta pronta (string) se a pergunta é uma expressão
    aritmética pura E o avaliador consegue computar com segurança. Retorna
    None em qualquer outro caso — o chamador degrada para o fluxo normal
    (classificador LLM + BM25), nunca trava nem inventa resultado.
    """
    try:
        expr = _extrair_expressao(pergunta)
        if expr is None:
            return None
        resultado = avaliar_expressao(expr)
        if resultado is None:
            return None
        template = _TEMPLATES_RESULTADO.get(idioma, _TEMPLATES_RESULTADO['pt'])
        return template.format(expr=expr, resultado=_formatar_resultado(resultado))
    except Exception:
        return None

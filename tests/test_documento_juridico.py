# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Testes do parser de documentos jurídicos (petição/contrato/parecer), perfil
Especialista. Mesmo padrão do parser de WhatsApp/Zoom já existente —
detecção por estrutura textual, sem dependência externa.
"""
from tusab_engine.api.router_repositorio import (
    _detectar_formato_especial,
    _parsear_documento_juridico,
    _processar_formato_especial,
)


# ─── Detecção ──────────────────────────────────────────────────────────────────

def test_detecta_peticao_vocativo_tradicional():
    texto = "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 1ª VARA CÍVEL\n\nFulano de Tal, já qualificado..."
    assert _detectar_formato_especial(texto, "peticao.txt") == 'peticao'


def test_detecta_peticao_vocativo_moderno():
    texto = "Ao Juízo da 3ª Vara Cível da Comarca de São Paulo\n\nFulano de Tal vem requerer..."
    assert _detectar_formato_especial(texto, "inicial.txt") == 'peticao'


def test_detecta_contrato_por_clausula_primeira():
    texto = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCLÁUSULA PRIMEIRA - DO OBJETO\nO presente contrato tem por objeto..."
    assert _detectar_formato_especial(texto, "contrato.txt") == 'contrato'


def test_detecta_parecer_por_cabecalho():
    texto = "PARECER JURÍDICO Nº 12/2026\n\nEmenta: Sobre a validade de cláusula de não concorrência.\n\nI. Relatório..."
    assert _detectar_formato_especial(texto, "parecer.txt") == 'parecer'


def test_detecta_parecer_por_ementa_sem_titulo():
    texto = "Ementa: Análise de risco contratual.\n\nDos fatos apresentados, cumpre esclarecer..."
    assert _detectar_formato_especial(texto, "analise.txt") == 'parecer'


def test_nao_detecta_texto_generico():
    texto = "Este é um texto qualquer, sem nenhuma estrutura jurídica reconhecível."
    assert _detectar_formato_especial(texto, "notas.txt") is None


def test_contrato_tem_precedencia_correta_sobre_texto_com_clausula_isolada():
    # "cláusula" sozinha, sem "primeira/1ª/I", não deve disparar falso positivo
    texto = "Discutimos a cláusula de confidencialidade numa reunião informal ontem."
    assert _detectar_formato_especial(texto, "notas.txt") is None


# ─── Parsing estrutural ─────────────────────────────────────────────────────────

def test_parsear_peticao_adiciona_cabecalho_tipo():
    texto = "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ...\n\nFulano requer..."
    resultado = _parsear_documento_juridico(texto, 'peticao')
    assert "Tipo de documento: Petição" in resultado
    assert "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ" in resultado  # texto original preservado


def test_parsear_contrato_extrai_clausulas():
    texto = (
        "CONTRATO DE LOCAÇÃO\n\n"
        "CLÁUSULA PRIMEIRA - DO OBJETO\nLocação do imóvel situado...\n\n"
        "CLÁUSULA SEGUNDA - DO PRAZO\nO prazo será de 12 meses...\n\n"
        "CLÁUSULA TERCEIRA - DO VALOR\nO aluguel mensal será de R$ 2.000,00."
    )
    resultado = _parsear_documento_juridico(texto, 'contrato')
    assert "Tipo de documento: Contrato" in resultado
    assert "Cláusulas identificadas (3)" in resultado
    assert "PRIMEIRA" in resultado.upper()


def test_parsear_contrato_extrai_cpf_e_cnpj():
    texto = (
        "CONTRATO\n\nCLÁUSULA PRIMEIRA - DAS PARTES\n"
        "CONTRATANTE: Empresa XYZ Ltda, CNPJ nº 12.345.678/0001-90.\n"
        "CONTRATADO: Fulano de Tal, CPF nº 123.456.789-00."
    )
    resultado = _parsear_documento_juridico(texto, 'contrato')
    assert "123.456.789-00" in resultado
    assert "12.345.678/0001-90" in resultado


def test_parsear_parecer_extrai_ementa():
    texto = (
        "PARECER JURÍDICO Nº 5/2026\n\n"
        "Ementa: Análise sobre rescisão contratual sem justa causa.\n\n"
        "I. RELATÓRIO\nTrata-se de consulta formulada por..."
    )
    resultado = _parsear_documento_juridico(texto, 'parecer')
    assert "Tipo de documento: Parecer jurídico" in resultado
    assert "rescisão contratual sem justa causa" in resultado


def test_parsear_documento_sem_campos_extraiveis_retorna_texto_original():
    # Petição sem CPF/CNPJ no corpo — cabeçalho de tipo ainda deve aparecer
    texto = "Ao Juízo da Vara Cível\n\nFulano requer a procedência do pedido."
    resultado = _parsear_documento_juridico(texto, 'peticao')
    assert resultado.startswith("Tipo de documento: Petição")


# ─── Integração via _processar_formato_especial ────────────────────────────────

def test_processar_formato_especial_roteia_peticao():
    texto = "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ...\n\nFulano requer..."
    resultado, fmt = _processar_formato_especial(texto, "peticao.txt")
    assert fmt == 'peticao'
    assert "Tipo de documento: Petição" in resultado


def test_processar_formato_especial_nao_interfere_com_whatsapp():
    texto = "10/01/2026 14:30 - João: Oi, tudo bem?\n10/01/2026 14:31 - Maria: Tudo sim!"
    resultado, fmt = _processar_formato_especial(texto, "conversa.txt")
    assert fmt == 'whatsapp_android'
    assert "Tipo de documento" not in resultado


def test_processar_formato_especial_texto_generico_retorna_none():
    texto = "Anotações soltas sobre o projeto, sem estrutura específica."
    resultado, fmt = _processar_formato_especial(texto, "notas.txt")
    assert fmt is None
    assert resultado == texto

# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte única de verdade para:
  - obter_caminho_dados / obter_caminho_assets
  - constantes de path (DATA_DIR, CEREBRO_DIR, …)
  - escrita atômica de CSV e JSON

Ambos motor_sebayt.py e agent_sebayt.py importavam cópias idênticas
dessas funções. Centralizando aqui eliminamos a duplicação e garantimos que
SEBAYT_DATA_DIR (injetado pelo Electron ou pelo conftest de testes) é
respeitado por todos os módulos.
"""

import os
import sys
import json

_PACK = os.path.dirname(os.path.abspath(__file__))   # .../sebayt_engine/
_ROOT = os.path.dirname(_PACK)                        # raiz do projeto


def obter_caminho_dados() -> str:
    """Pasta raiz dos dados persistentes.
    Prioridade: SEBAYT_DATA_DIR → PyInstaller frozen → raiz do projeto.
    """
    if os.environ.get('SEBAYT_DATA_DIR'):
        return os.environ['SEBAYT_DATA_DIR']
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return _ROOT


def obter_caminho_assets() -> str:
    """Pasta de assets internos do build (credentials.json, logos).
    Em produção aponta para _MEIPASS (pacote PyInstaller), em dev para a raiz.
    """
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    return _ROOT


# ── Constantes de path ────────────────────────────────────────────────────────
DADOS_DIR        = obter_caminho_dados()
ASSETS_DIR       = obter_caminho_assets()
DATA_DIR         = os.path.join(DADOS_DIR, 'data')
CEREBRO_DIR      = os.path.join(DATA_DIR, 'cerebro')
GESTAO_DIR       = os.path.join(DATA_DIR, 'gestao')
TEMP_DIR         = os.path.join(DATA_DIR, 'temp')

# Nomes usados pelo motor
LOCAL_TXT_DIR    = os.path.join(CEREBRO_DIR, 'youtube')   # legado flat
DOCUMENTOS_DIR   = os.path.join(CEREBRO_DIR, 'documentos')
TEXTOS_DIR       = os.path.join(CEREBRO_DIR, 'textos')

# Aliases usados pelo agente (mesmos paths, nomes históricos)
TXT_DIR          = LOCAL_TXT_DIR
DOC_DIR          = DOCUMENTOS_DIR
TEXT_DIR         = TEXTOS_DIR

# Auth e config
TOKEN_PATH       = os.path.join(DATA_DIR, 'config', 'token.json')
CREDENTIALS_PATH = os.path.join(ASSETS_DIR, 'credentials.json')
CONFIG_PATH      = os.path.join(DATA_DIR, 'config', 'agent_config.json')
INDEX_DIR        = os.path.join(DATA_DIR, 'agent_index')


# ── Escrita atômica ───────────────────────────────────────────────────────────
# Padrão write-to-temp + os.replace: o replace é atômico no mesmo volume,
# então o arquivo final é sempre íntegro — nunca um intermediário truncado.

def salvar_csv_atomico(df, path: str):
    tmp = path + '.tmp'
    df.to_csv(tmp, index=False, encoding='utf-8-sig')
    os.replace(tmp, path)


def salvar_json_atomico(obj, path: str, indent=None):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, path)

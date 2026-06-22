# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fonte única de verdade para:
  - obter_caminho_dados / obter_caminho_assets
  - constantes de path (DATA_DIR, CEREBRO_DIR, …)
  - escrita atômica de CSV e JSON

Ambos motor_tusab.py e agent_tusab.py importavam cópias idênticas
dessas funções. Centralizando aqui eliminamos a duplicação e garantimos que
TUSAB_DATA_DIR (injetado pelo Electron ou pelo conftest de testes) é
respeitado por todos os módulos.
"""

import os
import sys
import json

_PACK = os.path.dirname(os.path.abspath(__file__))   # .../tusab_engine/
_ROOT = os.path.dirname(_PACK)                        # raiz do projeto


def obter_caminho_dados() -> str:
    """Pasta raiz dos dados persistentes.
    Prioridade: TUSAB_DATA_DIR → PyInstaller frozen → raiz do projeto.
    """
    if os.environ.get('TUSAB_DATA_DIR'):
        return os.environ['TUSAB_DATA_DIR']
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
NEURAL_DIR       = os.path.join(DATA_DIR, 'neural')
CEREBRO_DIR      = NEURAL_DIR  # alias legado — remover após migração completa
GESTAO_DIR       = os.path.join(DATA_DIR, 'gestao')   # legado — preferir gestao_canal_dir()
TEMP_DIR         = os.path.join(DATA_DIR, 'temp')


def get_canal_youtube_dir(projeto: str, canal: str) -> str:
    """Diretório de transcrições YouTube: data/neural/{projeto}/youtube/{canal}/"""
    return os.path.join(NEURAL_DIR, projeto, 'youtube', canal)


def gestao_canal_dir(prefixo: str) -> str:
    """Retorna (e cria) data/neural/{prefixo}/management/ — novo local canônico."""
    path = os.path.join(NEURAL_DIR, prefixo, 'management')
    os.makedirs(path, exist_ok=True)
    return path


def migrar_gestao_para_cerebro():
    """Move arquivos de data/gestao/{prefixo}_* para data/cerebro/{prefixo}/management/.
    Executada uma vez na inicialização; idempotente.
    """
    import glob
    import shutil
    if not os.path.exists(GESTAO_DIR):
        return
    padrao = os.path.join(GESTAO_DIR, '*_base.csv')
    for csv_path in glob.glob(padrao):
        prefixo = os.path.basename(csv_path).replace('_base.csv', '')
        destino = gestao_canal_dir(prefixo)
        for fname in os.listdir(GESTAO_DIR):
            if fname.startswith(prefixo + '_') or fname.startswith(prefixo + '.'):
                src = os.path.join(GESTAO_DIR, fname)
                dst = os.path.join(destino, fname)
                if not os.path.exists(dst):
                    try:
                        shutil.move(src, dst)
                    except Exception:
                        pass


def migrar_pastas_para_ingles():
    """Renomeia subpastas legadas em data/cerebro/{canal}/ para os nomes em inglês.

    Mapeamento: documentos → documents, textos → texts, gestao → management.
    Executada uma vez na inicialização; idempotente.
    """
    import shutil
    _RENAMES = {
        'documentos': 'documents',
        'textos':      'texts',
        'gestao':      'management',
    }
    if not os.path.exists(NEURAL_DIR):
        return
    for canal_entry in os.scandir(NEURAL_DIR):
        if not canal_entry.is_dir():
            continue
        for old_name, new_name in _RENAMES.items():
            old_path = os.path.join(canal_entry.path, old_name)
            new_path = os.path.join(canal_entry.path, new_name)
            if os.path.exists(old_path) and not os.path.exists(new_path):
                try:
                    shutil.move(old_path, new_path)
                except Exception:
                    pass

# Nomes usados pelo motor
LOCAL_TXT_DIR    = os.path.join(NEURAL_DIR, 'youtube')   # legado flat
DOCUMENTOS_DIR   = os.path.join(NEURAL_DIR, 'documents')
TEXTOS_DIR       = os.path.join(NEURAL_DIR, 'texts')

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

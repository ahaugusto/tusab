# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Leitura e escrita da configuração do agente RAG.
Ponto único de acesso a agent_config.json.

Quando rodando dentro do Electron, api_key pode conter o sentinel "__encrypted__"
indicando que a chave real está no OS keychain (Windows DPAPI / macOS Keychain) via
safeStorage. O Electron main.js decripta e reinforma o backend com a chave real no
boot — portanto o backend nunca precisa lidar com o sentinel diretamente, mas
chat.py trata api_key == "__encrypted__" como ausência de chave válida.
"""

SENTINEL_KEY = '__encrypted__'

import os
import json
import time

from tusab_engine.storage import CONFIG_PATH, salvar_json_atomico


def carregar_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def salvar_config(config: dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    salvar_json_atomico(config, CONFIG_PATH, indent=2)


def registrar_primeiro_uso() -> dict:
    """Grava timestamp de primeiro uso (idempotente) e retorna métricas de retenção.

    Retorna dict com:
      - primeiro_uso: timestamp ISO do primeiro uso
      - dias_desde_install: int
      - retencao_dia: 1 | 7 | 30 | None (None se não atingiu nenhuma marca nova)
    """
    config = carregar_config()
    agora  = time.time()

    # Grava primeiro_uso apenas uma vez
    if 'primeiro_uso' not in config:
        config['primeiro_uso'] = agora
        salvar_config(config)

    primeiro = config['primeiro_uso']
    dias = int((agora - primeiro) / 86400)

    # Marca de retenção: dispara se cruzou uma marca E ainda não foi registrada
    marcos = {1: 'retencao_dia1_registrado', 7: 'retencao_dia7_registrado', 30: 'retencao_dia30_registrado'}
    nova_marca = None
    for limite, flag in marcos.items():
        if dias >= limite and not config.get(flag):
            config[flag] = True
            salvar_config(config)
            nova_marca = limite
            break  # uma marca por sessão

    return {
        'primeiro_uso': primeiro,
        'dias_desde_install': dias,
        'retencao_dia': nova_marca,
    }

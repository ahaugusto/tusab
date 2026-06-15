# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Leitura e escrita da configuração do agente RAG.
Ponto único de acesso a agent_config.json — quando vier keytar (P3),
apenas essas duas funções mudam.
"""

import os
import json

from brainiac_engine.storage import CONFIG_PATH, salvar_json_atomico


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

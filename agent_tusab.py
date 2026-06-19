# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Shim de compatibilidade — todo o código migrou para tusab_engine/agent/.
# Este arquivo permanece na raiz porque:
#   (a) electron/package.json o lista em extraResources.filter;
#   (b) os testes o importam diretamente;
#   (c) api_tusab.py usa `agent_tusab.*` por todo o código.

from tusab_engine.agent.config import carregar_config, salvar_config           # noqa: F401
from tusab_engine.agent.index import (                                          # noqa: F401
    indexar, get_agent_status,
    _invalidar_cache, _index_path, _carregar_meta_canal,
    _get_canal_youtube_dir, _get_canal_doc_dirs,
    _bm25_cache, _bm25_lock,
)
from tusab_engine.agent.chat import (                                           # noqa: F401
    chat, chat_stream, _recuperar_contexto,
)
from tusab_engine.storage import (                                              # noqa: F401
    DADOS_DIR, DATA_DIR, CONFIG_PATH, INDEX_DIR,
    NEURAL_DIR, CEREBRO_DIR, TXT_DIR, DOC_DIR, TEXT_DIR,
    salvar_json_atomico, obter_caminho_dados,
)

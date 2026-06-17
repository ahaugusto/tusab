# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Shim de compatibilidade — todo o código migrou para tusab_engine/motor/.
# Este arquivo permanece na raiz porque:
#   (a) electron/package.json o lista em extraResources.filter;
#   (b) api_brainiac.py usa `motor_tusab.*` por todo o código.

from tusab_engine.motor.drive import (                        # noqa: F401
    get_drive_status, is_authenticated, get_drive_service,
    _drive_escape, garantir_pasta_drive,
    _enviar_texto_gdoc, upload_txt_como_gdoc_seguro, upload_arquivo_drive,
)
from tusab_engine.motor.extraction import (                   # noqa: F401
    sanitizar_nome, extrair_nome_canal, formatar_data, limpar_vtt,
    executar_comando, detectar_idiomas_canal, gerar_fontes,
    get_canal_youtube_dir, migrar_canal_para_subdir, migrar_cerebro_txt,
    coletar_meta_canal, gerar_relatorio_checkup, gerar_readme,
    tusab_engine,
)
from tusab_engine.storage import (                            # noqa: F401
    DADOS_DIR, ASSETS_DIR, DATA_DIR,
    CEREBRO_DIR, LOCAL_TXT_DIR, DOCUMENTOS_DIR, TEXTOS_DIR,
    GESTAO_DIR, TEMP_DIR, TOKEN_PATH, CREDENTIALS_PATH,
    salvar_csv_atomico, salvar_json_atomico,
    obter_caminho_dados, obter_caminho_assets,
)

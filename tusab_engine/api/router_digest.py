# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Rotas de Digest Semanal: listar e gerar digest de novidades por projeto.
"""

import re

from fastapi import APIRouter, BackgroundTasks

router = APIRouter()


@router.get("/agent/digest/{projeto}")
def agent_digest_listar(projeto: str):
    """Lista digests salvos para o projeto.

    Retorna:
        {"digests": [{"data": "YYYY-MM-DD", "preview": "...", "filename": "digest_*.md"}]}
    """
    from tusab_engine.scheduler import listar_digests
    projeto_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto).strip('_')
    if not projeto_prefixo:
        return {"digests": []}
    return {"digests": listar_digests(projeto_prefixo)}


@router.post("/agent/digest/{projeto}")
async def agent_digest_gerar(projeto: str, background_tasks: BackgroundTasks):
    """Dispara a geração manual de digest para o projeto em background task.

    Retorna ok=True se havia arquivos novos (job enfileirado) ou ok=False caso contrário.
    """
    from tusab_engine.scheduler import gerar_digest, _arquivos_novos

    projeto_prefixo = re.sub(r'[<>:"/\\|?*\s]', '_', projeto).strip('_')
    if not projeto_prefixo:
        return {"ok": False, "message": "Projeto inválido."}

    arquivos = _arquivos_novos(projeto_prefixo)
    if not arquivos:
        return {"ok": False, "message": "Nenhum arquivo novo esta semana."}

    background_tasks.add_task(gerar_digest, projeto_prefixo)
    return {"ok": True, "message": f"Digest gerado para @{projeto_prefixo} ({len(arquivos)} arquivo(s) novo(s))."}

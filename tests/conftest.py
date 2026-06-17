# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Fixtures compartilhadas da suíte de testes.

Isolamento: BRAINIAC_DATA_DIR aponta para um diretório temporário ANTES de
importar os módulos da aplicação — nenhum teste toca os dados reais do usuário.
"""
import os
import sys
import tempfile

import pytest

# --- Isolamento de dados: precisa acontecer antes de qualquer import da app ---
_TMP_DATA = tempfile.mkdtemp(prefix="tusab_test_")
os.environ["TUSAB_DATA_DIR"] = _TMP_DATA

# Raiz do projeto no sys.path (tests/ fica um nível abaixo)
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


@pytest.fixture(scope="session")
def client():
    """TestClient da API com stdout/stderr restaurados (a app os redireciona)."""
    from fastapi.testclient import TestClient
    import api_tusab

    # A app sobrescreve sys.stdout/stderr com o LogRedirector ao importar.
    # Restaura para o pytest exibir saída normalmente.
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__

    return TestClient(api_tusab.app)


@pytest.fixture()
def data_dir():
    """Diretório de dados temporário usado pela app durante os testes."""
    return os.path.join(_TMP_DATA, "data")

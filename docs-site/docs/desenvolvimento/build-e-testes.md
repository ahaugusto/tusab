---
id: build-e-testes
title: Build de produção e testes
sidebar_label: Build e testes
slug: /desenvolvimento/build-e-testes
---

# Build de produção e testes

## Build de produção (Windows)

```powershell
# 1. Build do frontend
cd web_interface
npm run build
cd ..

# 2. Build do instalador Windows
cd electron
npm run build
```

Saída: `dist_electron/Tusab-Setup-X.X.X.exe`.

**Pré-requisito:** `electron/python_env/` precisa estar populado com um Python 3.12 embeddable e as dependências instaladas, e `electron/bin/yt-dlp.exe` precisa existir. Essas pastas são grandes e gitignored — configure uma vez localmente antes de buildar.

## Build de produção (macOS)

O build macOS (`.dmg`/`.zip` assinado e notarizado, Apple Silicon) roda via `electron-builder --mac` no GitHub Actions (`macos-latest`), com notarização automatizada via `@electron/notarize`. Não há build local documentado — todo teste macOS passa por CI real, já que não há hardware Mac disponível para desenvolvimento.

Cross-build de ARM64 a partir de host Intel é suportado (`pip install --platform macosx_14_0_arm64 ...`), evitando depender de runner dedicado ARM64.

## Testes

```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```

```
tests/
  conftest.py               fixture: TUSAB_DATA_DIR aponta para um tempdir antes de qualquer import
  test_api.py                integração (TestClient FastAPI) — rotas /neural/*, /queue/*, /agent/*
  test_confiabilidade.py     escrita atômica, concorrência, índice corrompido/vazio
```

## Smoke tests

```powershell
python smoke_test.py
```

Roda contra um backend real na porta 8001 — cobre yt-dlp, endpoints de status/repositório/fila/assistente, validação de chave, bloqueio de path traversal e serve de `index.html`. Configurado como pre-commit hook.

## Gate mínimo para qualquer PR

Suite `pytest` completa + `smoke.ps1 -Suite full`, independente da plataforma-alvo da mudança. Uma alteração pensada só para macOS não pode alterar o comportamento no Windows quando a condição de plataforma é falsa, e vice-versa.

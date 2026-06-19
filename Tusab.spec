# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec para Tusab — gera dist/Tusab.exe (onefile, sem console)
# Rodar: .venv\Scripts\python.exe -m PyInstaller Tusab.spec
import os

block_cipher = None

arquivos_adicionais = [
    ('web_interface/dist',           'web_interface/dist'),
    ('web_interface/public/logo_dark.png',  'web_interface/public'),
    ('web_interface/public/logo_light.png', 'web_interface/public'),
    ('tusab_engine',                 'tusab_engine'),
]

if os.path.exists('credentials.json'):
    arquivos_adicionais.append(('credentials.json', '.'))

a = Analysis(
    ['api_tusab.py'],
    pathex=[],
    binaries=[],
    datas=arquivos_adicionais,
    hiddenimports=[
        'uvicorn', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
        'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan', 'uvicorn.lifespan.on',
        'fastapi', 'starlette',
        'yt_dlp', 'pandas',
        'rank_bm25',
        'pdfplumber', 'docx',
        'google.auth', 'google.auth.transport.requests',
        'google.oauth2.credentials',
        'google_auth_oauthlib.flow',
        'googleapiclient.discovery',
        'googleapiclient.http',
        'tusab_engine.api.router_status',
        'tusab_engine.api.router_extraction',
        'tusab_engine.api.router_agent',
        'tusab_engine.api.router_repositorio',
        'tusab_engine.api.router_exports',
        'tusab_engine.motor.drive',
        'tusab_engine.motor.extraction',
        'tusab_engine.agent.config',
        'tusab_engine.agent.index',
        'tusab_engine.agent.chat',
        'tusab_engine.state',
        'tusab_engine.storage',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['customtkinter', 'tkinter'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Tusab',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='web_interface/public/logo_dark.png',
)

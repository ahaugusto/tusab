# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Integração com Google Drive: autenticação OAuth2 e upload de arquivos/docs.
"""

import os
import io
import threading

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

from tusab_engine.storage import TOKEN_PATH, CREDENTIALS_PATH

SCOPES = ['https://www.googleapis.com/auth/drive.file']


def get_drive_status():
    """Retorna 'sem_credenciais' | 'nao_autenticado' | 'autenticado'."""
    if not os.path.exists(CREDENTIALS_PATH):
        return 'sem_credenciais'
    if not os.path.exists(TOKEN_PATH):
        return 'nao_autenticado'
    try:
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        if creds and creds.valid:
            return 'autenticado'
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PATH, 'w') as token:
                token.write(creds.to_json())
            return 'autenticado'
    except Exception:
        pass
    return 'nao_autenticado'


def is_authenticated():
    return get_drive_status() == 'autenticado'


def get_drive_service(stop_event=None):
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)

            if stop_event is not None:
                server_ref = [None]
                original_run = flow.run_local_server

                def run_with_ref(*args, **kwargs):
                    import wsgiref.simple_server as _wsr
                    _orig_make = _wsr.make_server
                    def _make_and_store(host, port, app_wsgi, *a, **kw):
                        srv = _orig_make(host, port, app_wsgi, *a, **kw)
                        server_ref[0] = srv
                        return srv
                    _wsr.make_server = _make_and_store
                    try:
                        return original_run(*args, **kwargs)
                    finally:
                        _wsr.make_server = _orig_make

                flow.run_local_server = run_with_ref

                def _watchdog():
                    stop_event.wait()
                    if server_ref[0] is not None:
                        try:
                            server_ref[0].shutdown()
                        except Exception:
                            pass

                threading.Thread(target=_watchdog, daemon=True).start()

            creds = flow.run_local_server(port=0)
            if stop_event and stop_event.is_set():
                raise TimeoutError("Login cancelado.")

        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)


def _drive_escape(value: str) -> str:
    """Escapes a string value for use inside Google Drive API query strings."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def garantir_pasta_drive(service, nome, parent_id=None):
    nome_q = _drive_escape(nome)
    if parent_id:
        pid_q = _drive_escape(parent_id)
        query = (f"name = '{nome_q}' and '{pid_q}' in parents "
                 f"and mimeType = 'application/vnd.google-apps.folder' and trashed = false")
    else:
        query = (f"name = '{nome_q}' and 'root' in parents "
                 f"and mimeType = 'application/vnd.google-apps.folder' and trashed = false")
    res = service.files().list(q=query).execute().get('files', [])
    if res:
        return res[0]['id']
    meta = {'name': nome, 'mimeType': 'application/vnd.google-apps.folder'}
    if parent_id:
        meta['parents'] = [parent_id]
    return service.files().create(body=meta, fields='id').execute().get('id')


def _enviar_texto_gdoc(service, nome_arquivo, texto, drive_folder_id):
    file_metadata = {
        'name': nome_arquivo,
        'parents': [drive_folder_id],
        'mimeType': 'application/vnd.google-apps.document'
    }
    fh = io.BytesIO(texto.encode('utf-8'))
    media = MediaIoBaseUpload(fh, mimetype='text/plain', resumable=True)
    q = f"name = '{_drive_escape(nome_arquivo)}' and '{_drive_escape(drive_folder_id)}' in parents and trashed = false"
    res = service.files().list(q=q).execute().get('files', [])
    try:
        if res:
            service.files().update(fileId=res[0]['id'], media_body=media).execute()
            print(f"      🔄 Atualizado no Drive: {nome_arquivo}")
        else:
            service.files().create(body=file_metadata, media_body=media).execute()
            print(f"      ⬆️ Sincronizado: {nome_arquivo}")
    except Exception as e:
        print(f"      ❌ Erro ao subir {nome_arquivo}: {e}")


def upload_txt_como_gdoc_seguro(service, filepath, drive_folder_id):
    filename = os.path.basename(filepath)
    name_without_ext = os.path.splitext(filename)[0]
    tamanho_mb = os.path.getsize(filepath) / (1024 * 1024)

    with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
        conteudo = f.read()

    if tamanho_mb > 0.4:
        print(f"      ⚠️ Arquivo grande ({tamanho_mb:.2f}MB). Fatiando {name_without_ext}...")
        blocos = conteudo.split('=' * 70)
        texto_temp = ""
        letra_parte = 65
        for bloco in blocos:
            if not bloco.strip():
                continue
            texto_temp += bloco + "\n" + "=" * 70 + "\n"
            if len(texto_temp) > 300000:
                sub_nome = f"{name_without_ext}_{chr(letra_parte)}"
                _enviar_texto_gdoc(service, sub_nome, texto_temp, drive_folder_id)
                letra_parte += 1
                texto_temp = ""
        if texto_temp.strip():
            sub_nome = f"{name_without_ext}_{chr(letra_parte)}"
            _enviar_texto_gdoc(service, sub_nome, texto_temp, drive_folder_id)
    else:
        _enviar_texto_gdoc(service, name_without_ext, conteudo, drive_folder_id)


def upload_arquivo_drive(service, filepath, drive_folder_id):
    filename = os.path.basename(filepath)
    media = MediaFileUpload(filepath, resumable=True)
    q = f"name = '{filename}' and '{drive_folder_id}' in parents and trashed = false"
    res = service.files().list(q=q).execute().get('files', [])
    if res:
        service.files().update(fileId=res[0]['id'], media_body=media).execute()
        print(f"      🔄 Atualizado no Drive: {filename}")
    else:
        service.files().create(
            body={'name': filename, 'parents': [drive_folder_id]},
            media_body=media
        ).execute()
        print(f"      ⬆️ Sincronizado: {filename}")

# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
# Autor: Augusto Brasil — https://linkedin.com/in/augustoalvesbrasil
# Todos os direitos reservados. Proibida a reprodução sem autorização expressa.
# Protegido pela Lei nº 9.609/1998 (Lei do Software) e Lei nº 9.610/1998.

import os
import sys
import time
import subprocess
import re
import io
import json
import threading
import pandas as pd
from datetime import datetime

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

# ==========================================
# --- CONFIGURAÇÕES E CAMINHOS ---
# ==========================================

SCOPES = ['https://www.googleapis.com/auth/drive.file']
MAX_WORDS_PER_FILE = 40000


def obter_caminho_dados():
    """Pasta raiz dos dados persistentes.
    Prioridade: var de ambiente BRAINIAC_DATA_DIR (injetada pelo Electron)
    → executável PyInstaller → diretório do script.
    """
    if os.environ.get('BRAINIAC_DATA_DIR'):
        return os.environ['BRAINIAC_DATA_DIR']
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def obter_caminho_assets():
    """Pasta interna ao build (onde ficam credentials.json e logos)."""
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


DADOS_DIR  = obter_caminho_dados()
ASSETS_DIR = obter_caminho_assets()
DATA_DIR   = os.path.join(DADOS_DIR, 'data')

CEREBRO_DIR      = os.path.join(DATA_DIR, 'cerebro')
LOCAL_TXT_DIR    = os.path.join(CEREBRO_DIR, 'youtube')
DOCUMENTOS_DIR   = os.path.join(CEREBRO_DIR, 'documentos')
TEXTOS_DIR       = os.path.join(CEREBRO_DIR, 'textos')
GESTAO_DIR       = os.path.join(DATA_DIR, 'gestao')
TEMP_DIR         = os.path.join(DATA_DIR, 'temp')
TOKEN_PATH       = os.path.join(DATA_DIR, 'config', 'token.json')
CREDENTIALS_PATH = os.path.join(ASSETS_DIR, 'credentials.json')


# ==========================================
# --- UTILITÁRIOS ---
# ==========================================

def sanitizar_nome(nome):
    if not nome:
        return "Canal"
    return re.sub(r'[<>:"/\\|?*\s]', '_', str(nome)).strip('_')


def extrair_nome_canal(url):
    match = re.search(r'@([^/?\s]+)', url)
    if match:
        return match.group(1)
    parts = url.rstrip('/').split('/')
    name = parts[-1].lstrip('@') if parts else "Canal"
    return name.split('?')[0]


def formatar_data(data_str):
    if not data_str or data_str == 'NA':
        return ""
    try:
        return datetime.strptime(str(data_str), '%Y%m%d').strftime('%d/%m/%Y')
    except Exception:
        return data_str


def limpar_vtt(caminho_vtt):
    if not os.path.exists(caminho_vtt):
        return ""
    with open(caminho_vtt, 'r', encoding='utf-8', errors='replace') as f:
        linhas = f.readlines()
    texto_limpo = []
    for linha in linhas:
        if '-->' not in linha and not linha.strip().isdigit() and 'WEBVTT' not in linha:
            linha = re.sub(r'<[^>]*>', '', linha)
            if linha.strip():
                texto_limpo.append(linha.strip())
    resultado = []
    if texto_limpo:
        resultado.append(texto_limpo[0])
        for i in range(1, len(texto_limpo)):
            if texto_limpo[i] != texto_limpo[i - 1]:
                resultado.append(texto_limpo[i])
    return " ".join(resultado).strip()


def executar_comando(cmd):
    creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    result = subprocess.run(
        cmd, capture_output=True, text=False,
        check=False, creationflags=creationflags
    )
    return result.stdout.decode('utf-8', errors='replace')


def detectar_idiomas_canal(_all_videos):
    """Retorna idioma fixo para evitar 429.
    Tentativas duplas (pt + en) causam rate limit no YouTube — mantemos só pt,
    que cobre canais BR e captura auto-legendas em pt-BR/pt por preferência."""
    return 'pt'


def gerar_fontes(canal_url):
    base = canal_url.rstrip('/')
    return [
        {"aba": "Videos",    "url": f"{base}/videos",    "is_playlist": False},
        {"aba": "Shorts",    "url": f"{base}/shorts",    "is_playlist": False},
        {"aba": "Ao_Vivo",   "url": f"{base}/streams",   "is_playlist": False},
        {"aba": "Podcasts",  "url": f"{base}/podcasts",  "is_playlist": False},
        {"aba": "Cursos",    "url": f"{base}/courses",   "is_playlist": False},
        {"aba": "Playlists", "url": f"{base}/playlists", "is_playlist": True},
    ]


# ==========================================
# --- GOOGLE DRIVE ---
# ==========================================

def get_drive_status():
    """
    Retorna o status da integração com o Google Drive.
    Valores: 'sem_credenciais' | 'nao_autenticado' | 'autenticado'
    """
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

            # Suporte ao stop_event: derruba o servidor OAuth se cancelado
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


def garantir_pasta_drive(service, nome, parent_id=None):
    if parent_id:
        query = (f"name = '{nome}' and '{parent_id}' in parents "
                 f"and mimeType = 'application/vnd.google-apps.folder' and trashed = false")
    else:
        query = (f"name = '{nome}' and 'root' in parents "
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
    q = f"name = '{nome_arquivo}' and '{drive_folder_id}' in parents and trashed = false"
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


# ==========================================
# --- RELATÓRIO E README ---
# ==========================================

def gerar_relatorio_checkup(canal_nome_safe, db_file):
    print("\n📊 [GERANDO RELATÓRIO DE AUDITORIA]...")
    caminho_relatorio = os.path.join(GESTAO_DIR, f'{canal_nome_safe}_relatorio.txt')

    if not os.path.exists(db_file):
        print("❌ CSV não encontrado. Impossível gerar relatório.")
        return caminho_relatorio

    df = pd.read_csv(db_file, encoding='utf-8-sig')
    col_cat = 'Aba' if 'Aba' in df.columns else None
    if not col_cat:
        print("❌ Coluna de categoria não encontrada.")
        return caminho_relatorio

    total = len(df)
    if total == 0:
        return caminho_relatorio

    sucessos = len(df[df['Status'] == 'Sucesso'])
    falhas = total - sucessos
    views_totais = pd.to_numeric(df['Views'], errors='coerce').sum() if 'Views' in df.columns else 0

    stats = df.groupby(col_cat).agg(
        Total=('ID', 'count'),
        Sucesso=('Status', lambda x: (x == 'Sucesso').sum())
    )
    stats['Cobertura %'] = (stats['Sucesso'] / stats['Total'] * 100).round(1)

    with open(caminho_relatorio, 'w', encoding='utf-8') as f:
        f.write("-" * 55 + "\n")
        f.write("🧠 RELATÓRIO DE COBERTURA — BrainIAc\n")
        f.write(f"Canal: @{canal_nome_safe}\n")
        f.write("-" * 55 + "\n")
        f.write(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n\n")
        f.write(f"Total mapeado:   {total}\n")
        f.write(f"Extrações OK:    {sucessos} ({(sucessos / total) * 100:.1f}%)\n")
        f.write(f"Falhas/Sem sub:  {falhas} ({(falhas / total) * 100:.1f}%)\n")
        if views_totais > 0:
            f.write(f"Visualizações:   {views_totais:,.0f}\n")
        f.write("-" * 55 + "\n")
        f.write("DETALHAMENTO POR SEÇÃO:\n")
        f.write(stats.to_string() + "\n")
        f.write("-" * 55 + "\n")
        f.write("Gerado por BrainIAc Intelligence Engine\n")

    print(f"      ✅ Relatório gerado: {caminho_relatorio}")
    return caminho_relatorio


def gerar_readme(canal_nome_raw, canal_nome_safe):
    print("\n📄 [GERANDO README ESTRATÉGICO]...")
    caminho_readme = os.path.join(GESTAO_DIR, f'{canal_nome_safe}_README.md')

    conteudo = f"""# 🧠 Base de Conhecimento — @{canal_nome_raw}
*Gerada automaticamente pelo BrainIAc Intelligence Engine*

## O que é este ativo?
Este repositório contém as transcrições limpas e organizadas de todo o conteúdo
público do canal **@{canal_nome_raw}** no YouTube.

## Como usar

### Google NotebookLM (Recomendado)
1. Acesse o [NotebookLM](https://notebooklm.google.com)
2. Crie um novo bloco de notas
3. Importe os arquivos `.txt` da pasta `Cerebro_Docs` no seu Google Drive
4. Faça perguntas diretamente ao conteúdo do canal

### ChatGPT / Claude
Faça upload manual de 2 a 3 arquivos da pasta local `cerebro_txt` e use prompts como:
> *"Com base nos documentos anexos, responda como @{canal_nome_raw}..."*

## Estrutura
```
BrainIAc — {canal_nome_raw}/
├── Cerebro_Docs/          # Documentos Google (prontos para NotebookLM)
└── Gestao_Metadados/      # CSV com índice completo + relatório de cobertura
```

---
*Ativo mantido automaticamente pelo BrainIAc · CriAugu*
"""
    with open(caminho_readme, 'w', encoding='utf-8') as f:
        f.write(conteudo)

    print(f"      ✅ README gerado: {caminho_readme}")
    return caminho_readme


# ==========================================
# --- ENGINE PRINCIPAL ---
# ==========================================

def coletar_meta_canal(canal_url: str, canal_nome_raw: str, prefixo: str) -> dict:
    """Coleta metadados do canal via yt-dlp e salva JSON local."""
    meta = {
        'canal_nome':    canal_nome_raw,
        'canal_handle':  f'@{canal_nome_raw}',
        'canal_url':     canal_url,
        'inscritos':     '',
        'extraido_em':   datetime.now().strftime('%d/%m/%Y'),
    }
    try:
        creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        result = subprocess.run(
            ['yt-dlp', '--flat-playlist', '--playlist-items', '1',
             '--print', '%(channel)s|||%(uploader_id)s|||%(channel_follower_count)s',
             '--js-runtimes', 'node', canal_url],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            encoding='utf-8', errors='replace', creationflags=creationflags, timeout=30
        )
        for linha in result.stdout.strip().splitlines():
            partes = linha.split('|||')
            if len(partes) >= 3:
                if partes[0].strip():
                    meta['canal_nome']   = partes[0].strip()
                if partes[1].strip() and partes[1].strip() != 'NA':
                    meta['canal_handle'] = partes[1].strip()
                    if not meta['canal_handle'].startswith('@'):
                        meta['canal_handle'] = '@' + meta['canal_handle']
                if partes[2].strip() and partes[2].strip() not in ('NA', 'None', ''):
                    try:
                        n = int(partes[2].strip())
                        if n >= 1_000_000:
                            meta['inscritos'] = f'{n/1_000_000:.1f}M'
                        elif n >= 1_000:
                            meta['inscritos'] = f'{n//1_000}K'
                        else:
                            meta['inscritos'] = str(n)
                    except ValueError:
                        pass
                break
    except Exception:
        pass

    meta_path = os.path.join(LOCAL_TXT_DIR, f'{prefixo}_meta.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"      📋 Canal: {meta['canal_nome']} {meta['canal_handle']}"
          + (f" · {meta['inscritos']} inscritos" if meta['inscritos'] else ""))
    return meta


def migrar_cerebro_txt():
    """Migra data/cerebro_txt/ para data/cerebro/youtube/ na primeira execução."""
    import shutil
    old_dir = os.path.join(DATA_DIR, 'cerebro_txt')
    if os.path.exists(old_dir) and not os.path.exists(LOCAL_TXT_DIR):
        os.makedirs(LOCAL_TXT_DIR, exist_ok=True)
        for fname in os.listdir(old_dir):
            shutil.move(os.path.join(old_dir, fname), os.path.join(LOCAL_TXT_DIR, fname))
        print(f"✅ Migração: cerebro_txt/ → cerebro/youtube/ ({len(os.listdir(LOCAL_TXT_DIR))} arquivos)")


def brainiac_engine(canal_url, evento_pausa=None, evento_cancelar=None, fontes_filtro=None):
    canal_nome_raw = extrair_nome_canal(canal_url)
    canal_nome_safe = sanitizar_nome(canal_nome_raw)
    prefixo = canal_nome_safe
    drive_folder_name = f"BrainIAc — {canal_nome_raw}"
    db_file = os.path.join(GESTAO_DIR, f'{prefixo}_base.csv')

    print("\n" + "=" * 70)
    print("🧠 BRAINIAC ENGINE — Intelligence Engine")
    print(f"   Canal: {canal_url}")
    print(f"   Prefixo: {prefixo}")
    print("=" * 70 + "\n")

    for d in [LOCAL_TXT_DIR, DOCUMENTOS_DIR, TEXTOS_DIR, GESTAO_DIR, TEMP_DIR,
              os.path.join(DATA_DIR, 'config')]:
        os.makedirs(d, exist_ok=True)

    migrar_cerebro_txt()

    # --- 0. METADADOS DO CANAL ---
    print("📋 Coletando metadados do canal...")
    meta_canal = coletar_meta_canal(canal_url, canal_nome_raw, prefixo)

    FONTES = gerar_fontes(canal_url)
    if fontes_filtro:
        FONTES = [f for f in FONTES if f['aba'] in fontes_filtro]
        print(f"🎯 Fontes selecionadas: {[f['aba'] for f in FONTES]}\n")

    # --- 1. MAPEAMENTO ---
    all_videos = []
    ids_mapeados = set()

    print("📡 Mapeando conteúdo do canal no YouTube...\n")
    for fonte in FONTES:
        url = fonte['url']
        aba = fonte['aba']
        if fonte['is_playlist']:
            cmd_p = ['yt-dlp', '--flat-playlist', '--get-id', '--get-title', '--ignore-errors', url]
            stdout_p = executar_comando(cmd_p)
            p_lines = [l.strip() for l in stdout_p.split('\n') if l.strip()]
            for i in range(0, len(p_lines), 2):
                if i + 1 < len(p_lines):
                    playlist_id = p_lines[i + 1]
                    if not re.match(r'^[A-Za-z0-9_\-]{10,50}$', playlist_id):
                        continue
                    cmd_v = [
                        'yt-dlp', '--flat-playlist', '--ignore-errors',
                        '--print', '%(id)s|||%(upload_date)s|||%(view_count)s|||%(title)s',
                        f"https://www.youtube.com/playlist?list={playlist_id}"
                    ]
                    stdout_v = executar_comando(cmd_v)
                    for line in stdout_v.split('\n'):
                        parts = line.split('|||')
                        if len(parts) >= 4 and parts[0] not in ids_mapeados:
                            all_videos.append({
                                'id': parts[0], 'date': formatar_data(parts[1]),
                                'views': parts[2], 'title': parts[3],
                                'aba': f"Playlist: {p_lines[i]}"
                            })
                            ids_mapeados.add(parts[0])
        else:
            cmd = [
                'yt-dlp', '--flat-playlist', '--ignore-errors',
                '--print', '%(id)s|||%(upload_date)s|||%(view_count)s|||%(title)s', url
            ]
            stdout = executar_comando(cmd)
            for line in stdout.split('\n'):
                parts = line.split('|||')
                if len(parts) >= 4 and parts[0] not in ids_mapeados:
                    all_videos.append({
                        'id': parts[0], 'date': formatar_data(parts[1]),
                        'views': parts[2], 'title': parts[3],
                        'aba': aba
                    })
                    ids_mapeados.add(parts[0])

    df_full = pd.DataFrame(all_videos)
    total_liquido = len(df_full)
    print(f"✅ {total_liquido} vídeos mapeados no canal.\n")

    # --- 1b. IDIOMAS ---
    sub_langs = detectar_idiomas_canal(all_videos)
    print(f"      📋 Idiomas configurados: {sub_langs}\n")

    # --- 1c. CONEXÃO ANTECIPADA COM DRIVE (sync incremental) ---
    status_drive = get_drive_status()
    service = None
    id_docs = None
    id_meta_drive = None
    partes_sincronizadas = set()

    if status_drive == 'autenticado':
        try:
            print("🔐 Conectando ao Drive para sync incremental...")
            service = get_drive_service(stop_event=evento_cancelar)
            root_id = garantir_pasta_drive(service, drive_folder_name)
            id_docs = garantir_pasta_drive(service, "Cerebro_Docs", root_id)
            id_meta_drive = garantir_pasta_drive(service, "Gestao_Metadados", root_id)
            print("      ✅ Drive conectado. Partes sincronizadas em tempo real.\n")
        except Exception as e:
            print(f"      ⚠️ Drive não disponível agora: {e}. Modo local ativado.\n")
            service = None

    # --- 2. BANCO DE DADOS LOCAL ---
    ids_nos_txts = set()
    arquivos_existentes = [
        f for f in os.listdir(LOCAL_TXT_DIR)
        if f.startswith(f"{prefixo}_Parte_") and f.endswith(".txt")
    ]
    for f_txt in arquivos_existentes:
        try:
            with open(os.path.join(LOCAL_TXT_DIR, f_txt), 'r', encoding='utf-8-sig', errors='ignore') as f:
                encontrados = re.findall(r'LINK: https://www\.youtube\.com/watch\?v=([a-zA-Z0-9_-]+)', f.read())
                ids_nos_txts.update(encontrados)
        except Exception:
            pass

    if os.path.exists(db_file):
        df_db = pd.read_csv(db_file, dtype=str)
        for col in ['Local', 'Status']:
            if col not in df_db.columns:
                df_db[col] = 'Desconhecido' if col == 'Local' else 'Sucesso'
        if 'Playlist' in df_db.columns:
            df_db['Aba'] = df_db['Aba'].fillna("Playlist: " + df_db['Playlist'].astype(str))
            df_db = df_db.drop(columns=['Playlist'])
            df_db.to_csv(db_file, index=False, encoding='utf-8-sig')
    else:
        df_db = pd.DataFrame(columns=['ID', 'Data_Pub', 'Link', 'Titulo', 'Aba', 'Views', 'Local', 'Status', 'Data_Extracao'])

    ids_na_planilha = set(df_db['ID'].dropna().values)
    ids_ja_minerados = set()
    planilha_atualizada = False

    # Auditoria CSV vs TXT
    for idx, row in df_db.iterrows():
        vid = row['ID']
        status = str(row.get('Status', 'Sucesso')).strip() or 'Sucesso'
        if status == 'Sucesso':
            if vid in ids_nos_txts:
                ids_ja_minerados.add(vid)
            else:
                print(f"      ⚠️ Inconsistência: {vid[:8]} no CSV mas não no TXT. Rebaixando status.")
                df_db.at[idx, 'Status'] = 'Arquivo Ausente'
                planilha_atualizada = True
        else:
            ids_ja_minerados.add(vid)

    # Recuperar órfãos (no TXT mas não no CSV)
    novas_linhas = []
    for vid in ids_nos_txts:
        if vid not in ids_na_planilha:
            ids_ja_minerados.add(vid)
            info_rows = df_full[df_full['id'] == vid]
            if not info_rows.empty:
                info = info_rows.iloc[0]
                novas_linhas.append({
                    'ID': vid, 'Data_Pub': info['date'],
                    'Link': f"https://www.youtube.com/watch?v={vid}",
                    'Titulo': info['title'], 'Aba': info['aba'],
                    'Views': info['views'], 'Local': 'Recuperado',
                    'Status': 'Sucesso', 'Data_Extracao': datetime.now().strftime("%Y-%m-%d")
                })
    if novas_linhas:
        df_db = pd.concat([df_db, pd.DataFrame(novas_linhas)], ignore_index=True)
        planilha_atualizada = True

    if planilha_atualizada or not os.path.exists(db_file):
        df_db.to_csv(db_file, index=False, encoding='utf-8-sig')

    # Retomar de onde parou
    parte_atual = 1
    palavras_atuais = 0
    if arquivos_existentes:
        numeros = [
            int(re.search(r'Parte_(\d+)', f).group(1))
            for f in arquivos_existentes if re.search(r'Parte_(\d+)', f)
        ]
        if numeros:
            parte_atual = max(numeros)
            caminho_retomada = os.path.join(LOCAL_TXT_DIR, f"{prefixo}_Parte_{parte_atual}.txt")
            with open(caminho_retomada, 'r', encoding='utf-8-sig', errors='ignore') as f:
                palavras_atuais = len(f.read().split())

    nome_arquivo_base = f"{prefixo}_Parte_{parte_atual}"
    caminho_txt = os.path.join(LOCAL_TXT_DIR, f"{nome_arquivo_base}.txt")

    pendentes = total_liquido - len(ids_ja_minerados)
    print(f"\n🚜 Iniciando extração — {pendentes} vídeos inéditos na fila...\n")

    # --- 3. EXTRAÇÃO LOCAL ---
    for idx, video in df_full.iterrows():
        if evento_cancelar and evento_cancelar.is_set():
            print("\n🛑 Cancelamento recebido. Encerrando extração com segurança...")
            break

        if evento_pausa and not evento_pausa.is_set():
            print("\n⏸️ Motor em pausa. Aguardando retomada...")
            evento_pausa.wait()
            if evento_cancelar and evento_cancelar.is_set():
                print("\n🛑 Cancelamento recebido durante pausa. Abortando...")
                break
            print("\n▶️ Motor retomado!")

        v_id = video['id']
        v_title = video['title']
        v_link = f"https://www.youtube.com/watch?v={v_id}"

        if v_title in ['[Private video]', '[Deleted video]']:
            continue
        if v_id in ids_ja_minerados:
            continue

        print(f"[{idx + 1}/{total_liquido}] 🎬 Extraindo: {v_title[:55]}...")
        try:
            temp_base = f"temp_{v_id}"
            temp_out = os.path.join(TEMP_DIR, temp_base)
            creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)

            # Baixa legendas com caminho absoluto para evitar dependência do cwd.
            # --print não pode ser combinado com --write-auto-subs no yt-dlp 2026+
            # (ativa simulação que suprime escrita de arquivos).
            res_sub = subprocess.run(
                ['yt-dlp', '--skip-download', '--write-auto-subs', '--write-subs',
                 '--sub-langs', sub_langs, '--output', temp_out,
                 '--js-runtimes', 'node', v_link],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                encoding='utf-8', errors='replace', creationflags=creationflags
            )
            if res_sub.returncode != 0 and res_sub.stderr:
                erros = [l for l in res_sub.stderr.splitlines()
                         if 'ERROR' in l or 'WARNING' in l]
                if erros:
                    print(f"      ⚠️ yt-dlp: {erros[-1][:120]}")

            # Busca data + tags numa única chamada para evitar request extra.
            data_real = video['date']
            tags_str  = ''
            result_meta = subprocess.run(
                ['yt-dlp', '--skip-download',
                 '--print', '%(upload_date)s|||%(tags)j|||%(description)s',
                 '--js-runtimes', 'node', v_link],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                encoding='utf-8', errors='replace', creationflags=creationflags
            )
            descricao_str = ''
            for linha in result_meta.stdout.strip().splitlines():
                partes = linha.split('|||')
                data_part = partes[0].strip()
                if re.match(r'^\d{8}$', data_part):
                    data_real = formatar_data(data_part)
                if len(partes) > 1:
                    try:
                        tags_list = json.loads(partes[1].strip())
                        if isinstance(tags_list, list):
                            tags_str = ','.join(str(t).strip() for t in tags_list if t)
                    except Exception:
                        pass
                if len(partes) > 2:
                    desc = partes[2].strip()
                    if desc and desc not in ('NA', 'None', ''):
                        # Limita a 500 chars para não inflar o arquivo
                        descricao_str = desc[:500].replace('\n', ' ').strip()
                break

            vtt_files = [
                os.path.join(TEMP_DIR, f)
                for f in os.listdir(TEMP_DIR)
                if f.startswith(temp_base) and f.endswith('.vtt')
            ]
            if vtt_files:
                texto = limpar_vtt(vtt_files[0])
                if len(texto) > 150:
                    num_palavras = len(texto.split())

                    if palavras_atuais + num_palavras > MAX_WORDS_PER_FILE:
                        # Sync parte completa antes de abrir a próxima
                        if service and id_docs and caminho_txt not in partes_sincronizadas and os.path.exists(caminho_txt):
                            try:
                                print(f"      ☁️ Sincronizando Parte {parte_atual} com o Drive...")
                                upload_txt_como_gdoc_seguro(service, caminho_txt, id_docs)
                                partes_sincronizadas.add(caminho_txt)
                            except Exception as e:
                                print(f"      ⚠️ Sync incremental falhou: {e}")
                        parte_atual += 1
                        palavras_atuais = 0
                        nome_arquivo_base = f"{prefixo}_Parte_{parte_atual}"
                        caminho_txt = os.path.join(LOCAL_TXT_DIR, f"{nome_arquivo_base}.txt")
                        print(f"      📂 NOVO ARQUIVO: Parte {parte_atual} iniciada.")

                    file_is_new = not os.path.exists(caminho_txt)
                    with open(caminho_txt, "a", encoding="utf-8-sig") as f:
                        if file_is_new:
                            handle = meta_canal.get('canal_handle', f'@{canal_nome_raw}')
                            inscritos = meta_canal.get('inscritos', '')
                            f.write(
                                f"# BrainIAc Engine — Base de Conhecimento\n"
                                f"# Canal: {meta_canal.get('canal_nome', canal_nome_raw)} ({handle})\n"
                                f"# URL: {canal_url}\n"
                                + (f"# Inscritos: {inscritos}\n" if inscritos else "")
                                + f"# Extraído em: {meta_canal.get('extraido_em', '')}\n"
                                f"# Todos os direitos do conteúdo pertencem ao criador original.\n"
                                f"{'=' * 70}\n\n"
                            )
                        f.write(
                            f"\n{'=' * 70}\n"
                            f"TITULO: {v_title}\n"
                            f"ABA: {video['aba']}\n"
                            f"DATA: {data_real}\n"
                            f"LINK: {v_link}\n"
                            f"TAGS: {tags_str}\n"
                            f"DESCRICAO: {descricao_str}\n"
                            f"{'-' * 70}\n"
                            f"CONTEUDO:\n{texto}\n"
                            f"{'=' * 70}\n"
                        )

                    palavras_atuais += num_palavras
                    ids_ja_minerados.add(v_id)

                    nova_linha = {
                        'ID': v_id, 'Data_Pub': data_real, 'Link': v_link,
                        'Titulo': v_title, 'Aba': video['aba'], 'Views': video['views'],
                        'Local': nome_arquivo_base, 'Status': 'Sucesso',
                        'Data_Extracao': datetime.now().strftime("%Y-%m-%d")
                    }
                    df_db = pd.concat([df_db, pd.DataFrame([nova_linha])], ignore_index=True)
                    df_db.to_csv(db_file, index=False, encoding='utf-8-sig')
                    print(f"      ✅ OK! ({data_real})")
                else:
                    nova_linha = {
                        'ID': v_id, 'Data_Pub': data_real, 'Link': v_link,
                        'Titulo': v_title, 'Aba': video['aba'], 'Views': video['views'],
                        'Local': 'N/A', 'Status': 'Legenda Curta',
                        'Data_Extracao': datetime.now().strftime("%Y-%m-%d")
                    }
                    df_db = pd.concat([df_db, pd.DataFrame([nova_linha])], ignore_index=True)
                    df_db.to_csv(db_file, index=False, encoding='utf-8-sig')
                    ids_ja_minerados.add(v_id)
                    print(f"      ⚠️ Ignorado: Legenda muito curta.")

                for vf in vtt_files:
                    try:
                        os.remove(vf)
                    except Exception:
                        pass
            else:
                nova_linha = {
                    'ID': v_id, 'Data_Pub': data_real, 'Link': v_link,
                    'Titulo': v_title, 'Aba': video['aba'], 'Views': video['views'],
                    'Local': 'N/A', 'Status': 'Sem Legenda',
                    'Data_Extracao': datetime.now().strftime("%Y-%m-%d")
                }
                df_db = pd.concat([df_db, pd.DataFrame([nova_linha])], ignore_index=True)
                df_db.to_csv(db_file, index=False, encoding='utf-8-sig')
                ids_ja_minerados.add(v_id)
                print(f"      ⚠️ Ignorado: Sem legenda em português.")

            time.sleep(1)

        except Exception as e:
            print(f"      ❌ Erro: {e}")
            nova_linha = {
                'ID': v_id, 'Data_Pub': video['date'], 'Link': v_link,
                'Titulo': v_title, 'Aba': video['aba'], 'Views': video['views'],
                'Local': 'N/A', 'Status': 'Falha Extração',
                'Data_Extracao': datetime.now().strftime("%Y-%m-%d")
            }
            df_db = pd.concat([df_db, pd.DataFrame([nova_linha])], ignore_index=True)
            df_db.to_csv(db_file, index=False, encoding='utf-8-sig')
            ids_ja_minerados.add(v_id)

    # --- 4. FINALIZAÇÃO E SYNC ---
    if service is None:
        if status_drive == 'sem_credenciais':
            print("\n⚠️ [DRIVE PULADO] credentials.json não encontrado na pasta do aplicativo.")
        elif status_drive != 'autenticado':
            print("\n⚠️ [DRIVE PULADO] Google Drive não autenticado.")
        else:
            print("\n⚠️ [DRIVE PULADO] Conexão com Drive falhou durante a execução.")
        print("      📁 Transcrições salvas localmente em: cerebro_txt/")
        print("      📊 Banco de dados salvo em: gestao_local/")
        if not (evento_cancelar and evento_cancelar.is_set()):
            print("\n✅ EXTRAÇÃO LOCAL CONCLUÍDA COM SUCESSO!")
            print("   Autentique o Drive e re-execute para sincronizar na nuvem.")
        return

    try:
        # Sincroniza parte final (e quaisquer partes pendentes por edge case)
        print("\n☁️ [SINCRONIZANDO PARTES FINAIS COM O DRIVE]...")
        for f in sorted(os.listdir(LOCAL_TXT_DIR)):
            if f.endswith(".txt") and f.startswith(prefixo):
                fp = os.path.join(LOCAL_TXT_DIR, f)
                if fp not in partes_sincronizadas:
                    upload_txt_como_gdoc_seguro(service, fp, id_docs)

        print("\n📊 Sincronizando metadados...")
        upload_arquivo_drive(service, db_file, id_meta_drive)

        caminho_rel = gerar_relatorio_checkup(canal_nome_safe, db_file)
        if os.path.exists(caminho_rel):
            upload_arquivo_drive(service, caminho_rel, id_meta_drive)

        caminho_readme = gerar_readme(canal_nome_raw, canal_nome_safe)
        if os.path.exists(caminho_readme):
            upload_arquivo_drive(service, caminho_readme, id_meta_drive)

        if evento_cancelar and evento_cancelar.is_set():
            print("\n⚠️ PROCESSO INTERROMPIDO — Dados parciais salvos no Drive.")
        else:
            print("\n🏆 MISSÃO CUMPRIDA! Base de conhecimento atualizada no Drive.")
            print("\n🚀 PROCESSO BrainIAc FINALIZADO COM SUCESSO!")

    except Exception as e:
        print(f"❌ Erro crítico no ambiente de nuvem: {e}")


if __name__ == "__main__":
    canal = input("URL do canal YouTube (ex: https://www.youtube.com/@Canal): ").strip()
    brainiac_engine(canal)

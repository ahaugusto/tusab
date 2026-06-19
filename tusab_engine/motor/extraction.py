# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
"""
Engine de extração de transcrições do YouTube e geração de base de conhecimento.
"""

import os
import sys
import time
import subprocess
import re
import json
import pandas as pd
from datetime import datetime

from tusab_engine.storage import (
    DATA_DIR, CEREBRO_DIR, LOCAL_TXT_DIR,
    GESTAO_DIR, TEMP_DIR,
    salvar_csv_atomico, salvar_json_atomico,
)
from tusab_engine.motor.drive import (
    get_drive_status, get_drive_service,
    garantir_pasta_drive,
    upload_txt_como_gdoc_seguro, upload_arquivo_drive,
)

MAX_WORDS_PER_FILE = 40000


# ── Helpers de path ───────────────────────────────────────────────────────────

def get_canal_youtube_dir(prefixo: str) -> str:
    """Diretório de transcrições YouTube por canal: data/cerebro/{prefixo}/youtube/"""
    return os.path.join(CEREBRO_DIR, prefixo, 'youtube')


def migrar_canal_para_subdir(prefixo: str):
    """Move arquivos legados de cerebro/youtube/ para cerebro/{prefixo}/youtube/."""
    import shutil
    if not os.path.exists(LOCAL_TXT_DIR):
        return
    nova_dir = get_canal_youtube_dir(prefixo)
    os.makedirs(nova_dir, exist_ok=True)
    migrados = 0
    for fname in os.listdir(LOCAL_TXT_DIR):
        if fname.startswith(prefixo) and not os.path.exists(os.path.join(nova_dir, fname)):
            shutil.move(os.path.join(LOCAL_TXT_DIR, fname), os.path.join(nova_dir, fname))
            migrados += 1
    if migrados:
        print(f"✅ Migração: {migrados} arquivo(s) de '{prefixo}' → cerebro/{prefixo}/youtube/")


def migrar_cerebro_txt():
    """Migra data/cerebro_txt/ para data/cerebro/youtube/ na primeira execução."""
    import shutil
    old_dir = os.path.join(DATA_DIR, 'cerebro_txt')
    if os.path.exists(old_dir) and not os.path.exists(LOCAL_TXT_DIR):
        os.makedirs(LOCAL_TXT_DIR, exist_ok=True)
        for fname in os.listdir(old_dir):
            shutil.move(os.path.join(old_dir, fname), os.path.join(LOCAL_TXT_DIR, fname))
        print(f"✅ Migração: cerebro_txt/ → cerebro/youtube/ ({len(os.listdir(LOCAL_TXT_DIR))} arquivos)")


# ── Utilitários ───────────────────────────────────────────────────────────────

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


# Idiomas em ordem de tentativa. Baixados em duas passagens para evitar 429:
# 1a passagem: pt e pt-BR (cobre 90%+ dos canais BR/PT)
# 2a passagem: en, es -- só se a 1a nao gerou nenhum VTT
_SUB_LANGS_PRIMARY   = 'pt,pt-BR'
_SUB_LANGS_FALLBACK  = 'en,es'

# Timeout padrão para qualquer chamada yt-dlp (segundos).
# Mapeamento de canal grande pode levar mais — executar_comando não usa timeout
# pois aguarda stdout completo; as chamadas pontuais usam _YTDLP_TIMEOUT.
_YTDLP_TIMEOUT = 60


def _resolve_cmd(cmd):
    """Garante que yt-dlp seja sempre invocado via sys.executable -m yt_dlp.

    Necessário em qualquer ambiente Windows com venv: o wrapper yt-dlp.exe
    falha silenciosamente quando o PATH não está configurado corretamente
    (Electron packaged, ambientes CI, primeiro uso). Usando sys.executable
    o módulo correto do venv é sempre encontrado.
    """
    if cmd and cmd[0] == 'yt-dlp':
        return [sys.executable, '-m', 'yt_dlp'] + cmd[1:]
    return cmd


def _ytdlp_run(args, timeout=_YTDLP_TIMEOUT, capture_stderr=False):
    """Wrapper único para todas as chamadas yt-dlp.

    Sempre usa _resolve_cmd. Retorna (stdout, stderr, returncode).
    Nunca lança exceção — falhas são retornadas como strings vazias.
    """
    creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    try:
        r = subprocess.run(
            _resolve_cmd(['yt-dlp'] + args),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE if capture_stderr else subprocess.DEVNULL,
            encoding='utf-8', errors='replace',
            check=False, creationflags=creationflags,
            timeout=timeout,
        )
        return r.stdout, (r.stderr if capture_stderr else ''), r.returncode
    except subprocess.TimeoutExpired:
        return '', f'yt-dlp timeout após {timeout}s', 1
    except Exception as e:
        return '', str(e), 1


def executar_comando(cmd, timeout=None):
    """Executa comando yt-dlp via _ytdlp_run e retorna stdout.

    Sem timeout por padrão — usado para mapeamento de canais grandes onde
    o yt-dlp precisa varrer todas as páginas antes de retornar.
    """
    creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    kw = dict(capture_output=True, text=False, check=False, creationflags=creationflags)
    if timeout:
        kw['timeout'] = timeout
    try:
        result = subprocess.run(_resolve_cmd(cmd), **kw)
        return result.stdout.decode('utf-8', errors='replace')
    except subprocess.TimeoutExpired:
        return ''
    except Exception:
        return ''


def _ytdlp_update():
    """Atualiza yt-dlp para a versão mais recente via pip se houver nova versão.

    Chamado uma vez na inicialização do motor. Falha silenciosa — nunca
    bloqueia a extração se não houver internet ou permissão.
    """
    try:
        stdout, _, rc = _ytdlp_run(['--version'], timeout=10)
        versao_atual = stdout.strip()
        if not versao_atual:
            return
        r = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '--upgrade', '--quiet', 'yt-dlp'],
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode == 0:
            stdout2, _, _ = _ytdlp_run(['--version'], timeout=10)
            versao_nova = stdout2.strip()
            if versao_nova and versao_nova != versao_atual:
                print(f"      🔄 yt-dlp atualizado: {versao_atual} → {versao_nova}\n")
    except Exception:
        pass


def detectar_idiomas_canal(_all_videos):
    """Retorna par (primary, fallback) de idiomas para busca de legendas.

    Estratégia de duas passagens para evitar 429:
    - Primária: pt,pt-BR (cobre 90%+ dos canais BR/PT, uma única request)
    - Fallback: en,es (só tentado se a primária não gerou nenhum VTT)
    """
    return _SUB_LANGS_PRIMARY, _SUB_LANGS_FALLBACK


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


# ── Relatório e README ────────────────────────────────────────────────────────

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
        f.write("🧠 RELATÓRIO DE COBERTURA — Tusab\n")
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
        f.write("Gerado por Tusab — Index.Augment.Converse\n")

    print(f"      ✅ Relatório gerado: {caminho_relatorio}")
    return caminho_relatorio


def gerar_readme(canal_nome_raw, canal_nome_safe):
    print("\n📄 [GERANDO README ESTRATÉGICO]...")
    caminho_readme = os.path.join(GESTAO_DIR, f'{canal_nome_safe}_README.md')

    conteudo = f"""# 🧠 Base de Conhecimento — @{canal_nome_raw}
*Gerada automaticamente pelo Tusab — Index.Augment.Converse*

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
Tusab — {canal_nome_raw}/
├── Cerebro_Docs/          # Documentos Google (prontos para NotebookLM)
└── Gestao_Metadados/      # CSV com índice completo + relatório de cobertura
```

---
*Ativo mantido automaticamente pelo Tusab · CriAugu*
"""
    with open(caminho_readme, 'w', encoding='utf-8') as f:
        f.write(conteudo)

    print(f"      ✅ README gerado: {caminho_readme}")
    return caminho_readme


# ── Metadados do canal ────────────────────────────────────────────────────────

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
            _resolve_cmd(['yt-dlp', '--flat-playlist', '--playlist-items', '1',
             '--print', '%(channel)s|||%(uploader_id)s|||%(channel_follower_count)s',
             '--js-runtimes', 'node', canal_url]),
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

    canal_yt_dir = get_canal_youtube_dir(prefixo)
    os.makedirs(canal_yt_dir, exist_ok=True)
    meta_path = os.path.join(canal_yt_dir, f'{prefixo}_meta.json')
    salvar_json_atomico(meta, meta_path, indent=2)

    print(f"      📋 Canal: {meta['canal_nome']} {meta['canal_handle']}"
          + (f" · {meta['inscritos']} inscritos" if meta['inscritos'] else ""))
    return meta


# ── Engine principal ──────────────────────────────────────────────────────────

def tusab_engine(canal_url, evento_pausa=None, evento_cancelar=None, fontes_filtro=None):
    canal_nome_raw = extrair_nome_canal(canal_url)
    canal_nome_safe = sanitizar_nome(canal_nome_raw)
    prefixo = canal_nome_safe
    canal_youtube_dir = get_canal_youtube_dir(prefixo)
    drive_folder_name = f"Tusab — {canal_nome_raw}"
    db_file = os.path.join(GESTAO_DIR, f'{prefixo}_base.csv')

    _ytdlp_update()

    print("\n" + "=" * 70)
    print("🧠 Tusab — Indexe. Aprenda. Consulte.")
    print(f"   Canal: {canal_url}")
    print(f"   Prefixo: {prefixo}")
    print("=" * 70 + "\n")

    _obs_start_time = time.time()
    _obs_ram_samples = []
    _obs_peak_ram_mb = 0.0
    try:
        import psutil as _psutil
        _obs_proc = _psutil.Process(os.getpid())
        def _obs_ram_mb():
            try: return _obs_proc.memory_info().rss / 1024 / 1024
            except: return 0.0
    except ImportError:
        _obs_proc = None
        def _obs_ram_mb(): return 0.0

    def _obs_get_stat(key):
        try:
            from tusab_engine.state import state as _s
            return _s.stats.get(key, 0)
        except Exception:
            return 0

    _obs_ram_samples.append(_obs_ram_mb())  # amostra inicial

    for d in [canal_youtube_dir, GESTAO_DIR, TEMP_DIR, os.path.join(DATA_DIR, 'config')]:
        os.makedirs(d, exist_ok=True)

    migrar_cerebro_txt()
    migrar_canal_para_subdir(prefixo)

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
    titulos_mapeados = set()  # fallback de dedup quando upload_date = NA

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
                        if len(parts) >= 4:
                            vid, titulo = parts[0], parts[3].strip()
                            if vid in ids_mapeados:
                                continue
                            if parts[1].strip() == 'NA' and titulo and titulo in titulos_mapeados:
                                continue
                            all_videos.append({
                                'id': vid, 'date': formatar_data(parts[1]),
                                'views': parts[2], 'title': titulo,
                                'aba': f"Playlist: {p_lines[i]}"
                            })
                            ids_mapeados.add(vid)
                            if titulo:
                                titulos_mapeados.add(titulo)
        else:
            cmd = [
                'yt-dlp', '--flat-playlist', '--ignore-errors',
                '--print', '%(id)s|||%(upload_date)s|||%(view_count)s|||%(title)s', url
            ]
            stdout = executar_comando(cmd)
            novos_fonte = 0
            for line in stdout.split('\n'):
                parts = line.split('|||')
                if len(parts) >= 4:
                    vid, titulo = parts[0], parts[3].strip()
                    if vid in ids_mapeados:
                        continue
                    if parts[1].strip() == 'NA' and titulo and titulo in titulos_mapeados:
                        continue
                    all_videos.append({
                        'id': vid, 'date': formatar_data(parts[1]),
                        'views': parts[2], 'title': titulo,
                        'aba': aba
                    })
                    ids_mapeados.add(vid)
                    if titulo:
                        titulos_mapeados.add(titulo)
                    novos_fonte += 1
            if novos_fonte > 0:
                print(f"   📋 {aba}: {novos_fonte} vídeos mapeados ({len(all_videos)} no total)\n")

    df_full = pd.DataFrame(all_videos)
    total_liquido = len(df_full)
    print(f"✅ {total_liquido} vídeos mapeados no canal.\n")

    # Persiste total mapeado para cálculo correto de cobertura no relatório
    summary_path = os.path.join(GESTAO_DIR, f'{prefixo}_summary.json')
    os.makedirs(GESTAO_DIR, exist_ok=True)
    existing_summary = {}
    if os.path.exists(summary_path):
        try:
            with open(summary_path, 'r', encoding='utf-8') as _f:
                existing_summary = json.load(_f)
        except Exception:
            pass
    existing_summary['total_mapeado'] = total_liquido
    salvar_json_atomico(existing_summary, summary_path)

    # --- 1b. IDIOMAS ---
    sub_langs_primary, sub_langs_fallback = detectar_idiomas_canal(all_videos)
    print(f"      📋 Idiomas: primário={sub_langs_primary} | fallback={sub_langs_fallback}\n")

    # --- 1c. VERIFICAÇÃO DE DRIVE (conexão adiada para após extração local) ---
    status_drive = get_drive_status()

    # --- 2. BANCO DE DADOS LOCAL ---
    ids_nos_txts = set()
    arquivos_existentes = [
        f for f in os.listdir(canal_youtube_dir)
        if f.startswith(f"{prefixo}_Parte_") and f.endswith(".txt")
    ]
    for f_txt in arquivos_existentes:
        try:
            with open(os.path.join(canal_youtube_dir, f_txt), 'r', encoding='utf-8-sig', errors='ignore') as f:
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
            salvar_csv_atomico(df_db, db_file)
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
        salvar_csv_atomico(df_db, db_file)

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
            caminho_retomada = os.path.join(canal_youtube_dir, f"{prefixo}_Parte_{parte_atual}.txt")
            with open(caminho_retomada, 'r', encoding='utf-8-sig', errors='ignore') as f:
                palavras_atuais = len(f.read().split())

    nome_arquivo_base = f"{prefixo}_Parte_{parte_atual}"
    caminho_txt = os.path.join(canal_youtube_dir, f"{nome_arquivo_base}.txt")

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

            def _has_vtt():
                return any(
                    f.startswith(temp_base) and f.endswith('.vtt')
                    for f in os.listdir(TEMP_DIR)
                )

            def _sub_cmd(langs):
                # skip=translated_subs: nao tenta traducoes automaticas de outros
                # idiomas (fonte principal dos 429 em canais BR tentando 'en').
                # sleep-requests 1: pausa minima entre requests para evitar throttle.
                return ['--skip-download', '--write-auto-subs', '--write-subs',
                        '--sub-langs', langs, '--output', temp_out,
                        '--extractor-args', 'youtube:skip=translated_subs',
                        '--sleep-requests', '1',
                        '--js-runtimes', 'node', v_link]

            # Passagem 1: pt,pt-BR — cobre canais brasileiros e portugueses.
            _, sub_err, sub_rc = _ytdlp_run(_sub_cmd(sub_langs_primary), capture_stderr=True)
            if sub_rc != 0 and sub_err:
                erros = [l for l in sub_err.splitlines() if 'ERROR' in l and '429' not in l]
                if erros:
                    print(f"      ⚠️ yt-dlp (primário): {erros[-1][:120]}")

            # Passagem 2: en,es — só se a primária não gerou nenhum VTT.
            if not _has_vtt():
                _, sub_err2, sub_rc2 = _ytdlp_run(_sub_cmd(sub_langs_fallback), capture_stderr=True)
                if sub_rc2 != 0 and sub_err2:
                    erros2 = [l for l in sub_err2.splitlines() if 'ERROR' in l and '429' not in l]
                    if erros2:
                        print(f"      ⚠️ yt-dlp (fallback): {erros2[-1][:120]}")

            # Busca data + tags numa única chamada para evitar request extra.
            data_real = video['date']
            tags_str  = ''
            meta_stdout, _, _ = _ytdlp_run(
                ['--skip-download',
                 '--print', '%(upload_date)s|||%(tags)j|||%(description)s',
                 '--js-runtimes', 'node', v_link],
            )
            descricao_str = ''
            for linha in meta_stdout.strip().splitlines():
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
                        parte_atual += 1
                        palavras_atuais = 0
                        nome_arquivo_base = f"{prefixo}_Parte_{parte_atual}"
                        caminho_txt = os.path.join(canal_youtube_dir, f"{nome_arquivo_base}.txt")
                        print(f"      📂 NOVO ARQUIVO: Parte {parte_atual} iniciada.")

                    file_is_new = not os.path.exists(caminho_txt)
                    with open(caminho_txt, "a", encoding="utf-8-sig") as f:
                        if file_is_new:
                            handle = meta_canal.get('canal_handle', f'@{canal_nome_raw}')
                            inscritos = meta_canal.get('inscritos', '')
                            f.write(
                                f"# Tusab — Base de Conhecimento\n"
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
                    salvar_csv_atomico(df_db, db_file)
                    print(f"      ✅ OK! ({data_real})")
                else:
                    nova_linha = {
                        'ID': v_id, 'Data_Pub': data_real, 'Link': v_link,
                        'Titulo': v_title, 'Aba': video['aba'], 'Views': video['views'],
                        'Local': 'N/A', 'Status': 'Legenda Curta',
                        'Data_Extracao': datetime.now().strftime("%Y-%m-%d")
                    }
                    df_db = pd.concat([df_db, pd.DataFrame([nova_linha])], ignore_index=True)
                    salvar_csv_atomico(df_db, db_file)
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
                salvar_csv_atomico(df_db, db_file)
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
            salvar_csv_atomico(df_db, db_file)
            ids_ja_minerados.add(v_id)

    # --- 4. FINALIZAÇÃO LOCAL ---
    print("      📁 Transcrições salvas localmente.")
    print("      📊 Banco de dados salvo em: gestao_local/")

    # ── Relatório de observabilidade ─────────────────────────────────────────
    def _salvar_relatorio_obs(status_final):
        try:
            import platform
            elapsed = time.time() - _obs_start_time
            ram_final = _obs_ram_mb()
            peak_ram = max(_obs_ram_samples + [ram_final]) if _obs_ram_samples else ram_final
            from tusab_engine.storage import GESTAO_DIR as _GDIR
            obs_path = os.path.join(_GDIR, f"{prefixo}_obs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
            payload = {
                "tusab_version": "1.0.0",
                "canal": canal_url,
                "prefixo": prefixo,
                "data_inicio": datetime.fromtimestamp(_obs_start_time).isoformat(),
                "data_fim": datetime.now().isoformat(),
                "duracao_segundos": round(elapsed, 1),
                "status_final": status_final,
                "videos_total": _obs_get_stat("videos_total"),
                "videos_processados": _obs_get_stat("videos_processed"),
                "videos_sem_legenda": _obs_get_stat("videos_sem_legenda"),
                "arquivos_gerados": _obs_get_stat("files_generated"),
                "ram_inicio_mb": _obs_ram_samples[0] if _obs_ram_samples else 0,
                "ram_final_mb": round(ram_final, 1),
                "ram_pico_mb": round(peak_ram, 1),
                "amostras_ram": len(_obs_ram_samples),
                "plataforma": platform.platform(),
                "python": platform.python_version(),
            }
            with open(obs_path, 'w', encoding='utf-8') as _f:
                json.dump(payload, _f, ensure_ascii=False, indent=2)
            print(f"📈 Relatório de observabilidade salvo: {os.path.basename(obs_path)}")
        except Exception as _e:
            print(f"⚠️ Não foi possível salvar relatório de observabilidade: {_e}")

    if evento_cancelar and evento_cancelar.is_set():
        _obs_ram_samples.append(_obs_ram_mb())
        _salvar_relatorio_obs("interrompido")
        print("\n⚠️ PROCESSO INTERROMPIDO — Dados parciais salvos localmente.")
        return

    _obs_ram_samples.append(_obs_ram_mb())
    print("\n✅ EXTRAÇÃO LOCAL CONCLUÍDA COM SUCESSO!")

    # --- 5. SYNC COM DRIVE (opcional, após extração completa) ---
    if status_drive != 'autenticado':
        if status_drive == 'sem_credenciais':
            print("\n⚠️ [DRIVE PULADO] credentials.json não encontrado.")
        else:
            print("\n⚠️ [DRIVE PULADO] Google Drive não autenticado.")
        print("   Autentique o Drive e re-execute para sincronizar na nuvem.")
        _salvar_relatorio_obs("concluido_sem_drive")
        print("\n🚀 PROCESSO Tusab FINALIZADO COM SUCESSO!")
        return

    try:
        print("\n🔐 Conectando ao Drive...")
        service = get_drive_service(stop_event=evento_cancelar)
        root_id = garantir_pasta_drive(service, drive_folder_name)
        id_docs = garantir_pasta_drive(service, "Cerebro_Docs", root_id)
        id_meta_drive = garantir_pasta_drive(service, "Gestao_Metadados", root_id)

        print("\n☁️ [SINCRONIZANDO COM O DRIVE]...")
        for f in sorted(os.listdir(canal_youtube_dir)):
            if f.endswith(".txt") and f.startswith(prefixo):
                upload_txt_como_gdoc_seguro(service, os.path.join(canal_youtube_dir, f), id_docs)

        print("\n📊 Sincronizando metadados...")
        upload_arquivo_drive(service, db_file, id_meta_drive)

        caminho_rel = gerar_relatorio_checkup(canal_nome_safe, db_file)
        if os.path.exists(caminho_rel):
            upload_arquivo_drive(service, caminho_rel, id_meta_drive)

        caminho_readme = gerar_readme(canal_nome_raw, canal_nome_safe)
        if os.path.exists(caminho_readme):
            upload_arquivo_drive(service, caminho_readme, id_meta_drive)

        print("\n🏆 MISSÃO CUMPRIDA! Base de conhecimento atualizada no Drive.")
        _salvar_relatorio_obs("concluido_com_drive")
        print("\n🚀 PROCESSO Tusab FINALIZADO COM SUCESSO!")

    except Exception as e:
        print(f"\n⚠️ Sync com Drive falhou: {e}")
        print("   Dados estão salvos localmente. Re-execute para tentar sincronizar.")
        _salvar_relatorio_obs("concluido_drive_falhou")
        print("\n🚀 PROCESSO Tusab FINALIZADO COM SUCESSO!")

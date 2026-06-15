import os
import re
import pandas as pd
from datetime import datetime
import yt_dlp
import requests
import platform

class SebaytEngine:
    def __init__(self, log_callback=None):
        """
        log_callback: Função para injetar logs em tempo real na UI.
        """
        self.log = log_callback if log_callback else print
        self.local_txt_dir = 'brainiac_txt'
        self.gestao_dir = 'brainiac_mgmt'
        self.db_file = os.path.join(self.gestao_dir, 'brainiac_knowledge_base.csv')
        self.max_words_per_file = 40000 
        self.versao_motor = "1.0.0" # Versão atual para telemetria
        
        for d in [self.local_txt_dir, self.gestao_dir]:
            os.makedirs(d, exist_ok=True)

    def notificar_falha_forms(self, erro_detalhado, video_url):
        self.log("⚠️ [TELEMETRIA] Falha na extração. Transmitindo log silencioso à central...")
        
        # Endpoint oficial de submissão do seu formulário
        url_form = "https://docs.google.com/forms/d/e/1FAIpQLSfvqaLhwIJDr9tS2OzTYNFks4kL6tJedS6dilMMjz3TTs7rvg/formResponse"
        
        dados = {
            "entry.1081816464": video_url,                           
            "entry.430862417": str(erro_detalhado),                  
            "entry.964363702": platform.platform(),                  
            "entry.1647234290": f"Brain-IAC v{self.versao_motor}"    
        }
        
        try:
            requests.post(url_form, data=dados, timeout=5)
            self.log("📡 [TELEMETRIA] Relatório de engenharia recebido na base com sucesso.")
        except Exception as e:
            self.log(f"🔇 [TELEMETRIA] Falha de rede ao enviar relatório silencioso: {e}")

    # --- LÓGICA RESTAURADA: Formatação Amigável de Data ---
    def formatar_data(self, data_str):
        if not data_str or data_str == 'NA': return "Desconhecida"
        try: 
            return datetime.strptime(str(data_str), '%Y%m%d').strftime('%d/%m/%Y')
        except: 
            return str(data_str)

    # --- NOVA LÓGICA: Varredura Recursiva de Abas ---
    def _extrair_videos_recursivo(self, entries, videos_list, ids_set):
        """ Navega recursivamente pelas abas do canal (Videos, Shorts, Lives) para capturar a base inteira. """
        for entry in entries:
            if not entry: continue
            
            # Se a entrada for uma playlist ou aba (o Youtube organiza canais como coleções de playlists)
            if entry.get('_type') in ['playlist', 'multi_video'] or 'entries' in entry:
                sub_entries = entry.get('entries', [])
                self._extrair_videos_recursivo(sub_entries, videos_list, ids_set)
            else:
                v_id = entry.get('id')
                if v_id and v_id not in ids_set:
                    title = entry.get('title', '')
                    if title not in ['[Private video]', '[Deleted video]', None]:
                        videos_list.append({
                            'id': v_id,
                            'date': self.formatar_data(entry.get('upload_date')),
                            'views': entry.get('view_count', 0),
                            'title': title
                        })
                        ids_set.add(v_id)

    def mapear_canal(self, canal_url):
        self.log(f"📡 [SCAN] Iniciando varredura profunda no alvo: {canal_url}")
        self.log("⏳ Mapeando matriz de playlists e abas do canal...")
        
        ydl_opts = {
            'extract_flat': True,
            'quiet': True,
            'ignoreerrors': True,
            'no_warnings': True
        }
        
        videos = []
        ids_mapeados = set()
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(canal_url, download=False)
                entries = info.get('entries', []) if 'entries' in info else [info]
                
                # Inicia a escavação profunda na hierarquia do canal
                self._extrair_videos_recursivo(entries, videos, ids_mapeados)
                
            except Exception as e:
                self.log(f"❌ [ERRO DE MAPEAMENTO] Não foi possível ler a URL: {e}")
                
        self.log(f"✅ [SCAN CONCLUÍDO] {len(videos)} ativos identificados.")
        return videos

    def limpar_vtt(self, caminho_vtt):
        if not os.path.exists(caminho_vtt): return ""
        with open(caminho_vtt, 'r', encoding='utf-8', errors='replace') as f:
            linhas = f.readlines()
        texto_limpo = []
        for linha in linhas:
            if '-->' not in linha and not linha.strip().isdigit() and 'WEBVTT' not in linha:
                linha = re.sub(r'<[^>]*>', '', linha)
                if linha.strip(): texto_limpo.append(linha.strip())
        resultado = []
        if texto_limpo:
            resultado.append(texto_limpo[0])
            for i in range(1, len(texto_limpo)):
                if texto_limpo[i] != texto_limpo[i-1]:
                    resultado.append(texto_limpo[i])
        return " ".join(resultado).strip()

    def iniciar_extracao(self, videos):
        self.log("\n" + "="*50)
        self.log("🚀 [MOTOR LIGADO] Iniciando pipeline de processamento RAG")
        self.log("="*50 + "\n")

        # Gestão de Estado DB
        if os.path.exists(self.db_file):
            df_db = pd.read_csv(self.db_file, dtype=str)
            ids_ja_minerados = set(df_db['ID'].values)
        else:
            df_db = pd.DataFrame(columns=['ID', 'Data_Pub', 'Link', 'Titulo', 'Views', 'Local', 'Status'])
            ids_ja_minerados = set()

        # --- LÓGICA RESTAURADA: Memória de Chunking (Resgate de Estado) ---
        parte_atual = 1
        palavras_atuais = 0
        arquivos_txt = [f for f in os.listdir(self.local_txt_dir) if f.startswith("Brain_Parte_") and f.endswith(".txt")]
        
        if arquivos_txt:
            numeros = [int(re.search(r'Parte_(\d+)', f).group(1)) for f in arquivos_txt if re.search(r'Parte_(\d+)', f)]
            if numeros:
                parte_atual = max(numeros)
                # Conta quantas palavras já existem no arquivo atual para não estourar o limite
                with open(os.path.join(self.local_txt_dir, f"Brain_Parte_{parte_atual}.txt"), 'r', encoding='utf-8-sig', errors='ignore') as f:
                    palavras_atuais = len(f.read().split())

        nome_arquivo_base = f"Brain_Parte_{parte_atual}"
        caminho_txt = os.path.join(self.local_txt_dir, f"{nome_arquivo_base}.txt")

        total = len(videos)
        sucessos = 0

        for idx, video in enumerate(videos):
            v_id, v_title = video['id'], video['title']
            v_link = f"https://www.youtube.com/watch?v={v_id}"

            if v_id in ids_ja_minerados:
                self.log(f"⏭️ [{idx+1}/{total}] Skip (Já mapeado): {v_title[:30]}...")
                continue 

            self.log(f"⚙️ [{idx+1}/{total}] Extraindo: {v_title[:40]}...")
            
            temp_out = f"temp_{v_id}"
            
            ydl_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['pt'],
                'outtmpl': temp_out,
                'quiet': True,
                'no_warnings': True,
                'ignoreerrors': True
            }

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([v_link])
                
                vtt_files = [f for f in os.listdir('.') if f.startswith(temp_out) and (f.endswith('.vtt') or f.endswith('.ttml'))]
                
                if vtt_files:
                    texto = self.limpar_vtt(vtt_files[0])
                    if len(texto) > 150:
                        num_palavras = len(texto.split())
                        
                        if palavras_atuais + num_palavras > self.max_words_per_file:
                            parte_atual += 1
                            palavras_atuais = 0
                            nome_arquivo_base = f"Brain_Parte_{parte_atual}"
                            caminho_txt = os.path.join(self.local_txt_dir, f"{nome_arquivo_base}.txt")
                            self.log(f"   📂 [NOVO BLOCO] Limite de tokens atingido. Criando {nome_arquivo_base}.txt")

                        with open(caminho_txt, "a", encoding="utf-8-sig") as f:
                            f.write(f"\n{'='*70}\nTITULO: {v_title}\nDATA: {video['date']}\nLINK: {v_link}\n{'-'*70}\nCONTEÚDO:\n{texto}\n{'='*70}\n")
                        
                        palavras_atuais += num_palavras
                        ids_ja_minerados.add(v_id)
                        
                        nova_linha = {
                            'ID': v_id, 'Data_Pub': video['date'], 'Link': v_link, 
                            'Titulo': v_title, 'Views': video['views'], 
                            'Local': nome_arquivo_base, 'Status': 'Sucesso'
                        }
                        df_db = pd.concat([df_db, pd.DataFrame([nova_linha])], ignore_index=True)
                        df_db.to_csv(self.db_file, index=False, encoding='utf-8-sig')
                        self.log(f"   ✅ [SUCESSO] Dados salvos no bloco vetorial local.")
                        sucessos += 1
                        
                    for f in vtt_files: 
                        os.remove(f)
                else:
                    self.log(f"   ⚠️ [ALERTA] Nenhuma legenda (sub/cc) encontrada para este vídeo.")
                    
            except Exception as e:
                erro_str = str(e)
                self.log(f"   ❌ [FALHA CRÍTICA] Erro na requisição: {erro_str}")
                
                erros_criticos = ["Sign in to confirm", "HTTP Error 403", "Unable to download API page", "Video unavailable"]
                if any(alerta in erro_str for alerta in erros_criticos):
                    self.notificar_falha_forms(erro_str, v_link)

        self.log("\n" + "="*50)
        self.log(f"🏁 [PROCESSO FINALIZADO] {sucessos} novos ativos indexados.")
        self.log(f"📂 Diretório de Saída: {os.path.abspath(self.local_txt_dir)}")
        self.log("="*50 + "\n")
        return os.path.abspath(self.local_txt_dir)
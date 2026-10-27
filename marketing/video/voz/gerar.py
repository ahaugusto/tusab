# Gera a narração (Piper, local) trecho a trecho e mixa no vídeo. Uso: python gerar.py
import subprocess, json, os, sys
D = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(D, '.venv', 'Scripts', 'python.exe')
MODEL = os.path.join(D, 'pt_BR-faber-medium.onnx')
VIDEO = os.path.join(D, '..', 'saida', 'tusab-divulgacao-1080p.mp4')
OUT = os.path.join(D, '..', 'saida', 'tusab-divulgacao-1080p-narrado.mp4')
# (início s, texto) — "Túsabe" é só a grafia fonética enviada à voz
S = [
 (0.3, "Vídeos. PDFs. Leis. Artigos. Planilhas. Tudo guardado, e nada encontrado. E se tudo isso respondesse às suas perguntas?"),
 (8.4, "Este é o Túsabe. A sua base de conhecimento com inteligência artificial, no seu computador."),
 (13.5, "Escolha como começar."),
 (15.4, "Cole o link de um canal do YouTube, e as transcrições viram uma base pesquisável."),
 (22.6, "Ou busque em fontes públicas: sem cadastro e sem chave."),
 (28.6, "Setenta fontes, em onze áreas do conhecimento."),
 (31.8, "Teses, artigos, acervos. Marque quantas fontes quiser e filtre por país, tipo e instituição."),
 (46.6, "O Túsabe busca, baixa e indexa tudo sozinho. Em instantes, a sua base está pronta."),
 (53.6, "E tem mais de quarenta portais de dados abertos do governo. Escolha estados, órgãos ou países, e veja a lista de arquivos de cada conjunto de dados."),
 (72.9, "Jurisprudência do STF, do TCU e do TST, com o inteiro teor e sem dados pessoais das partes."),
 (79.0, "Agora é só perguntar, em linguagem natural. Cada resposta vem com a fonte, para você conferir de onde veio."),
 (99.0, "Precisa organizar? Peça uma tabela. E baixe como planilha, pronta para usar."),
 (116.4, "Tudo roda no seu computador. Os seus dados não saem dele."),
 (121.0, "Para estudantes, professores, pesquisadores e especialistas."),
 (125.8, "Baixe o Túsabe para Windows e macOS. Comece agora."),
]
dur = lambda f: float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
total = dur(VIDEO); ok = True; wavs = []
for i,(t,txt) in enumerate(S):
    w = os.path.join(D, f'seg{i:02d}.wav')
    subprocess.run([PY,'-m','piper','-m',MODEL,'--length-scale','0.95','-f',w], input=txt.encode('utf-8'), check=True, capture_output=True)
    d = dur(w); fim = t + d; prox = S[i+1][0] if i+1 < len(S) else total
    flag = 'OK' if fim <= prox - 0.1 else 'ESTOURA'
    if flag != 'OK': ok = False
    print(f'{i:02d} {t:6.1f} → {fim:6.1f}  (próx {prox:6.1f})  {flag}')
    wavs.append((w, t))
args = ['ffmpeg','-y','-v','error','-i',VIDEO]
for w,_ in wavs: args += ['-i', w]
f = ''.join(f'[{i+1}:a]adelay={int(t*1000)}|{int(t*1000)},volume=1.6[a{i}];' for i,(w,t) in enumerate(wavs))
f += ''.join(f'[a{i}]' for i in range(len(wavs))) + f'amix=inputs={len(wavs)}:normalize=0,alimiter=limit=0.95[a]'
args += ['-filter_complex', f, '-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',f'{total:.2f}',OUT]
subprocess.run(args, check=True)
print('OK' if ok else 'HÁ TRECHOS QUE ESTOURAM', '→', os.path.normpath(OUT))

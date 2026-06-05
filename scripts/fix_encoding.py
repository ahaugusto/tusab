"""
fix_encoding.py — Corrige arquivos .txt com caracteres corrompidos (CP1252 lido como UTF-8).

Uso: python scripts/fix_encoding.py

Funciona em dois passos por arquivo:
1. Lê o conteúdo como bytes brutos
2. Tenta decodificar como latin-1 (que nunca falha) e re-encodar como UTF-8,
   detectando se o texto estava corrompido pela leitura CP1252 do Windows.
"""

import os
import sys
import re
import shutil

# Resolve o caminho dos dados igual ao motor
def obter_dir():
    if os.environ.get('BRAINIAC_DATA_DIR'):
        return os.environ['BRAINIAC_DATA_DIR']
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_DIR    = os.path.join(obter_dir(), 'data')
TXT_DIR     = os.path.join(DATA_DIR, 'cerebro_txt')
BACKUP_DIR  = os.path.join(DATA_DIR, 'cerebro_txt_backup')


def detectar_corrupcao(texto: str) -> bool:
    """Heurística: texto corrompido tem sequências típicas de CP1252→UTF-8 mal interpretado."""
    padroes = [
        r'Ã[§¡¢£¤¥¦©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]',
        r'[âãäåæç][€‚ƒ„…†‡ˆ‰Š‹ŒŽ''""•–—˜™š›œžŸ¡¢£¤¥¦§¨©ª«¬\xad®¯°±²³´µ¶·¸¹º»¼½¾¿]',
        'Ã§',   # ç
        'Ã£',   # ã
        'Ã©',   # é
        'Ã¡',   # á
        'Ã³',   # ó
        'Ãº',   # ú
        'Ã­',   # í
        'Ã‡',   # Ç
        'Ã‰',   # É
        'Ã',    # Ã genérico
        'â\x80\x99',  # '
        'â\x80\x9c',  # "
        'â\x80\x9d',  # "
        'â\x86\x92',  # →
        'Ã£o',  # ão
    ]
    return any(p in texto for p in padroes)


def tentar_corrigir(conteudo_bytes: bytes) -> str | None:
    """
    Tenta interpretar bytes que foram incorretamente lidos como CP1252
    e re-encodados em UTF-8, revertendo para o texto original.
    """
    # Estratégia 1: bytes são UTF-8 válido → sem corrupção
    try:
        texto = conteudo_bytes.decode('utf-8')
        if not detectar_corrupcao(texto):
            return texto  # já está correto
    except UnicodeDecodeError:
        pass

    # Estratégia 2: bytes estão em UTF-8 mas com sequências corrompidas
    # (gravados como latin-1 de um texto que foi lido com CP1252)
    try:
        texto_latin = conteudo_bytes.decode('latin-1')
        # Re-encodar em latin-1 e decodificar como UTF-8
        texto_corrigido = texto_latin.encode('latin-1').decode('utf-8', errors='replace')
        if not detectar_corrupcao(texto_corrigido):
            return texto_corrigido
    except Exception:
        pass

    # Estratégia 3: UTF-8 com BOM
    try:
        texto = conteudo_bytes.decode('utf-8-sig')
        if not detectar_corrupcao(texto):
            return texto
    except Exception:
        pass

    return None  # não conseguiu corrigir


def processar_arquivo(caminho: str) -> tuple[bool, str]:
    """Retorna (corrigido, mensagem)."""
    with open(caminho, 'rb') as f:
        raw = f.read()

    resultado = tentar_corrigir(raw)
    if resultado is None:
        return False, "não foi possível corrigir automaticamente"

    # Verifica se houve mudança real
    try:
        original = raw.decode('utf-8-sig', errors='replace')
    except Exception:
        original = ''

    if original == resultado:
        return False, "sem corrupção detectada"

    # Salva corrigido
    with open(caminho, 'w', encoding='utf-8-sig') as f:
        f.write(resultado)

    return True, "corrigido"


def main():
    if not os.path.exists(TXT_DIR):
        print(f"Pasta não encontrada: {TXT_DIR}")
        sys.exit(1)

    arquivos = [f for f in os.listdir(TXT_DIR) if f.endswith('.txt')]
    if not arquivos:
        print("Nenhum arquivo .txt encontrado.")
        sys.exit(0)

    print(f"Encontrados {len(arquivos)} arquivo(s) em {TXT_DIR}")
    print(f"Criando backup em {BACKUP_DIR}...")
    os.makedirs(BACKUP_DIR, exist_ok=True)

    corrigidos = 0
    sem_corrupcao = 0
    falhas = 0

    for nome in sorted(arquivos):
        caminho = os.path.join(TXT_DIR, nome)
        backup  = os.path.join(BACKUP_DIR, nome)

        # Backup antes de modificar
        shutil.copy2(caminho, backup)

        ok, msg = processar_arquivo(caminho)
        if ok:
            corrigidos += 1
            print(f"  [OK] {nome} - {msg}")
        elif "sem corrupcao" in msg or "sem corrupcao" in msg or "sem" in msg:
            sem_corrupcao += 1
            print(f"  [--] {nome} - {msg}")
        else:
            falhas += 1
            print(f"  [!!] {nome} - {msg}")

    print(f"\nResumo:")
    print(f"  Corrigidos:      {corrigidos}")
    print(f"  Sem corrupção:   {sem_corrupcao}")
    print(f"  Não corrigidos:  {falhas}")
    print(f"  Backup salvo em: {BACKUP_DIR}")

    if falhas > 0:
        print("\nArquivos não corrigidos precisam ser re-extraídos.")


if __name__ == '__main__':
    main()

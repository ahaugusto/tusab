#!/usr/bin/env python3
# Copyright (c) 2026 CriAugu - CNPJ 65.131.075/0001-57
"""Remove do Python embutido o que o Tusab nunca usa em execução.

Roda depois do `pip install -r requirements.txt`, nos dois sistemas:
Windows (montar-python-windows.ps1) e macOS (release.yml e macos-smoke.yml).
Só apaga arquivos — não importa nada do ambiente alvo, então qualquer
python3 serve (no macOS o build é cruzado e o interpretador arm64 pode nem
rodar no host).

O que sai e por quê (medido em 20/out/2026, Windows):
- pip (~10 MB): o app instalado nunca instala pacote em execução.
- pastas `tests` das bibliotecas (~55 MB): suítes de teste de numpy, pandas,
  pyarrow etc., que nenhum import de produção carrega. Só `tests`, nunca
  `testing` — `numpy.testing`/`pandas.testing` são API pública importável.
- catálogos de discovery do googleapiclient (~105 MB): são 600 JSONs, um por
  API do Google; o Tusab só usa o Drive v3 (motor/drive.py:
  build('drive', 'v3') lê discovery_cache/documents/drive.v3.json).
- opencv_videoio_ffmpeg (~29 MB): plugin de vídeo do OpenCV, carregado só por
  cv2.VideoCapture. O OCR (rapidocr) trabalha com imagem estática.

Uso: python3 enxugar_python_env.py <pasta site-packages>
"""
import shutil
import sys
from pathlib import Path

DISCOVERY_MANTIDOS = {'drive.v3.json'}


def _tamanho(p: Path) -> int:
    if p.is_file():
        return p.stat().st_size
    return sum(f.stat().st_size for f in p.rglob('*') if f.is_file())


def _remover(p: Path, motivo: str, removidos: list) -> None:
    if not p.exists():
        return
    removidos.append((motivo, _tamanho(p)))
    if p.is_dir():
        shutil.rmtree(p)
    else:
        p.unlink()


def enxugar(sp: Path) -> list:
    removidos = []

    for p in list(sp.glob('pip')) + list(sp.glob('pip-*.dist-info')):
        _remover(p, 'pip', removidos)

    # topdown: coleta primeiro e apaga depois, sem descer em pasta já removida
    for p in sorted(sp.rglob('tests'), key=lambda x: len(x.parts)):
        if p.is_dir() and p.exists():
            _remover(p, 'tests', removidos)

    docs = sp / 'googleapiclient' / 'discovery_cache' / 'documents'
    if docs.is_dir():
        if not (docs / 'drive.v3.json').is_file():
            raise SystemExit(f'drive.v3.json ausente em {docs} — o Drive deixaria de funcionar')
        for p in docs.iterdir():
            if p.name not in DISCOVERY_MANTIDOS:
                _remover(p, 'discovery googleapiclient', removidos)

    for p in (sp / 'cv2').glob('opencv_videoio_ffmpeg*'):
        _remover(p, 'opencv ffmpeg', removidos)

    return removidos


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    sp = Path(sys.argv[1]).resolve()
    if not (sp.is_dir() and sp.name == 'site-packages'):
        raise SystemExit(f'esperava uma pasta site-packages, recebi: {sp}')

    removidos = enxugar(sp)
    por_motivo = {}
    for motivo, tam in removidos:
        por_motivo[motivo] = por_motivo.get(motivo, 0) + tam
    for motivo, tam in sorted(por_motivo.items(), key=lambda x: -x[1]):
        print(f'  {motivo:28} {tam / 1048576:7.1f} MB')
    print(f'== Python enxugado: {sum(por_motivo.values()) / 1048576:.0f} MB removidos')


if __name__ == '__main__':
    main()

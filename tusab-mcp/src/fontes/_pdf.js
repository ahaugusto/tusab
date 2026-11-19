// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Texto de PDF para as fontes que baixam o arquivo (arXiv, Câmara). Usa o
// pdfjs-dist que a extensão já traz, no lugar do pdfplumber do desktop.
//
// juntarHifen=true reproduz o tratamento de motor/arxiv.py (palavra hifenizada
// na quebra de linha volta a ser uma palavra; espaços repetidos colapsados).
// maxPaginas reproduz o teto defensivo de camara.py.

export async function extrairTextoPdf(bytes, { maxPaginas = Infinity, juntarHifen = true } = {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, isEvalSupported: false, verbosity: 0,
  });
  const doc = await tarefa.promise;
  const paginas = [];
  try {
    const total = Math.min(doc.numPages, maxPaginas);
    for (let n = 1; n <= total; n++) {
      const pagina = await doc.getPage(n);
      const { items } = await pagina.getTextContent();
      let txt = '';
      for (const it of items) {
        if (typeof it.str !== 'string') continue;
        txt += it.str;
        txt += it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : '');
      }
      if (juntarHifen) {
        txt = txt.replace(/(?<=[a-záàâãéêíóôõúç])-\n(?=[a-záàâãéêíóôõúç])/giu, '').replace(/[ \t]{2,}/g, ' ');
      }
      txt = txt.split('\n').map((l) => l.trim()).join('\n').trim();
      if (txt) paginas.push(txt);
      pagina.cleanup();
    }
  } finally {
    // No pdfjs-dist 6 o destroy() fica na tarefa de carregamento (o documento não tem mais).
    await (typeof doc.destroy === 'function' ? doc.destroy() : tarefa.destroy());
  }
  return paginas.join('\n\n');
}

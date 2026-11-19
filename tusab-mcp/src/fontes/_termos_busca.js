// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _termos_busca.py: comparação de termo de busca com texto, para
// fontes cujo servidor ordena por data (Agência Brasil) ou aplica stemming
// agressivo demais (STF: "saneamento" e "saneador" viram o mesmo radical).
// Comparação sem acento e sem caixa.

const RE_PALAVRA = /[\p{L}\p{N}_]+/gu;

/** Minúsculas e sem acentos — 'Tributária' -> 'tributaria'. */
export function normalizar(texto) {
  return String(texto || '').normalize('NFKD').replace(/\p{Mn}/gu, '').toLowerCase();
}

/** Palavras do termo com pelo menos `minimo` letras (descarta 'de', 'em', 'IA'...). */
export function palavrasSignificativas(query, minimo = 4) {
  return (normalizar(query).match(RE_PALAVRA) || []).filter((p) => Array.from(p).length >= minimo);
}

/**
 * Radical aproximado para tolerar plural/flexão sem casar palavras de outra
 * família: 'licitacao' -> 'licita', 'saneamento' -> 'saneame' (não casa 'saneador').
 */
export function radical(palavra) {
  const letras = Array.from(palavra);
  return letras.slice(0, Math.max(4, letras.length - 3)).join('');
}

export function contemAlguma(textoNormalizado, palavras) {
  return palavras.some((p) => textoNormalizado.includes(radical(p)));
}

export function contemTodas(textoNormalizado, palavras) {
  return palavras.every((p) => textoNormalizado.includes(radical(p)));
}

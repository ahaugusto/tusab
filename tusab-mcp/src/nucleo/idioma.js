// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Idioma do plugin (pt, en, es). Toda frase que o usuário lê passa por t(): a chave é o próprio
// texto em português (com {variáveis}); en.js e es.js trazem as traduções. Um teste confere que
// toda chave usada no código tem tradução nos dois dicionários, com as mesmas variáveis.
//
// O idioma vem da tela do Tusab (cabeçalho X-Tusab-Idioma em cada chamada à API) e fica gravado
// em data/config/idioma.json, para valer também no que a IA vê (ferramentas e atalhos do "+").
// Antes de a tela ser aberta pela primeira vez, vale o idioma do sistema.
//
// NÃO passam por t(): formatos gravados em disco e lidos pelo desktop (rótulos dos blocos .txt,
// status do CSV), termos de busca enviados às fontes e textos que detectam formatos.

import path from 'node:path';
import { lerJson, salvarJson } from './caminhos.js';
import EN from './textos/en.js';
import ES from './textos/es.js';

export const IDIOMAS = ['pt', 'en', 'es'];
const DICIONARIOS = { en: EN, es: ES };
const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

let atual = null;
let raizAtual = null;
const ouvintes = new Set();

/** "pt-BR" → "pt"; o que não for pt/en/es vira null. */
export function normalizarIdioma(valor) {
  const base = String(valor || '').trim().toLowerCase().slice(0, 2);
  return IDIOMAS.includes(base) ? base : null;
}

function idiomaDoSistema() {
  const env = normalizarIdioma(process.env.TUSAB_IDIOMA);
  if (env) return env;
  let local = '';
  try { local = Intl.DateTimeFormat().resolvedOptions().locale; } catch { /* sem Intl */ }
  return normalizarIdioma(local) || normalizarIdioma(process.env.LANG) || 'en';
}

const arquivo = (raiz) => path.join(raiz, 'data', 'config', 'idioma.json');

/** Carrega o idioma salvo (chamado ao abrir o repositório). */
export function carregarIdioma(raiz) {
  raizAtual = raiz;
  atual = normalizarIdioma(lerJson(arquivo(raiz), {})?.idioma) || idiomaDoSistema();
  return atual;
}

export function idioma() {
  return atual || idiomaDoSistema();
}

export function localeDe(lng = idioma()) {
  return LOCALE[lng] || LOCALE.en;
}

/** Troca o idioma (vindo da tela). Grava e avisa quem depende dele (atalhos do Claude). */
export function definirIdioma(valor, raiz = raizAtual) {
  const novo = normalizarIdioma(valor);
  if (!novo || novo === atual) return false;
  atual = novo;
  if (raiz) {
    try { salvarJson(arquivo(raiz), { idioma: novo }); } catch { /* sem gravação: vale só nesta execução */ }
  }
  for (const fn of ouvintes) {
    try { fn(novo); } catch { /* um ouvinte com erro não impede os outros */ }
  }
  return true;
}

export function aoMudarIdioma(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function preencher(texto, vars) {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome) => (vars[nome] === undefined ? inteiro : String(vars[nome])));
}

/** Traduz uma frase (a chave é o texto em português) para o idioma atual ou para `lng`. */
export function t(pt, vars, lng = idioma()) {
  const traduzido = lng === 'pt' ? pt : (DICIONARIOS[lng]?.[pt] ?? pt);
  return preencher(traduzido, vars);
}

/** Escolhe entre singular e plural pela quantidade `n` (já disponível como {n}). */
export function tn(n, singular, plural, vars = {}, lng) {
  return t(Number(n) === 1 ? singular : plural, { n, ...vars }, lng);
}

/** Número no formato do idioma (1.234 / 1,234). */
export function numero(n, lng = idioma()) {
  return Number(n || 0).toLocaleString(localeDe(lng));
}

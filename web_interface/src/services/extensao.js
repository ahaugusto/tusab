/**
 * @file extensao.js
 * @description Modo extensão: a interface é servida pelo plugin MCP do Tusab
 *   em http://127.0.0.1:<porta>. O link traz uma chave de sessão (?chave=…)
 *   que precisa acompanhar toda chamada à API (/api/*), no cabeçalho X-Tusab-Chave.
 *   A chave fica só nesta aba (sessionStorage) e sai da barra de endereço.
 *   O idioma da tela vai junto (X-Tusab-Idioma): o plugin responde, registra e fala com a IA nele.
 * @copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57
 */
import axios from 'axios';
import i18n from '../i18n';
import { MODO_EXTENSAO } from '../constants';

const ARMAZENAMENTO = 'tusab-chave';

/** pt, en ou es (o que a tela está mostrando). */
const idiomaAtual = () => String(i18n.resolvedLanguage || i18n.language || 'pt').slice(0, 2);

function lerChave() {
  const daUrl = new URLSearchParams(window.location.search).get('chave');
  if (daUrl) {
    try { sessionStorage.setItem(ARMAZENAMENTO, daUrl); } catch { /* aba privada: fica só em memória */ }
    // Tira a chave da barra de endereço, mas mantém o #destino (ex.: #material/projeto/id).
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    return daUrl;
  }
  try { return sessionStorage.getItem(ARMAZENAMENTO); } catch { return null; }
}

/** Tela simples (sem React) para link ausente, expirado ou Tusab fechado. */
export function mostrarAvisoExtensao(motivo = 'sem-chave') {
  const chave = ['sem-chave', 'expirado', 'fechado'].includes(motivo) ? motivo.replace('-', '_') : 'sem_chave';
  const titulo = i18n.t(`ext.aviso.${chave}_titulo`);
  const texto = i18n.t(`ext.aviso.${chave}_texto`);
  const raiz = document.getElementById('root');
  if (!raiz || raiz.dataset.aviso === motivo) return;
  raiz.dataset.aviso = motivo;
  raiz.innerHTML = '';
  const caixa = document.createElement('main');
  caixa.setAttribute('role', 'alert');
  caixa.style.cssText = 'max-width:32rem;margin:15vh auto;padding:2rem;font-family:system-ui,sans-serif;line-height:1.5;text-align:center';
  const h1 = document.createElement('h1');
  h1.textContent = titulo;
  h1.style.cssText = 'font-size:1.5rem;margin:0 0 .75rem';
  const p = document.createElement('p');
  p.textContent = texto;
  caixa.append(h1, p);
  raiz.append(caixa);
}

/**
 * Prepara o modo extensão antes de o React montar.
 * @returns {boolean} false se não há chave (a interface não deve montar).
 */
export function prepararExtensao() {
  if (!MODO_EXTENSAO) return true;
  const chave = lerChave();
  if (!chave) return false;

  axios.defaults.headers.common['X-Tusab-Chave'] = chave;
  axios.interceptors.request.use((config) => {
    config.headers['X-Tusab-Idioma'] = idiomaAtual();
    return config;
  });
  axios.interceptors.response.use(undefined, (erro) => {
    if (erro?.response?.status === 401) mostrarAvisoExtensao('expirado');
    else if (!erro?.response && erro?.code === 'ERR_NETWORK') mostrarAvisoExtensao('fechado');
    return Promise.reject(erro);
  });

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada, opcoes = {}) => {
    const url = typeof entrada === 'string' ? entrada : entrada?.url || '';
    if (!url.startsWith('/api/')) return fetchOriginal(entrada, opcoes);
    const headers = new Headers(opcoes.headers || (typeof entrada === 'string' ? undefined : entrada.headers));
    headers.set('X-Tusab-Chave', chave);
    headers.set('X-Tusab-Idioma', idiomaAtual());
    return fetchOriginal(entrada, { ...opcoes, headers });
  };
  return true;
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de almg.py: proposições da Assembleia Legislativa de Minas Gerais
// (Dados Abertos ALMG v2), sem chave — ementa e texto integral de cada proposição.

import {
  HEADERS_TUSABBOT, aparar, dormir, executarBuscaGenerica, exigirJson, fatiar, htmlParaTexto, limitarMax, obter,
  pastaDocumentos, resultadoVazio, tamanho,
  separarLinhas,
} from './_base.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "almg",
  "nome": "Assembleia Legislativa de Minas Gerais",
  "area": "direito",
  "descricao": "Proposições da Assembleia de Minas Gerais — ementa e texto integral de cada proposição.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_BASE = 'https://dadosabertos.almg.gov.br/api/v2';
const SEARCH_URL = `${API_BASE}/proposicoes/pesquisa/avancada`;
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;
const ERRO_FORMATO = 'Dados Abertos da ALMG mudou o formato da resposta — a busca precisa ser atualizada no Tusab';
const HEADERS = { ...HEADERS_TUSABBOT, Accept: 'application/json' };

/** str.splitlines() do Python */

export function listaItens(dados) {
  const resultado = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados.resultado : undefined;
  if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)
    || (!('listaItem' in resultado) && !('noOcorrencias' in resultado))) {
    throw new Error(ERRO_FORMATO);
  }
  if (resultado.erro === true) throw new Error(t('Dados Abertos da ALMG recusou a busca (erro na expressão de pesquisa)'));
  return resultado.listaItem || [];
}

/** Quebras de linha no HTML da ALMG são de exportação, não de parágrafo. */
export function htmlAlmgParaTexto(conteudo) {
  return htmlParaTexto(String(conteudo || '').replace(/\s+/g, ' '));
}

async function textoIntegral(link) {
  const url = link?.url || '';
  if (!url.startsWith('/')) return '';
  const r = await obter(API_BASE + url, { params: { formato: 'json' }, headers: HEADERS, timeout: TIMEOUT });
  r.raise_for_status();
  const itens = listaItens(exigirJson(r, FONTE_META.nome));
  return itens.filter((i) => i?.texto).map((i) => htmlAlmgParaTexto(i.texto ?? '')).join('\n\n').trim();
}

export function montarDocumento(item, integra) {
  const sigla = item.siglaTipoProjeto ?? '';
  const numero = item.numero ?? '';
  const ano = item.ano ?? '';
  // Projetos trazem "ementa"; requerimentos trazem "assunto" no lugar.
  const ementa = String(item.ementa || item.assunto || '').replace(/\s+/g, ' ').trim();
  if (!ementa && !integra) return null;
  let titulo = aparar(`${sigla} ${numero}/${ano}`, ' /') || 'Proposição';
  if (ementa) {
    let curta = ementa;
    if (tamanho(ementa) > 80) {
      const corte = fatiar(ementa, 0, 80);
      const i = corte.lastIndexOf(' ');
      curta = `${i >= 0 ? corte.slice(0, i) : corte}…`;
    }
    titulo += ` — ${curta}`;
  }
  const linhas = [];
  if (ementa) linhas.push(`${item.ementa ? 'Ementa' : 'Assunto'}: ${ementa}`);
  for (const [rotulo, chave] of [['Autoria', 'autor'], ['Situação', 'situacao'], ['Publicação', 'dataPublicacao']]) {
    const valor = String(item[chave] || '').replace(/\s+/g, ' ').trim();
    if (valor) linhas.push(`${rotulo}: ${valor}`);
  }
  const indexacao = separarLinhas(item.indexacao || '').filter((t) => t.trim()).map((t) => aparar(t, '/ ').replace(/\//g, ' › '));
  if (indexacao.length) linhas.push(`Indexação: ${indexacao.join('; ')}`);
  let texto = linhas.join('\n');
  if (integra) texto += `\n\n--- TEXTO INTEGRAL ---\n\n${integra}`;
  const url = sigla && numero && ano ? `https://www.almg.gov.br/projetos-de-lei/${sigla}/${numero}/${ano}` : '';
  return { titulo, texto: fatiar(texto, 0, MAX_CHARS), url_origem: url };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(SEARCH_URL, {
    params: { expr: query, ord: 0, tp: max, formato: 'json' }, headers: HEADERS, timeout: TIMEOUT,
  });
  resp.raise_for_status();
  const itens = listaItens(exigirJson(resp, FONTE_META.nome)).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (item) => {
    let integra = '';
    const links = item.linksTextos || [];
    if (links.length) {
      await dormir(0.5);
      // Melhor esforço: falha no texto integral não derruba o item — fica a ementa.
      try { integra = await textoIntegral(links[0]); } catch { integra = ''; }
    }
    return montarDocumento(item, integra);
  };

  return executarBuscaGenerica(itens, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

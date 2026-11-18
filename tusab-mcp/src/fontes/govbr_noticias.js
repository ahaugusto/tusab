// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de govbr_noticias.py: notícias de agências reguladoras, ministérios e
// órgãos de controle nos portais gov.br (RSS 1.0 do Plone, sem chave) — texto
// integral. Órgão fora do ar ou em manutenção fica de fora sem derrubar a busca.

import {
  HEADERS_TUSABBOT, dormir, ehErroRequisicao, executarBuscaGenerica, fatiar, htmlParaTexto, limitarMax, obter,
  pastaDocumentos, resultadoVazio,
} from './_base.js';
import { fromstring } from './_xml.js';

export const FONTE_META = {
  "id": "govbr_noticias",
  "nome": "Notícias gov.br",
  "area": "direito",
  "descricao": "Notícias de agências reguladoras, ministérios e órgãos de controle nos portais gov.br — texto integral.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export const ORGAOS = ['anac', 'anp', 'antt', 'ana', 'cvm', 'cgu', 'agu', 'mcti', 'fazenda', 'mma', 'secom', 'planalto'];
const ITENS_POR_PAGINA = 15;
const MAX_PAGINAS_POR_ORGAO = 2;
const MAX_CHARS_TEXTO = 200_000;

/** HTML interno da <div id=divId>, contando aninhamento de <div>. */
export function extrairDivPorId(html, divId) {
  let ini = html.indexOf(`id="${divId}"`);
  if (ini < 0) return '';
  ini = html.indexOf('>', ini) + 1;
  let profundidade = 1;
  let pos = ini;
  while (profundidade && pos < html.length) {
    const proxAbre = html.indexOf('<div', pos);
    const proxFecha = html.indexOf('</div', pos);
    if (proxFecha < 0) return html.slice(ini);
    if (proxAbre >= 0 && proxAbre < proxFecha) {
      profundidade += 1;
      pos = proxAbre + 4;
    } else {
      profundidade -= 1;
      pos = proxFecha + 5;
    }
  }
  return html.slice(ini, Math.max(ini, pos - 5));
}

/** Itens de uma página do RSS; lista vazia se o órgão estiver fora do ar, em manutenção ou sem resultado. */
export function itensDoRss(xml, orgao) {
  const raiz = fromstring(xml);
  const itens = [];
  for (const item of raiz.findall('item')) {
    const link = (item.findtext('link', '') || '').trim();
    if (!link) continue;
    itens.push({
      orgao,
      titulo: (item.findtext('title', '') || '').trim(),
      link,
      descricao: (item.findtext('description', '') || '').trim(),
      data: (item.findtext('date', '') || '').trim(),
      conteudo_html: item.findtext('encoded', '') || '',
    });
  }
  return itens;
}

async function lerRss(orgao, query, bStart) {
  let resp;
  try {
    resp = await obter(`https://www.gov.br/${orgao}/pt-br/search_rss`, {
      params: {
        SearchableText: query, portal_type: 'collective.nitf.content', sort_on: 'Date', sort_order: 'reverse', b_start: bStart,
      },
      headers: HEADERS_TUSABBOT, timeout: [10, 30],
    });
  } catch (e) {
    if (ehErroRequisicao(e)) return [];
    throw e;
  }
  if (resp.status !== 200 || !(resp.headers.get('content-type') || '').toLowerCase().includes('xml')) return [];
  try {
    return itensDoRss(resp.conteudo, orgao);
  } catch {
    return []; // XML quebrado (ET.ParseError no desktop)
  }
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const candidatos = [];
  const vistos = new Set();
  for (const orgao of ORGAOS) {
    for (let pagina = 0; pagina < MAX_PAGINAS_POR_ORGAO; pagina++) {
      if (candidatos.length >= max) break;
      if (evento_cancelar && evento_cancelar.is_set()) break;
      const lote = await lerRss(orgao, query, pagina * ITENS_POR_PAGINA);
      for (const item of lote) {
        if (!vistos.has(item.link) && candidatos.length < max) {
          vistos.add(item.link);
          candidatos.push(item);
        }
      }
      if (lote.length < ITENS_POR_PAGINA) break;
      await dormir(0.5);
    }
    if (candidatos.length >= max) break;
  }
  if (!candidatos.length) return resultadoVazio();

  const extrair = async (item) => {
    let texto = htmlParaTexto(extrairDivPorId(item.conteudo_html, 'parent-fieldname-text') || item.conteudo_html);
    if (!texto) {
      try {
        const pagina = await obter(item.link, { headers: HEADERS_TUSABBOT, timeout: [10, 30] });
        if (pagina.ok && (pagina.headers.get('content-type') || '').toLowerCase().includes('html')) {
          texto = htmlParaTexto(extrairDivPorId(pagina.texto, 'parent-fieldname-text'));
        }
      } catch (e) {
        if (!ehErroRequisicao(e)) throw e;
        texto = '';
      }
    }
    if (!texto) texto = item.descricao;
    if (!texto) return null;
    const cabecalho = [`Órgão: ${item.orgao.toUpperCase()}`];
    if (item.data) cabecalho.push(`Publicado em: ${item.data}`);
    if (item.descricao && !fatiar(texto, 0, 500).includes(item.descricao)) cabecalho.push(`Resumo: ${item.descricao}`);
    const corpo = `${cabecalho.join('\n')}\n\n${texto}`;
    return {
      titulo: `${item.titulo || 'Notícia'} (${item.orgao.toUpperCase()})`,
      texto: fatiar(corpo, 0, MAX_CHARS_TEXTO),
      url_origem: item.link,
    };
  };

  return executarBuscaGenerica(candidatos, extrair, 'govbr_noticias', docDir, { evento_cancelar, dispatch_event, throttle: 0.5 });
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de ibge_noticias.py: notícias e releases da Agência IBGE (API de
// notícias v3), sem chave. Tenta o texto integral da página da notícia; se o
// site responder com o desafio do Cloudflare, para de insistir e fica com a introdução.

import {
  HEADERS_NAVEGADOR, ehErroRequisicao, executarBuscaGenerica, exigirJson, fatiar, htmlParaTexto, limitarMax, obter,
  pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "ibge_noticias",
  "nome": "IBGE — Notícias e releases",
  "area": "economia",
  "descricao": "Notícias e releases da Agência IBGE sobre pesquisas e indicadores oficiais.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://servicodados.ibge.gov.br/api/v3/noticias/';
const MAX_PAGINAS = 5;
const MAX_CHARS_TEXTO = 200_000;
const HEADERS_PAGINA = { ...HEADERS_NAVEGADOR, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };

/** Corpo da notícia: do elemento com class="texto--single" até a lista de notícias relacionadas. */
export function trechoIntegral(html) {
  let ini = html.indexOf('class="texto--single"');
  if (ini < 0) return '';
  ini = html.indexOf('>', ini) + 1;
  let fim = html.indexOf('lista-noticias', ini);
  if (fim < 0) return '';
  // volta ao início da tag que contém a classe (rfind("<", ini, fim) do Python)
  const lt = fim > 0 ? html.lastIndexOf('<', fim - 1) : -1;
  fim = lt >= ini ? lt : -1;
  return htmlParaTexto(fim > ini ? html.slice(ini, fim) : html.slice(ini));
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  let itens = [];
  let pagina = 1;
  while (itens.length < max && pagina <= MAX_PAGINAS) {
    const resp = await obter(API_URL, { params: { busca: query, qtd: max, page: pagina }, timeout: [10, 30] });
    resp.raise_for_status();
    const dados = exigirJson(resp, 'IBGE');
    const lote = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados.items : undefined;
    if (!Array.isArray(lote)) throw new Error("IBGE mudou o formato da API de notícias (campo 'items' ausente)");
    itens.push(...lote.filter((i) => i && typeof i === 'object' && !Array.isArray(i)));
    if (!lote.length || pagina >= Math.trunc(Number(dados.totalPages || 1))) break;
    pagina += 1;
  }
  itens = itens.slice(0, max);
  if (!itens.length) return resultadoVazio();

  let bloqueado = false;

  const extrair = async (item) => {
    const link = String(item.link || '').replace('http://', 'https://');
    const introducao = String(item.introducao || '').trim();
    let texto = '';
    if (link && !bloqueado) {
      try {
        const r = await obter(link, { headers: HEADERS_PAGINA, timeout: [10, 30] });
        if (r.status === 403 || r.texto.slice(0, 2000).includes('Just a moment')) {
          bloqueado = true; // desafio Cloudflare — não insiste nos demais
        } else if (r.ok) {
          texto = trechoIntegral(r.texto);
        }
      } catch (e) {
        if (!ehErroRequisicao(e)) throw e;
        texto = '';
      }
    }
    texto = texto || introducao;
    if (!texto) return null;
    const cabecalho = [
      item.tipo ? `Tipo: ${item.tipo}` : '',
      item.data_publicacao ? `Publicado em: ${item.data_publicacao}` : '',
      item.editorias ? `Editorias: ${item.editorias}` : '',
    ];
    const corpo = `${cabecalho.filter(Boolean).join('\n')}\n\n${texto}`;
    return { titulo: String(item.titulo || 'Notícia IBGE').trim(), texto: fatiar(corpo, 0, MAX_CHARS_TEXTO), url_origem: link };
  };

  return executarBuscaGenerica(itens, extrair, 'ibge_noticias', docDir, { evento_cancelar, dispatch_event, throttle: 0.5 });
}

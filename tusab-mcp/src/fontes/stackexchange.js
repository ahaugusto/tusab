// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de stackexchange.py: perguntas e respostas técnicas do Stack Overflow, sem chave.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "stackexchange",
  "nome": "Stack Overflow",
  "area": "tecnologia",
  "descricao": "Perguntas e respostas técnicas da comunidade Stack Overflow.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://api.stackexchange.com/2.3/search/advanced';

const limparHtml = (texto) => String(texto || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// O conteúdo do Stack Overflow é CC BY-SA e pede crédito ao autor: nome, link do perfil, link do post
// e a licença, que depende da data de publicação (2.5 até 08/04/2011, 3.0 até 02/05/2018, depois 4.0).
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decodificar = (s) => String(s || '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTIDADES[m]);

export function licencaStackOverflow(criadoEmSegundos) {
  const data = new Date((Number(criadoEmSegundos) || 0) * 1000);
  if (data < new Date('2011-04-08T00:00:00Z')) return 'CC BY-SA 2.5';
  if (data < new Date('2018-05-02T00:00:00Z')) return 'CC BY-SA 3.0';
  return 'CC BY-SA 4.0';
}

/** Item da API → documento, com a atribuição exigida pela licença no fim do texto. */
export function extrairItem(item) {
  const corpo = limparHtml(item.body ?? '');
  if (!corpo) return null;
  const partes = [corpo];
  if (item.tags?.length) partes.push(`Tags: ${item.tags.join(', ')}`);
  partes.push(`${item.score ?? 0} votos · ${item.answer_count ?? 0} resposta(s)`);
  const autor = decodificar(item.owner?.display_name) || 'autor não informado';
  const perfil = item.owner?.link ? ` (${item.owner.link})` : '';
  partes.push(`Autor: ${autor}${perfil} · Stack Overflow · Licença: ${licencaStackOverflow(item.creation_date)}`);
  return { titulo: decodificar(item.title) || 'Sem título', texto: partes.join('\n\n'), url_origem: item.link ?? '' };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, {
    params: { order: 'desc', sort: 'relevance', q: query, site: 'stackoverflow', pagesize: max, filter: 'withbody' },
    timeout: [10, 45],
  });
  resp.raise_for_status();
  const itens = resp.json()?.items || [];

  return executarBuscaGenerica(itens, extrairItem,'stackexchange', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}

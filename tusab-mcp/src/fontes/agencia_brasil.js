// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de agencia_brasil.py: notícias da Agência Brasil (EBC), sem chave —
// texto integral de cada matéria. O servidor ordena por data, então a
// relevância é conferida localmente (palavra significativa do termo no título,
// nas tags ou no corpo).

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, fatiar, htmlParaTexto, limitarMax, obter, pastaDocumentos,
  resultadoVazio,
} from './_base.js';
import { contemAlguma, normalizar, palavrasSignificativas } from './_termos_busca.js';

export const FONTE_META = {
  "id": "agencia_brasil",
  "nome": "Agência Brasil (EBC)",
  "area": "geral",
  "descricao": "Notícias da agência pública de notícias do governo federal — texto integral de cada matéria.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const SEARCH_URL = 'https://busca.ebc.com.br/sites/agenciabrasil/nodes.json';
const SITE_URL = 'https://agenciabrasil.ebc.com.br';
const MAX_PAGINAS = 5;
const MAX_CHARS_TEXTO = 200_000;

/** Título, tags ou corpo contêm ao menos uma palavra significativa do termo. */
export function relevante(item, palavras) {
  if (!palavras.length) return true;
  const tags = (item.tags || []).filter((t) => typeof t === 'string').join(' ');
  const alvo = normalizar(`${item.title || ''} ${tags} ${htmlParaTexto(item.body || '')}`);
  return contemAlguma(alvo, palavras);
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);
  const palavras = palavrasSignificativas(query);

  let itens = [];
  const vistos = new Set();
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    if (evento_cancelar && evento_cancelar.is_set()) break;
    const resp = await obter(SEARCH_URL, { params: { q: query, page: pagina }, headers: HEADERS_TUSABBOT, timeout: [10, 30] });
    resp.raise_for_status();
    const lote = exigirJson(resp, 'Agência Brasil');
    if (!Array.isArray(lote)) throw new Error('Agência Brasil mudou o formato da busca (esperada uma lista de matérias)');
    for (const item of lote) {
      const chave = item && typeof item === 'object' && !Array.isArray(item) && (item._id || item.path);
      if (chave && !vistos.has(chave) && relevante(item, palavras)) {
        vistos.add(chave);
        itens.push(item);
      }
    }
    if (itens.length >= max || lote.length < 15) break;
  }
  itens = itens.slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (item) => {
    const corpo = htmlParaTexto(item.body || '');
    if (!corpo) return null;
    const cabecalho = [
      item.created_at ? `Publicado em: ${item.created_at}` : '',
      item.channels?.length ? `Editoria: ${item.channels.join(', ')}` : '',
      item.tags?.length ? `Tags: ${item.tags.join(', ')}` : '',
    ];
    const texto = `${cabecalho.filter(Boolean).join('\n')}\n\n${corpo}`;
    const caminho = item.path || '';
    const url = caminho.startsWith('http') ? caminho : (caminho ? SITE_URL + caminho : '');
    return {
      titulo: String(item.title || 'Notícia Agência Brasil').trim(),
      texto: fatiar(texto, 0, MAX_CHARS_TEXTO),
      url_origem: url,
    };
  };

  return executarBuscaGenerica(itens, extrair, 'agencia_brasil', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

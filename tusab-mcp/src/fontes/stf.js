// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de stf.py: acórdãos do Supremo Tribunal Federal (API de busca da
// jurisprudência, Elasticsearch), sem chave — ementa, decisão e inteiro teor,
// sem dados das partes (LGPD, ver _lgpd_juridico.js).
//
// Fase 1: candidatos leves pelos campos .standard (sem stemming). Sem nada,
// fallback pelos campos com stemming + filtro local pelo radical (descarta
// "saneador" numa busca por "saneamento"). Fase 2: documento completo dos escolhidos.

import { enviar, executarBuscaGenerica, exigirJson, limitarMax, pastaDocumentos, resultadoVazio } from './_base.js';
import { limitarTexto, sanitizarTextoJuridico } from './_lgpd_juridico.js';
import { contemTodas, normalizar, palavrasSignificativas } from './_termos_busca.js';

export const FONTE_META = {
  "id": "stf",
  "nome": "STF — Jurisprudência",
  "area": "direito",
  "descricao": "Acórdãos do Supremo Tribunal Federal — ementa, decisão e inteiro teor, sem dados das partes.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": false
};

const SEARCH_URL = 'https://jurisprudencia.stf.jus.br/api/search/search';
const CAMPOS_BUSCA_EXATA = ['ementa_texto.standard', 'documental_indexacao_texto.standard'];
const CAMPOS_BUSCA_RADICAL = ['ementa_texto', 'documental_indexacao_texto'];

// Lista branca: só estes campos saem do servidor do STF (LGPD — nada de partes).
const CAMPOS_DOCUMENTO = [
  'id', 'titulo', 'processo_classe_processual_unificada_extenso', 'orgao_julgador',
  'julgamento_data', 'publicacao_data', 'ementa_texto', 'acordao_ata',
  'documental_indexacao_texto', 'documental_tese_texto', 'inteiro_teor_texto',
];
const CAMPOS_CANDIDATO = ['id', 'ementa_texto', 'documental_indexacao_texto'];

export function corpoBusca(query, dataInicio, dataFim, tam, campos, { ids = null, camposBusca = null } = {}) {
  const filtros = [{ term: { base: 'acordaos' } }];
  if (ids && ids.length) filtros.push({ terms: { id: ids } });
  if (dataInicio || dataFim) {
    const faixa = {};
    if (dataInicio) faixa.gte = dataInicio;
    if (dataFim) faixa.lte = dataFim;
    filtros.push({ range: { julgamento_data: faixa } });
  }
  const corpo = { query: { bool: { filter: filtros } }, size: tam, _source: campos };
  if (!(ids && ids.length)) {
    corpo.query.bool.must = [{ simple_query_string: { query, fields: camposBusca || CAMPOS_BUSCA_EXATA, default_operator: 'and' } }];
  }
  return corpo;
}

/** Extrai result.hits.hits[]._source validando o formato — API sem documentação. */
function hits(resp) {
  const dados = exigirJson(resp, 'STF');
  const lista = dados?.result?.hits?.hits;
  if (!Array.isArray(lista) || lista.some((h) => !h || typeof h !== 'object' || !('_source' in h))) {
    throw new Error('STF mudou o formato da resposta da busca de jurisprudência '
      + '(esperado result.hits.hits[]._source) — fonte indisponível até o adaptador ser atualizado');
  }
  return lista.map((h) => h._source);
}

async function post(corpo, timeout) {
  const resp = await enviar(SEARCH_URL, { json: corpo, headers: { Accept: 'application/json' }, timeout });
  resp.raise_for_status();
  return hits(resp);
}

export function montarTexto(doc) {
  const partes = [];
  const classe = String(doc.processo_classe_processual_unificada_extenso || '').trim();
  const meta = [
    classe ? `Classe: ${classe}` : '',
    doc.orgao_julgador ? `Órgão julgador: ${doc.orgao_julgador}` : '',
    doc.julgamento_data ? `Julgamento: ${doc.julgamento_data}` : '',
    doc.publicacao_data ? `Publicação: ${doc.publicacao_data}` : '',
  ].filter(Boolean);
  if (meta.length) partes.push(meta.join('\n'));
  for (const [rotulo, campo] of [['EMENTA', 'ementa_texto'], ['DECISÃO', 'acordao_ata'], ['TESE', 'documental_tese_texto'],
    ['INDEXAÇÃO', 'documental_indexacao_texto'], ['INTEIRO TEOR', 'inteiro_teor_texto']]) {
    let valor = doc[campo];
    if (Array.isArray(valor)) valor = valor.filter(Boolean).map(String).join('\n');
    valor = String(valor || '').trim();
    if (valor) partes.push(`--- ${rotulo} ---\n\n${valor}`);
  }
  return limitarTexto(sanitizarTextoJuridico(partes.join('\n\n')));
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  let candidatos = await post(corpoBusca(query, data_inicio, data_fim, max, CAMPOS_CANDIDATO), [10, 30]);
  const ids = candidatos.filter((c) => c?.id).map((c) => c.id).slice(0, max);
  if (!ids.length) {
    candidatos = await post(corpoBusca(query, data_inicio, data_fim, Math.min(max * 4, 100), CAMPOS_CANDIDATO, {
      camposBusca: CAMPOS_BUSCA_RADICAL,
    }), [10, 30]);
    const palavras = palavrasSignificativas(query);
    for (const c of candidatos) {
      const textoC = normalizar(`${c?.ementa_texto || ''} ${c?.documental_indexacao_texto || ''}`);
      if ((!palavras.length || contemTodas(textoC, palavras)) && c?.id) ids.push(c.id);
      if (ids.length >= max) break;
    }
  }
  if (!ids.length) return resultadoVazio();

  const docs = await post(corpoBusca(query, '', '', ids.length, CAMPOS_DOCUMENTO, { ids }), [10, 60]);
  const porId = new Map(docs.map((d) => [d?.id, d]));
  const itens = ids.filter((i) => porId.has(i)).map((i) => porId.get(i));

  const extrair = (doc) => {
    const texto = montarTexto(doc);
    if (!texto.trim()) return null;
    let titulo = String(doc.titulo || 'Acórdão STF').trim();
    const complemento = [doc.orgao_julgador, doc.julgamento_data].filter(Boolean).join(' — ');
    if (complemento) titulo = `STF ${titulo} — ${complemento}`;
    return { titulo, texto, url_origem: `https://jurisprudencia.stf.jus.br/pages/search/${doc.id}/false` };
  };

  // Sem rede por item (tudo veio na fase 2) — sem throttle.
  return executarBuscaGenerica(itens, extrair, 'stf', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

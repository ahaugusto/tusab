// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de eric.py: ERIC (Departamento de Educação dos EUA), sem chave —
// resumo real de artigos, relatórios e teses. Aceita filtro de autor e de ano.

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos, resultadoVazio, unescapeHtml } from './_base.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "eric",
  "nome": "ERIC (Dep. de Educação dos EUA)",
  "area": "educacao",
  "descricao": "Pesquisa educacional internacional (em inglês) — resumo real de artigos, relatórios e teses.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": true
};

const API_URL = 'https://api.ies.ed.gov/eric/';
const CAMPOS = 'id,title,description,url,e_fulltextauth,publicationdateyear,author';

// Sinais de consulta avançada já escrita pelo usuário — não reescrever.
const RE_CONSULTA_AVANCADA = /"|\b(AND|OR|NOT)\b|[\p{L}\p{N}_]:\S/u;

/** Termo livre → "palavra1 AND palavra2", mais filtros de autor/ano. */
export function montarConsulta(query, dataInicio = '', dataFim = '', autor = '') {
  let termo = String(query || '').trim();
  if (termo && !RE_CONSULTA_AVANCADA.test(termo)) termo = termo.split(/\s+/).filter(Boolean).join(' AND ');
  const partes = termo ? [termo.includes(' OR ') ? `(${termo})` : termo] : [];

  const a = String(autor || '').trim().replace(/"/g, '');
  if (a) partes.push(`author:"${a}"`);

  let anoIni = String(dataInicio || '').trim().slice(0, 4);
  let anoFim = String(dataFim || '').trim().slice(0, 4);
  anoIni = /^\d+$/.test(anoIni) ? anoIni : '';
  anoFim = /^\d+$/.test(anoFim) ? anoFim : '';
  if (anoIni || anoFim) partes.push(`publicationdateyear:[${anoIni || '*'} TO ${anoFim || '*'}]`);

  return partes.join(' AND ');
}

function decodificar(resp) {
  try {
    return resp.json();
  } catch {
    throw new Error(t('ERIC respondeu conteúdo que não é JSON (bloqueio ou manutenção no servidor de origem)'));
  }
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', autor = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const consulta = montarConsulta(query, data_inicio, data_fim, autor);
  if (!consulta) return resultadoVazio();

  const resp = await obter(API_URL, {
    params: { search: consulta, format: 'json', rows: max, start: 0, fields: CAMPOS }, timeout: [10, 30],
  });
  resp.raise_for_status();
  const docs = decodificar(resp)?.response?.docs || [];
  if (!docs.length) return resultadoVazio();

  const extrair = (doc) => {
    const descricao = unescapeHtml(doc.description || '').trim();
    if (!descricao) return null;
    const ericId = String(doc.id || '').trim();
    const titulo = unescapeHtml(doc.title || '').trim() || 'Sem título';

    const cabecalho = [];
    let autores = doc.author || [];
    if (typeof autores === 'string') autores = [autores];
    if (autores.length) cabecalho.push(`Autoria: ${autores.join('; ')}`);
    if (doc.publicationdateyear) cabecalho.push(`Ano: ${doc.publicationdateyear}`);
    if (doc.url) cabecalho.push(`Publicação original: ${doc.url}`);
    if (String(doc.e_fulltextauth) === '1' && ericId.startsWith('ED')) {
      cabecalho.push(`Texto integral (PDF): https://files.eric.ed.gov/fulltext/${ericId}.pdf`);
    }
    const texto = cabecalho.length ? `${cabecalho.join('\n')}\n\n${descricao}` : descricao;
    return { titulo, texto, url_origem: `https://eric.ed.gov/?id=${ericId}` };
  };

  return executarBuscaGenerica(docs, extrair, 'eric', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

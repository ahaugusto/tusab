// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de hal.py: HAL (Archive Ouverte), arquivo aberto francês
// multidisciplinar, sem chave — só documentos com PDF depositado.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';

export const FONTE_META = {
  "id": "hal",
  "nome": "HAL (Archive Ouverte)",
  "area": "geral",
  "descricao": "Arquivo aberto francês multidisciplinar — resumo de cada artigo com PDF depositado.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://api.archives-ouvertes.fr/search/';
const CAMPOS = 'title_s,abstract_s,uri_s,fileMain_s,language_s,producedDateY_i';

function primeiro(valor) {
  if (Array.isArray(valor)) valor = valor.length ? valor[0] : '';
  return typeof valor === 'string' ? valor.trim() : '';
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(API_URL, {
    params: { q: query, fq: 'submitType_s:file', fl: CAMPOS, rows: max, wt: 'json' },
    headers: HEADERS_TUSABBOT, timeout: [10, 30],
  });
  resp.raise_for_status();
  const itens = (exigirJson(resp, FONTE_META.nome)?.response?.docs || []).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (doc) => {
    const resumo = primeiro(doc.abstract_s);
    if (!resumo) return null;
    let texto = resumo;
    const meta = [];
    if (doc.producedDateY_i) meta.push(`Ano: ${doc.producedDateY_i}`);
    const idioma = primeiro(doc.language_s);
    if (idioma) meta.push(`Idioma: ${idioma}`);
    if (doc.fileMain_s) meta.push(`PDF: ${doc.fileMain_s}`);
    if (meta.length) texto += `\n\n${meta.join('\n')}`;
    return { titulo: primeiro(doc.title_s) || 'Sem título', texto, url_origem: doc.uri_s || '' };
  };

  return executarBuscaGenerica(itens, extrair, 'hal', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de tcu.py: acórdãos do Tribunal de Contas da União, sem chave —
// sumário, acórdão, voto e relatório, sem dados de responsáveis (LGPD, ver
// _lgpd_juridico.js). O firewall do TCU só aceita User-Agent de navegador.

import {
  HEADERS_NAVEGADOR, executarBuscaGenerica, exigirJson, htmlParaTexto, limitarMax, obter, pastaDocumentos, resultadoVazio,
} from './_base.js';
import { extrairNomesDeCampo, limitarTexto, sanitizarTextoJuridico } from './_lgpd_juridico.js';

export const FONTE_META = {
  "id": "tcu",
  "nome": "TCU — Acórdãos",
  "area": "direito",
  "descricao": "Acórdãos do Tribunal de Contas da União — sumário, acórdão, voto e relatório, sem dados de responsáveis.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo/';
const RESUMIDOS_URL = `${BASE_URL}documentosResumidos`;
const DOCUMENTO_URL = `${BASE_URL}documento`;

// Ordem de importância — o relatório (o maior) vai por último.
const SECOES = [['SUMÁRIO', 'SUMARIO'], ['ACÓRDÃO', 'ACORDAO'], ['VOTO', 'VOTO'], ['RELATÓRIO', 'RELATORIO']];

function documentos(resp) {
  const dados = exigirJson(resp, 'TCU');
  const docs = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados.documentos : undefined;
  if (!Array.isArray(docs)) {
    throw new Error("TCU mudou o formato da resposta da pesquisa de acórdãos (campo 'documentos' ausente) "
      + '— fonte indisponível até o adaptador ser atualizado');
  }
  return docs;
}

/** Documento completo do TCU → {titulo, texto, url_origem} (já sanitizado). */
export function montarAcordao(doc, resumo, key) {
  if (!SECOES.some(([, campo]) => doc[campo])) {
    throw new Error(`TCU devolveu o acórdão ${key} sem SUMARIO/ACORDAO/VOTO/RELATORIO — formato mudou`);
  }
  const partes = [];
  const meta = [
    doc.COLEGIADO ? `Colegiado: ${doc.COLEGIADO}` : '',
    doc.DATASESSAO ? `Data da sessão: ${doc.DATASESSAO}` : '',
    doc.TIPOPROCESSO ? `Tipo de processo: ${doc.TIPOPROCESSO}` : '',
    doc.ASSUNTO ? `Assunto: ${htmlParaTexto(doc.ASSUNTO || '')}` : '',
  ].filter(Boolean);
  if (meta.length) partes.push(meta.join('\n'));
  for (const [rotulo, campo] of SECOES) {
    const valor = htmlParaTexto(doc[campo] || '');
    if (valor) partes.push(`--- ${rotulo} ---\n\n${valor}`);
  }
  // Nomes de responsáveis/advogados: só dicionário de redação, nunca gravados.
  const nomes = new Set([...extrairNomesDeCampo(doc.INTERESSADOS || ''), ...extrairNomesDeCampo(doc.ADVOGADO || '')]);
  const texto = limitarTexto(sanitizarTextoJuridico(partes.join('\n\n'), [...nomes]));

  const numero = doc.NUMACORDAO || resumo.NUMACORDAO;
  const ano = doc.ANOACORDAO || resumo.ANOACORDAO;
  const colegiado = doc.COLEGIADO || resumo.COLEGIADO || '';
  const titulo = numero && ano
    ? `TCU Acórdão ${numero}/${ano}${colegiado ? ` — ${colegiado}` : ''}`
    : String(doc.TITULO || resumo.TITULO || 'Acórdão TCU').trim();
  return { titulo, texto, url_origem: `https://pesquisa.apps.tcu.gov.br/redireciona/acordao-completo/${key}` };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(RESUMIDOS_URL, {
    params: { termo: query, ordenacao: 'DTRELEVANCIA desc', quantidade: max, inicio: 0 },
    headers: HEADERS_NAVEGADOR, timeout: [10, 30],
  });
  resp.raise_for_status();
  const itens = documentos(resp).filter((d) => d && typeof d === 'object' && d.KEY).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (resumo) => {
    const key = resumo.KEY;
    const r = await obter(DOCUMENTO_URL, {
      params: { termo: `KEY:"${key}"`, quantidade: 1, inicio: 0 }, headers: HEADERS_NAVEGADOR, timeout: [10, 60],
    });
    r.raise_for_status();
    const docs = documentos(r);
    if (!docs.length) return null;
    return montarAcordao(docs[0], resumo, key);
  };

  return executarBuscaGenerica(itens, extrair, 'tcu', docDir, { evento_cancelar, dispatch_event, throttle: 1.0 });
}

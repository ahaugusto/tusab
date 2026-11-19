// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de senado_leis.py: leis federais já publicadas (Dados Abertos do
// Senado, XML), sem chave — ementa oficial de cada norma. A lista vem inteira
// e o filtro pelo termo é local (todas as palavras na ementa).

import { executarBuscaGenerica, limitarMax, obter, pastaDocumentos } from './_base.js';
import { fromstring } from './_xml.js';

export const FONTE_META = {
  "id": "senado_leis",
  "nome": "Senado Federal — Legislação",
  "area": "direito",
  "descricao": "Leis federais já publicadas (sancionadas) — ementa oficial de cada norma.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const LISTA_URL = 'https://legis.senado.leg.br/dadosabertos/legislacao/lista';

/** '23/07/2026' -> '2026-07-23' (formato exigido pela URN de normas.leg.br). */
export function dataParaUrn(dataAssinatura) {
  const partes = String(dataAssinatura || '').split('/');
  if (partes.length !== 3) return '';
  const [dia, mes, ano] = partes;
  return `${ano}-${mes}-${dia}`;
}

/** Filtra as leis do XML pela query (todas as palavras na ementa). */
export function filtrarLeis(xml, query, max) {
  const root = fromstring(xml);
  const termos = query.toLowerCase().split(/\s+/).filter(Boolean);
  const candidatos = [];
  for (const doc of root.iter('documento')) {
    const ementa = (doc.findtext('ementa') || '').trim();
    if (!ementa) continue;
    const ementaLower = ementa.toLowerCase();
    if (termos.length && !termos.every((t) => ementaLower.includes(t))) continue;
    candidatos.push({
      numero: doc.findtext('numero') || '',
      normaNome: doc.findtext('normaNome') || 'Lei',
      ementa,
      dataassinatura: doc.findtext('dataassinatura') || '',
    });
    if (candidatos.length >= max) break;
  }
  return candidatos;
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(LISTA_URL, { params: { tipo: 'LEI' }, timeout: [15, 60] });
  resp.raise_for_status();
  const candidatos = filtrarLeis(resp.conteudo, query, max);

  const extrair = (item) => {
    const urnData = dataParaUrn(item.dataassinatura);
    const urlOrigem = urnData && item.numero
      ? `https://normas.leg.br/?urn=urn:lex:br:federal:lei:${urnData};${item.numero}` : '';
    let texto = item.ementa;
    if (item.dataassinatura) texto += `\n\nData de assinatura: ${item.dataassinatura}`;
    return { titulo: item.normaNome, texto, url_origem: urlOrigem };
  };

  // Sem chamada de rede por item — sem throttle entre salvamentos.
  return executarBuscaGenerica(candidatos, extrair, 'senado_leis', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de senado_materias.py: projetos de lei, PECs, MPs e demais matérias do
// Senado (Dados Abertos, /processo), sem chave — ementa, explicação e indexação.
// Com período, consulta em janelas de até 1 ano (limite do servidor).

import {
  aparar, deIso, ehErroRequisicao, executarBuscaGenerica, exigirJson, hoje, limitarMax, obter, pastaDocumentos,
  paraIso, resultadoVazio, somarDias,
} from './_base.js';

export const FONTE_META = {
  "id": "senado_materias",
  "nome": "Senado Federal — Projetos e matérias",
  "area": "direito",
  "descricao": "Projetos de lei, PECs, MPs e demais matérias em tramitação no Senado — ementa e indexação temática.",
  "requer_auth": false,
  "suporta_data": true,
  "suporta_autor": false
};

const PROCESSO_URL = 'https://legis.senado.leg.br/dadosabertos/processo';
const HEADERS = { Accept: 'application/json' };
const MAX_JANELAS = 10;
const SIGLAS_NORMATIVAS = ['PL ', 'PLS ', 'PLP ', 'PEC ', 'MPV ', 'PDL ', 'PRS ', 'PLV ', 'PDS '];

async function consultar(params) {
  const resp = await obter(PROCESSO_URL, { params, headers: HEADERS, timeout: [10, 30] });
  resp.raise_for_status();
  const dados = exigirJson(resp, 'Senado Federal');
  if (!Array.isArray(dados)) {
    throw new Error('Senado Federal mudou o formato de /dadosabertos/processo (esperada uma lista de matérias)');
  }
  return dados.filter((d) => d && typeof d === 'object' && !Array.isArray(d));
}

/** Janelas de até 1 ano, da mais recente para a mais antiga: [[ini, fim], ...] em ISO. */
export function janelas(dataInicio, dataFim) {
  let fim = dataFim ? deIso(dataFim) : hoje();
  const ini = dataInicio ? deIso(dataInicio) : somarDias(fim, -364);
  const lista = [];
  while (fim >= ini && lista.length < MAX_JANELAS) {
    const comeco = new Date(Math.max(ini.getTime(), somarDias(fim, -364).getTime()));
    lista.push([paraIso(comeco), paraIso(fim)]);
    fim = somarDias(comeco, -1);
  }
  return lista;
}

/** Mais recentes primeiro; proposições normativas antes de requerimentos, ofícios e mensagens. */
export function ordenar(materias) {
  const data = (m) => m.dataApresentacao || '';
  const porData = [...materias].sort((a, b) => (data(a) < data(b) ? 1 : data(a) > data(b) ? -1 : 0));
  const peso = (m) => (SIGLAS_NORMATIVAS.some((s) => String(m.identificacao || '').startsWith(s)) ? 0 : 1);
  return porData.sort((a, b) => peso(a) - peso(b));
}

export async function buscar({
  query, max_resultados, projeto_nome, data_inicio = '', data_fim = '', evento_cancelar, dispatch_event, raiz,
}) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  let materias = [];
  if (data_inicio || data_fim) {
    const vistos = new Set();
    for (const [ini, fim] of janelas(data_inicio, data_fim)) {
      if (evento_cancelar && evento_cancelar.is_set()) break;
      const lote = await consultar({ termo: query, dataInicioApresentacao: ini, dataFimApresentacao: fim });
      const novos = lote.filter((m) => !vistos.has(m.id));
      for (const m of novos) vistos.add(m.id);
      materias.push(...ordenar(novos));
      if (materias.length >= max) break;
    }
  } else {
    materias = ordenar(await consultar({ termo: query }));
  }

  const itens = materias.slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = async (item) => {
    const ementa = String(item.ementa || '').trim();
    if (!ementa) return null;
    let indexacao = '';
    let explicacao = '';
    try {
      const det = await obter(`${PROCESSO_URL}/${item.id}`, { headers: HEADERS, timeout: [10, 30] });
      if (det.ok && (det.headers.get('content-type') || '').toLowerCase().includes('json')) {
        const d = det.json();
        indexacao = String(d?.documento?.indexacao || '').trim();
        explicacao = String(d?.conteudo?.explicacaoEmenta || '').trim();
      }
    } catch (e) {
      // detalhe é enriquecimento — sem ele, fica a ementa
      if (!ehErroRequisicao(e) && e?.name !== 'JSONDecodeError' && !(e instanceof TypeError)) throw e;
    }

    const linhas = [
      item.tipoDocumento ? `Tipo: ${item.tipoDocumento}` : '',
      item.dataApresentacao ? `Apresentação: ${item.dataApresentacao}` : '',
      item.situacaoAtual ? `Situação atual: ${item.situacaoAtual}` : '',
      item.tramitando ? `Em tramitação: ${item.tramitando}` : '',
    ];
    const partes = [linhas.filter(Boolean).join('\n'), `--- EMENTA ---\n\n${ementa}`];
    if (explicacao) partes.push(`--- EXPLICAÇÃO DA EMENTA ---\n\n${explicacao}`);
    if (indexacao) partes.push(`--- INDEXAÇÃO ---\n\n${aparar(indexacao, ' .')}`);
    if (item.urlDocumento) partes.push(`Texto (PDF): ${item.urlDocumento}`);

    const codigo = item.codigoMateria;
    const url = codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}` : (item.urlDocumento || '');
    return { titulo: `Senado ${item.identificacao || 'Matéria'}`, texto: partes.filter(Boolean).join('\n\n'), url_origem: url };
  };

  return executarBuscaGenerica(itens, extrair, 'senado_materias', docDir, { evento_cancelar, dispatch_event, throttle: 0.5 });
}

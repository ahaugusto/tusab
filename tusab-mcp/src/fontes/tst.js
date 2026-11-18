// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de tst.py: acórdãos do Tribunal Superior do Trabalho (pesquisa
// textual do backend de jurisprudência), sem chave — ementa, dispositivo e
// inteiro teor, sem dados das partes (LGPD, ver _lgpd_juridico.js).

import {
  HEADERS_TUSABBOT, enviar, executarBuscaGenerica, exigirJson, htmlParaTexto, limitarMax, pastaDocumentos, resultadoVazio,
} from './_base.js';
import { limitarTexto, sanitizarTextoJuridico } from './_lgpd_juridico.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "tst",
  "nome": "TST — Jurisprudência",
  "area": "direito",
  "descricao": "Acórdãos do Tribunal Superior do Trabalho — ementa, dispositivo e inteiro teor, sem dados das partes.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const SEARCH_URL = 'https://jurisprudencia-backend.tst.jus.br/rest/pesquisa-textual';
const URL_FALLBACK = 'https://jurisprudencia.tst.jus.br/';
const TAMANHO_PAGINA = 5;

async function pesquisar(termo, pagina, tam) {
  const resp = await enviar(`${SEARCH_URL}/${pagina}/${tam}`, {
    json: { e: termo, tipos: ['ACORDAO'], orgao: 'TST' },
    headers: { ...HEADERS_TUSABBOT, Accept: 'application/json' },
    timeout: [10, 60],
  });
  resp.raise_for_status();
  const dados = exigirJson(resp, 'TST');
  const registros = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados.registros : undefined;
  if (!Array.isArray(registros)) {
    throw new Error("TST mudou o formato da resposta da pesquisa textual (campo 'registros' ausente) "
      + '— fonte indisponível até o adaptador ser atualizado');
  }
  const saida = registros.map((r) => {
    const reg = r && typeof r === 'object' ? r.registro : undefined;
    if (!reg || typeof reg !== 'object' || Array.isArray(reg)) {
      throw new Error(t('TST mudou o formato de \'registros[].registro\' — fonte indisponível até o adaptador ser atualizado'));
    }
    return reg;
  });
  return [saida, Math.trunc(Number(dados.totalRegistros || 0)) || 0];
}

async function coletar(termo, max, eventoCancelar) {
  const itens = [];
  let pagina = 1;
  while (itens.length < max) {
    if (eventoCancelar && eventoCancelar.is_set()) break;
    const [lote, total] = await pesquisar(termo, pagina, TAMANHO_PAGINA);
    itens.push(...lote);
    if (lote.length < TAMANHO_PAGINA || itens.length >= total) break;
    pagina += 1;
  }
  return itens.slice(0, max);
}

/** Consulta processual pública montada da numeração única CNJ do registro. */
export function urlProcesso(reg) {
  const n = reg.numeracaoUnica;
  const campos = ['numero', 'digito', 'ano', 'orgao', 'tribunal', 'vara'];
  if (!n || typeof n !== 'object') return URL_FALLBACK;
  const v = {};
  for (const k of campos) {
    const num = typeof n[k] === 'number' ? n[k] : (/^\s*[+-]?\d+\s*$/.test(String(n[k] ?? '')) ? Number(n[k]) : NaN);
    if (!Number.isInteger(num)) return URL_FALLBACK;
    v[k] = num;
  }
  const pad = (x, w) => (x < 0 ? `-${String(-x).padStart(w - 1, '0')}` : String(x).padStart(w, '0'));
  return 'https://consultaprocessual.tst.jus.br/consultaProcessual/consultaTstNumUnica.do'
    + `?consulta=Consultar&conscsjt=&numeroTst=${v.numero}&digitoTst=${pad(v.digito, 2)}&anoTst=${v.ano}`
    + `&orgaoTst=${v.orgao}&tribunalTst=${pad(v.tribunal, 2)}&varaTst=${pad(v.vara, 4)}&submit=Consultar`;
}

/** Campos que o backend esvaziou vêm como 'removido no backend'. */
function limpar(valor) {
  const v = typeof valor === 'string' ? valor.trim() : '';
  return v.toLowerCase() === 'removido no backend' ? '' : v;
}

export function montarAcordao(reg) {
  // Lista branca de campos — codCPFSignatario e nomes nunca são lidos.
  const ementa = limpar(reg.ementa);
  const dispositivo = limpar(reg.dispositivo);
  const teor = htmlParaTexto(limpar(reg.inteiroTeorHtml));
  if (!(ementa || teor)) return null;
  const orgao = reg.orgaoJudicante && typeof reg.orgaoJudicante === 'object' ? (reg.orgaoJudicante.descricao ?? '') : '';
  const meta = [
    orgao ? `Órgão julgador: ${orgao}` : '',
    reg.dtaJulgamento ? `Julgamento: ${reg.dtaJulgamento}` : '',
    reg.dtaPublicacao ? `Publicação: ${reg.dtaPublicacao}` : '',
  ];
  const partes = [meta.filter(Boolean).join('\n')];
  if (ementa) partes.push(`--- EMENTA ---\n\n${ementa}`);
  if (dispositivo) {
    partes.push(`--- DISPOSITIVO ---\n\nO colegiado decidiu${dispositivo.startsWith(',') ? dispositivo : `: ${dispositivo}`}`);
  }
  if (teor) partes.push(`--- INTEIRO TEOR ---\n\n${teor}`);
  const texto = limitarTexto(sanitizarTextoJuridico(partes.filter(Boolean).join('\n\n')));

  const numero = String(reg.numFormatado || '').trim();
  let titulo = numero ? `TST ${numero}` : 'Acórdão TST';
  if (orgao) titulo += ` — ${orgao}`;
  if (reg.dtaJulgamento) titulo += ` — ${reg.dtaJulgamento}`;
  return { titulo, texto, url_origem: urlProcesso(reg) };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const termo = query.trim();
  let itens = [];
  if (termo.split(/\s+/).filter(Boolean).length > 1 && !termo.includes('"')) {
    itens = await coletar(`"${termo}"`, max, evento_cancelar);
  }
  if (!itens.length) itens = await coletar(termo, max, evento_cancelar);
  if (!itens.length) return resultadoVazio();

  return executarBuscaGenerica(itens, montarAcordao, 'tst', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

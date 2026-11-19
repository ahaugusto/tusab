// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de capes_teses.py: Catálogo de Teses e Dissertações da CAPES, sem
// chave. A busca (POST JSON) traz os trabalhos; o resumo vem da página de cada
// trabalho na Plataforma Sucupira (span id="resumo" / id="palavras").

import {
  HEADERS_TUSABBOT, dormir, enviar, executarBuscaGenerica, exigirJson, fatiar, htmlParaTexto, limitarMax, obter,
  pastaDocumentos, resultadoVazio,
} from './_base.js';
import { t } from '../nucleo/idioma.js';

export const FONTE_META = {
  "id": "capes_teses",
  "nome": "CAPES — Catálogo de Teses e Dissertações",
  "area": "educacao",
  "descricao": "Teses e dissertações de programas de pós-graduação reconhecidos pela CAPES — resumo de cada trabalho.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const SEARCH_URL = 'https://catalogodeteses.capes.gov.br/catalogo-teses/rest/busca';
const TIMEOUT = [10, 30];
const MAX_CHARS = 200_000;

const RE_RESUMO = /<span[^>]*\bid="resumo"[^>]*>(.*?)<\/span>/s;
const RE_PALAVRAS = /<span[^>]*\bid="palavras"[^>]*>(.*?)<\/span>/s;

/** Página do Sucupira → [resumo, palavras-chave]. ['', ''] se não houver. */
export function extrairResumo(pagina) {
  // A página quebra linhas no meio da frase — normaliza os espaços do HTML antes;
  // quebras reais vêm de <br>/<p> e são preservadas por htmlParaTexto.
  const campo = (re) => {
    const m = re.exec(pagina);
    return m ? htmlParaTexto(m[1].replace(/\s+/g, ' ')) : '';
  };
  return [campo(RE_RESUMO), campo(RE_PALAVRAS)];
}

export function montarDocumento(item, resumo, palavras) {
  if (!resumo) return null;
  const titulo = String(item.titulo || '').trim() || 'Trabalho de conclusão';
  const ano = String(item.dataDefesa || '').slice(0, 4);
  const linhas = [titulo, ''];
  for (const [rotulo, valor] of [
    ['Grau', item.grauAcademico], ['Programa', item.nomePrograma], ['Instituição', item.instituicao], ['Ano de defesa', ano],
  ]) {
    if (valor) linhas.push(`${rotulo}: ${valor}`);
  }
  if (palavras) linhas.push(`Palavras-chave: ${palavras.replace(/;/g, '; ')}`);
  linhas.push('', 'Resumo:', resumo);
  return { titulo, texto: fatiar(linhas.join('\n'), 0, MAX_CHARS), url_origem: item.link ?? '' };
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await enviar(SEARCH_URL, {
    json: { termo: query, filtros: [], pagina: 1, registrosPorPagina: max },
    headers: { ...HEADERS_TUSABBOT, Accept: 'application/json' },
    timeout: TIMEOUT,
  });
  resp.raise_for_status();
  const dados = exigirJson(resp, FONTE_META.nome);
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || !('tesesDissertacoes' in dados)) {
    throw new Error("Catálogo de Teses da CAPES mudou o formato da resposta (campo 'tesesDissertacoes' ausente)");
  }
  const itens = (dados.tesesDissertacoes || []).filter((i) => i?.link).slice(0, max);
  if (!itens.length) return resultadoVazio();

  let paginasSemResumo = 0;

  const extrair = async (item) => {
    await dormir(0.5);
    const r = await obter(item.link, { headers: HEADERS_TUSABBOT, timeout: TIMEOUT });
    r.raise_for_status();
    const [resumo, palavras] = extrairResumo(r.texto);
    if (!resumo) paginasSemResumo += 1;
    return montarDocumento(item, resumo, palavras);
  };

  const resultado = await executarBuscaGenerica(itens, extrair, FONTE_META.id, docDir, { evento_cancelar, dispatch_event, throttle: 0 });
  if (resultado.total_salvos === 0 && paginasSemResumo === itens.length) {
    throw new Error(t('Plataforma Sucupira mudou o formato da página do trabalho (resumo não encontrado em nenhum resultado)'));
  }
  return resultado;
}

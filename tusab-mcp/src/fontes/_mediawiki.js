// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _mediawiki.py: conector genérico para wikis MediaWiki (Action API)
// — usado por wikisource_pt, wikilivros_pt e wikiversidade_pt. Não é uma fonte
// (sem FONTE_META). wikipedia.js tem a sua própria implementação, como no desktop.
//
// Busca:  action=query&list=search&srsearch=<termo>&srnamespace=0&srlimit=<n>
// Texto:  action=query&prop=extracts&explaintext=1&titles=<UM título>
// Fallback: action=parse&page=<título>&prop=text → parse.text["*"] (HTML)
//
// Achados do teste ao vivo (20/out/2026): nesses wikis o prop=extracts em lote
// é rebaixado para 1 título por resposta (por isso um título por chamada); o
// texto INTEGRAL interessa (sem exintro); páginas com extract vazio/curto caem
// para o parse; textos enormes são cortados com aviso e link. A Wikimedia
// limita por User-Agent (429 com Retry-After): uma nova tentativa, com teto.

import {
  HEADERS_TUSABBOT, executarBuscaGenerica, exigirJson, htmlParaTexto, obter, quote, resultadoVazio,
  dormir, tamanho, fatiar,
} from './_base.js';

const LIMITE_CHARS = 60_000;
const THROTTLE = 0.3;
const TIMEOUT = [10, 30];
const ESPERA_MAX_429 = 15.0;
const MIN_CHARS_EXTRACT = 300;
const MIN_CHARS_TEXTO = 150;

async function getJson(apiUrl, params, fonteNome, eventoCancelar) {
  let resp;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    resp = await obter(apiUrl, { headers: HEADERS_TUSABBOT, params, timeout: TIMEOUT });
    if (resp.status === 429 && tentativa === 0) {
      let espera = Number.parseFloat(resp.headers.get('retry-after') ?? '5');
      if (!Number.isFinite(espera)) espera = 5.0;
      espera = Math.max(1.0, Math.min(espera, ESPERA_MAX_429));
      if (eventoCancelar) {
        if (await eventoCancelar.wait(espera)) break;
      } else {
        await dormir(espera);
      }
      continue;
    }
    resp.raise_for_status();
    const dados = exigirJson(resp, fonteNome);
    if (dados && typeof dados === 'object' && 'error' in dados) {
      const erro = dados.error || {};
      throw new Error(`${fonteNome}: ${erro.code ?? ''} — ${erro.info ?? ''}`);
    }
    return dados;
  }
  resp.raise_for_status();
  return exigirJson(resp, fonteNome);
}

/** Corta o texto em LIMITE_CHARS (total, já contando o aviso). */
export function limitarTexto(texto, urlOrigem) {
  if (tamanho(texto) <= LIMITE_CHARS) return texto;
  const aviso = `\n\n[Texto truncado em ${LIMITE_CHARS.toLocaleString('en-US')} caracteres — íntegra em ${urlOrigem}]`.replace(/,/g, '.');
  let corte = fatiar(texto, 0, LIMITE_CHARS - tamanho(aviso));
  // Evita cortar no meio de uma palavra quando houver espaço perto do fim.
  const ultimoEspaco = corte.lastIndexOf(' ');
  if (ultimoEspaco >= Math.max(0, corte.length - 200) && ultimoEspaco > 0) corte = corte.slice(0, ultimoEspaco);
  return corte.trimEnd() + aviso;
}

/** https://pt.wikibooks.org/w/api.php + "Cálculo/Limites" → https://pt.wikibooks.org/wiki/C%C3%A1lculo/Limites */
export function urlPagina(apiUrl, titulo) {
  const i = apiUrl.lastIndexOf('/w/api.php');
  const raiz = i >= 0 ? apiUrl.slice(0, i) : apiUrl;
  return `${raiz}/wiki/${quote(titulo.replace(/ /g, '_'), '/:()')}`;
}

async function textoPorExtract(apiUrl, titulo, fonteNome, eventoCancelar) {
  const dados = await getJson(apiUrl, {
    action: 'query', prop: 'extracts', explaintext: 1, redirects: 1, titles: titulo, format: 'json',
  }, fonteNome, eventoCancelar);
  const paginas = dados?.query?.pages || {};
  for (const pagina of Object.values(paginas)) return String(pagina?.extract || '').trim();
  return '';
}

async function textoPorParse(apiUrl, titulo, fonteNome, eventoCancelar) {
  const dados = await getJson(apiUrl, {
    action: 'parse', page: titulo, prop: 'text', redirects: 1, disableeditsection: 1, disabletoc: 1, format: 'json',
  }, fonteNome, eventoCancelar);
  return htmlParaTexto(dados?.parse?.text?.['*'] ?? '');
}

/** Busca no wiki em `apiUrl` e salva o texto de cada página em `docDir`. */
export async function buscarMediawiki(apiUrl, fonteId, fonteNome, query, maxResultados, docDir, {
  evento_cancelar, dispatch_event,
} = {}) {
  const dados = await getJson(apiUrl, {
    action: 'query', list: 'search', srsearch: query, srnamespace: 0, srlimit: maxResultados, format: 'json',
  }, fonteNome, evento_cancelar);
  const titulos = (dados?.query?.search || []).filter((r) => r?.title).map((r) => r.title);
  if (!titulos.length) return resultadoVazio();

  const extrair = async (titulo) => {
    let texto = await textoPorExtract(apiUrl, titulo, fonteNome, evento_cancelar);
    if (tamanho(texto) < MIN_CHARS_EXTRACT) {
      // Página montada com predefinições/tabelas que o TextExtracts ignora.
      const textoParse = await textoPorParse(apiUrl, titulo, fonteNome, evento_cancelar);
      if (tamanho(textoParse) > tamanho(texto)) texto = textoParse;
    }
    if (tamanho(texto) < MIN_CHARS_TEXTO) return null;
    const urlOrigem = urlPagina(apiUrl, titulo);
    return { titulo, texto: limitarTexto(texto, urlOrigem), url_origem: urlOrigem };
  };

  return executarBuscaGenerica(titulos, extrair, fonteId, docDir, { evento_cancelar, dispatch_event, throttle: THROTTLE });
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _dspace7.py: conector genérico para repositórios institucionais
// DSpace 7 (REST API "Server"). Não é uma fonte por si só (sem FONTE_META):
// paho_iris, who_iris, fiocruz_arca, unasus_ares e ipea só declaram a base da
// API, o host do front e o FONTE_META, e delegam a busca pra cá.
//
//   GET {base}/discover/search/objects?query=<termo>&dsoType=ITEM&size=<n>&page=0
//   → _embedded.searchResult._embedded.objects[]._embedded.indexableObject
//     com metadata["dc.title"] e metadata["dc.description.abstract"] ([{value, language}])
//
// Achados do teste ao vivo (20/out/2026) que moldam o código:
// - o abstract pode vir em várias entradas, uma por idioma — juntamos todas;
// - parte dos itens não tem abstract: a query vai ao Solr como
//   `(<termo>) AND dc.description.abstract:*`; se o Solr rejeitar a sintaxe do
//   termo (HTTP 4xx/5xx), repete sem o filtro; item sem abstract é descartado;
// - texto integral opcional pelo bundle TEXT (o DSpace já extraiu o PDF); se
//   não existir, falhar, vier vazio ou grande demais, cai para o abstract.

import {
  ErroHTTP, MAX_RESULTADOS_PERMITIDO, executarBuscaGenerica, exigirJson, obter, resultadoVazio,
} from './_base.js';

const TAMANHO_PAGINA_MAX = 100; // limite de `size` aceito pelo DSpace 7
const FATOR_SOBRA = 2; // folga de candidatos por resultado pedido
const FILTRO_COM_ABSTRACT = 'dc.description.abstract:*';
const TEXTO_INTEGRAL_MAX_BYTES = 5 * 1024 * 1024;
const TEXTO_INTEGRAL_MIN_CHARS = 500;

/** Lista de valores não vazios de um campo DC, sem duplicatas, na ordem. */
export function valores(metadata, campo) {
  const vistos = [];
  for (const entrada of metadata?.[campo] || []) {
    const valor = String(entrada?.value || '').trim();
    if (valor && !vistos.includes(valor)) vistos.push(valor);
  }
  return vistos;
}

function urlItem(item, frontUrl) {
  if (item.handle) return `${frontUrl}/handle/${item.handle}`;
  return `${frontUrl}/items/${item.uuid ?? ''}`;
}

/** Texto puro já extraído pelo DSpace (bundle TEXT). "" se não houver. */
async function baixarTextoIntegral(baseApi, uuid, headers) {
  const resp = await obter(`${baseApi}/core/items/${uuid}/bundles`, {
    params: { embed: 'bitstreams' }, headers, timeout: [10, 30],
  });
  resp.raise_for_status();
  const bundles = exigirJson(resp, 'DSpace')?._embedded?.bundles || [];
  const bundleTexto = bundles.find((b) => b?.name === 'TEXT');
  if (!bundleTexto) return '';
  const bitstreams = bundleTexto?._embedded?.bitstreams?._embedded?.bitstreams || [];
  if (!bitstreams.length) return '';
  const bitstream = bitstreams[0];
  if ((bitstream.sizeBytes || 0) > TEXTO_INTEGRAL_MAX_BYTES) return '';
  const href = bitstream?._links?.content?.href;
  if (!href) return '';
  const respTxt = await obter(href, { headers, timeout: [10, 60] });
  respTxt.raise_for_status();
  const tipo = (respTxt.headers.get('content-type') || '').toLowerCase();
  if (!tipo.includes('text/plain')) return '';
  // Sem charset no cabeçalho, o DSpace grava esses .txt em UTF-8.
  const texto = (tipo.includes('charset') ? respTxt.texto : respTxt.textoUtf8).trim();
  return texto.length >= TEXTO_INTEGRAL_MIN_CHARS ? texto : '';
}

/**
 * Busca itens num DSpace 7, salva título + abstract (ou texto integral, se
 * `usarTextoIntegral`) como .txt em docDir. `baseApi` sem barra final.
 */
export async function buscarDspace7(baseApi, frontUrl, fonteMeta, query, maxResultados, docDir, {
  headers = {}, usarTextoIntegral = false, evento_cancelar, dispatch_event,
} = {}) {
  const max = Math.max(1, Math.min(Math.trunc(Number(maxResultados)), MAX_RESULTADOS_PERMITIDO));
  const tamanho = Math.min(max * FATOR_SOBRA, TAMANHO_PAGINA_MAX);
  const urlBusca = `${baseApi}/discover/search/objects`;

  const pesquisar = async (q) => {
    const r = await obter(urlBusca, { params: { query: q, dsoType: 'ITEM', size: tamanho, page: 0 }, headers, timeout: [10, 60] });
    r.raise_for_status();
    return r;
  };

  let resp;
  try {
    resp = await pesquisar(`(${query}) AND ${FILTRO_COM_ABSTRACT}`);
  } catch (e) {
    if (!(e instanceof ErroHTTP)) throw e;
    // Termo com sintaxe que o Solr rejeita → repete sem o filtro.
    resp = await pesquisar(query);
  }
  const dados = exigirJson(resp, fonteMeta.nome);
  const objetos = dados?._embedded?.searchResult?._embedded?.objects || [];

  const candidatos = [];
  for (const obj of objetos) {
    const item = obj?._embedded?.indexableObject || {};
    const metadata = item.metadata || {};
    const abstract = valores(metadata, 'dc.description.abstract').join('\n\n');
    if (!abstract) continue;
    const titulos = valores(metadata, 'dc.title');
    candidatos.push({
      uuid: item.uuid || '',
      titulo: titulos.length ? titulos[0] : (item.name || 'Sem título'),
      abstract,
      url_origem: urlItem(item, frontUrl),
    });
    if (candidatos.length >= max) break;
  }

  if (!candidatos.length) return resultadoVazio();

  const extrair = async (cand) => {
    let texto = '';
    if (usarTextoIntegral && cand.uuid) {
      try {
        texto = await baixarTextoIntegral(baseApi, cand.uuid, headers);
      } catch {
        texto = ''; // bundle ausente/erro → fallback silencioso para o abstract
      }
    }
    return { titulo: cand.titulo, texto: texto || cand.abstract, url_origem: cand.url_origem };
  };

  return executarBuscaGenerica(candidatos, extrair, fonteMeta.id, docDir, {
    evento_cancelar, dispatch_event,
    // Só há requisição por item quando busca o texto integral.
    throttle: usarTextoIntegral ? 1.0 : 0,
  });
}

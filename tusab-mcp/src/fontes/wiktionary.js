// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de wiktionary.py: dicionário multilíngue livre (en.wiktionary.org),
// sem chave — etimologia, pronúncia e definições, texto integral de cada verbete.

import { HEADERS_TUSABBOT, executarBuscaGenerica, limitarMax, obter, pastaDocumentos, resultadoVazio } from './_base.js';

export const FONTE_META = {
  "id": "wiktionary",
  "nome": "Wiktionary",
  "area": "antropologia",
  "descricao": "Dicionário multilíngue livre — etimologia, pronúncia e definições reais por idioma.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API_URL = 'https://en.wiktionary.org/w/api.php';

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const respBusca = await obter(API_URL, {
    headers: HEADERS_TUSABBOT,
    params: { action: 'query', list: 'search', srsearch: query, srlimit: max, format: 'json' },
    timeout: [10, 30],
  });
  respBusca.raise_for_status();
  const resultados = respBusca.json()?.query?.search || [];
  if (!resultados.length) return resultadoVazio();

  const titulos = resultados.map((r) => r.title);
  const respExtrai = await obter(API_URL, {
    headers: HEADERS_TUSABBOT,
    params: { action: 'query', prop: 'extracts', explaintext: 1, titles: titulos.join('|'), format: 'json' },
    timeout: [10, 45],
  });
  respExtrai.raise_for_status();
  const paginas = respExtrai.json()?.query?.pages || {};
  const extratos = new Map(Object.values(paginas).map((p) => [p?.title, p?.extract ?? '']));

  const extrair = (titulo) => {
    const texto = String(extratos.get(titulo) || '').trim();
    if (!texto) return null;
    return { titulo, texto, url_origem: `https://en.wiktionary.org/wiki/${titulo.replace(/ /g, '_')}` };
  };

  return executarBuscaGenerica(titulos, extrair, 'wiktionary', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de github.py: repositórios de código aberto do GitHub, sem chave —
// README, tópicos e linguagem.

import { executarBuscaGenerica, fatiar, limitarMax, obter, pastaDocumentos } from './_base.js';

export const FONTE_META = {
  "id": "github",
  "nome": "GitHub",
  "area": "tecnologia",
  "descricao": "Repositórios de código aberto — README, tópicos e linguagem.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const BASE_URL = 'https://api.github.com/search/repositories';
const README_MAX_CHARS = 20_000; // README raramente passa disso; o corpo é fatiado na indexação
const ACCEPT = { Accept: 'application/vnd.github+json' };

/** Melhor esforço — null se não existir README, der 404/403 (rate limit) ou qualquer outra falha. */
async function buscarReadme(fullName) {
  try {
    const resp = await obter(`https://api.github.com/repos/${fullName}/readme`, { headers: ACCEPT, timeout: [10, 20] });
    if (!resp.ok) return null;
    const dados = resp.json();
    if (dados?.encoding !== 'base64') return null;
    return fatiar(Buffer.from(String(dados.content), 'base64').toString('utf8'), 0, README_MAX_CHARS);
  } catch {
    return null;
  }
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(BASE_URL, { params: { q: query, per_page: max }, headers: ACCEPT, timeout: [10, 45] });
  resp.raise_for_status();
  const itens = resp.json()?.items || [];

  const extrair = async (item) => {
    const descricao = item.description || '';
    const fullName = item.full_name || '';
    const readme = fullName ? await buscarReadme(fullName) : null;
    if (!descricao && !readme) return null;
    const partes = descricao ? [descricao] : [];
    if (item.topics?.length) partes.push(`Tópicos: ${item.topics.join(', ')}`);
    if (item.language) partes.push(`Linguagem principal: ${item.language}`);
    partes.push(`${item.stargazers_count ?? 0} estrelas no GitHub`);
    if (readme) partes.push(`--- README ---\n${readme}`);
    return { titulo: fullName || 'Sem título', texto: partes.join('\n\n'), url_origem: item.html_url ?? '' };
  };

  // Cada item faz 1 chamada extra pro README, e o limite de 60/h é o gargalo real.
  return executarBuscaGenerica(itens, extrair, 'github', docDir, { evento_cancelar, dispatch_event, throttle: 0.5 });
}

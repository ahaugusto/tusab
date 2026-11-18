// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de codeberg.py: projetos de software livre no Codeberg (forja Git sem
// fins lucrativos, API Gitea), sem chave — README e descrição.

import {
  HEADERS_TUSABBOT, ehErroRequisicao, executarBuscaGenerica, exigirJson, fatiar, limitarMax, obter, pastaDocumentos,
  resultadoVazio, tamanho,
} from './_base.js';

export const FONTE_META = {
  "id": "codeberg",
  "nome": "Codeberg",
  "area": "tecnologia",
  "descricao": "Projetos de software livre no Codeberg (forja Git sem fins lucrativos) — README e descrição.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API = 'https://codeberg.org/api/v1';
const LIMITE_README = 60_000;
const NOMES_README = ['README.md', 'readme.md', 'README', 'README.rst'];

async function baixarReadme(repo) {
  const branch = repo.default_branch || '';
  for (const nome of NOMES_README) {
    let resp;
    try {
      resp = await obter(`${API}/repos/${repo.full_name}/raw/${nome}`, {
        headers: HEADERS_TUSABBOT, params: branch ? { ref: branch } : null, timeout: [10, 30],
      });
    } catch (e) {
      if (ehErroRequisicao(e)) return '';
      throw e;
    }
    if (resp.status === 200) return fatiar(resp.textoUtf8, 0, LIMITE_README);
  }
  return '';
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(`${API}/repos/search`, {
    headers: HEADERS_TUSABBOT, params: { q: query, limit: max, sort: 'stars', order: 'desc' }, timeout: [10, 30],
  });
  resp.raise_for_status();
  const corpo = exigirJson(resp, FONTE_META.nome);
  const repos = corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo.data : undefined;
  if (repos === undefined || repos === null) {
    throw new Error("Codeberg mudou o formato da busca de repositórios (sem o campo 'data')");
  }
  if (!repos.length) return resultadoVazio();

  const extrair = async (r) => {
    const descricao = String(r.description || '').trim();
    const readme = (await baixarReadme(r)).trim();
    if (!readme && tamanho(descricao) < 40) return null;
    const cabecalho = [`Repositório: ${r.full_name ?? ''}`, `Estrelas: ${r.stars_count ?? 0}`];
    if (r.topics?.length) cabecalho.push(`Tópicos: ${r.topics.slice(0, 12).join(', ')}`);
    const partes = [cabecalho.join(' | '), ...[descricao, readme].filter(Boolean)];
    return { titulo: r.full_name ?? '', texto: partes.join('\n\n'), url_origem: r.html_url ?? '' };
  };

  return executarBuscaGenerica(repos, extrair, 'codeberg', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}

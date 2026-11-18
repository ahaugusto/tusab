// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de gitlab.py: projetos de código aberto no GitLab.com, sem chave —
// README, descrição e tópicos.

import {
  HEADERS_TUSABBOT, ehErroRequisicao, executarBuscaGenerica, fatiar, limitarMax, obter, pastaDocumentos, quote,
  resultadoVazio, tamanho,
} from './_base.js';

export const FONTE_META = {
  "id": "gitlab",
  "nome": "GitLab",
  "area": "tecnologia",
  "descricao": "Projetos de código aberto no GitLab.com — README, descrição e tópicos.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

const API = 'https://gitlab.com/api/v4';
const LIMITE_README = 60_000;

async function baixarReadme(projeto) {
  const readmeUrl = projeto.readme_url || '';
  const branch = projeto.default_branch || '';
  const marcador = `/-/blob/${branch}/`;
  if (!branch || !readmeUrl.includes(marcador)) return '';
  const caminho = readmeUrl.slice(readmeUrl.indexOf(marcador) + marcador.length);
  try {
    const resp = await obter(`${API}/projects/${projeto.id}/repository/files/${quote(caminho, '')}/raw`, {
      headers: HEADERS_TUSABBOT, params: { ref: branch }, timeout: [10, 30],
    });
    if (resp.status !== 200) return '';
    return fatiar(resp.textoUtf8, 0, LIMITE_README);
  } catch (e) {
    if (ehErroRequisicao(e)) return '';
    throw e;
  }
}

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(`${API}/projects`, {
    headers: HEADERS_TUSABBOT,
    params: { search: query, order_by: 'star_count', sort: 'desc', per_page: max, simple: 'true' },
    timeout: [10, 30],
  });
  resp.raise_for_status();
  const projetos = resp.json();
  if (!Array.isArray(projetos)) throw new Error('GitLab mudou o formato da busca de projetos (esperava uma lista)');
  if (!projetos.length) return resultadoVazio();

  const extrair = async (p) => {
    const descricao = String(p.description || '').trim();
    const topicos = (p.topics?.length && p.topics) || (p.tag_list?.length && p.tag_list) || [];
    const readme = (await baixarReadme(p)).trim();
    if (!readme && tamanho(descricao) < 40) return null;
    const cabecalho = [`Projeto: ${p.path_with_namespace ?? ''}`, `Estrelas: ${p.star_count ?? 0}`];
    if (topicos.length) cabecalho.push(`Tópicos: ${topicos.slice(0, 12).join(', ')}`);
    const partes = [cabecalho.join(' | ')];
    if (descricao) partes.push(descricao);
    if (readme) partes.push(readme);
    return {
      titulo: p.name_with_namespace || (p.path_with_namespace ?? ''),
      texto: partes.join('\n\n'),
      url_origem: p.web_url ?? '',
    };
  };

  return executarBuscaGenerica(projetos, extrair, 'gitlab', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}

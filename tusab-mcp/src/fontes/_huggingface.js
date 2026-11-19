// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _huggingface.py: auxiliar comum das fontes do Hugging Face Hub
// (hf_modelos, hf_datasets, hf_papers). API pública, sem chave:
// - busca: GET https://huggingface.co/api/{models|datasets}?search=&limit=&sort=downloads
// - card:  GET https://huggingface.co/{prefixo}{id}/raw/main/README.md (Markdown + front matter YAML)
// - repositórios restritos ("gated") respondem 401 no README — o item é pulado.

import { HEADERS_TUSABBOT, obter, fatiar } from './_base.js';

export const HF = 'https://huggingface.co';
export const LIMITE_CARD = 60_000;

const RE_FRONT_MATTER = /^---\s*\n[\s\S]*?\n---\s*\n/;
const RE_IMAGEM_MD = /!\[[^\]]*\]\([^)]*\)/g;
const RE_HTML_TAG = /<[^>]+>/g;

/** Remove o front matter YAML, imagens e tags HTML soltas do README — mantém o Markdown. */
export function limparCard(markdown) {
  let texto = String(markdown || '').replace(RE_FRONT_MATTER, '');
  texto = texto.replace(RE_IMAGEM_MD, '').replace(RE_HTML_TAG, ' ');
  texto = texto.replace(/\n{3,}/g, '\n\n').trim();
  return fatiar(texto, 0, LIMITE_CARD);
}

/** tipo: 'models' ou 'datasets'. */
export async function buscarRepos(tipo, query, limite) {
  const resp = await obter(`${HF}/api/${tipo}`, {
    headers: HEADERS_TUSABBOT, params: { search: query, limit: limite, sort: 'downloads', direction: -1 }, timeout: [10, 30],
  });
  resp.raise_for_status();
  const dados = resp.json();
  if (!Array.isArray(dados)) throw new Error(`Hugging Face mudou o formato da busca de ${tipo} (esperava uma lista)`);
  return dados;
}

/** README limpo, ou null se o repositório for restrito (401/403) ou não tiver card (404). */
export async function baixarCard(prefixoUrl, repoId) {
  const resp = await obter(`${HF}/${prefixoUrl}${repoId}/raw/main/README.md`, { headers: HEADERS_TUSABBOT, timeout: [10, 30] });
  if ([401, 403, 404].includes(resp.status)) return null;
  resp.raise_for_status();
  return limparCard(resp.textoUtf8);
}

/** Linha de contexto com popularidade e tags. */
export function cabecalhoRepo(item, rotulo) {
  const tags = (item.tags || []).filter((t) => !String(t).includes(':')).slice(0, 12);
  const partes = [`${rotulo}: ${item.id ?? ''}`, `Downloads: ${item.downloads ?? 0}`, `Curtidas: ${item.likes ?? 0}`];
  if (item.pipeline_tag) partes.push(`Tarefa: ${item.pipeline_tag}`);
  if (tags.length) partes.push(`Tags: ${tags.join(', ')}`);
  return partes.join(' | ');
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de hf_papers.py: artigos de IA destacados pela comunidade do Hugging
// Face — abstract completo e link do arXiv.

import {
  HEADERS_TUSABBOT, colapsarEspacos, executarBuscaGenerica, limitarMax, obter, pastaDocumentos, resultadoVazio, tamanho,
} from './_base.js';
import { HF } from './_huggingface.js';

export const FONTE_META = {
  "id": "hf_papers",
  "nome": "Hugging Face — Papers",
  "area": "tecnologia",
  "descricao": "Artigos de IA destacados pela comunidade do Hugging Face — abstract completo e link do arXiv.",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const resp = await obter(`${HF}/api/papers/search`, { headers: HEADERS_TUSABBOT, params: { q: query }, timeout: [10, 30] });
  resp.raise_for_status();
  const dados = resp.json();
  if (!Array.isArray(dados)) throw new Error('Hugging Face mudou o formato da busca de papers (esperava uma lista)');
  const itens = dados.filter((d) => d?.paper?.summary).slice(0, max);
  if (!itens.length) return resultadoVazio();

  const extrair = (item) => {
    const p = item.paper;
    const titulo = colapsarEspacos(p.title || '');
    const resumo = colapsarEspacos(p.summary || '');
    if (!titulo || tamanho(resumo) < 100) return null;
    const autores = (p.authors || []).map((a) => a?.name ?? '').slice(0, 8);
    const linhas = [resumo];
    if (autores.length) linhas.push(`Autores: ${autores.filter(Boolean).join(', ')}`);
    if (p.publishedAt) linhas.push(`Publicado em: ${String(p.publishedAt).slice(0, 10)}`);
    if (p.ai_keywords?.length) linhas.push(`Palavras-chave: ${p.ai_keywords.slice(0, 10).join(', ')}`);
    if (p.id) linhas.push(`arXiv: https://arxiv.org/abs/${p.id}`);
    return { titulo, texto: linhas.join('\n\n'), url_origem: `${HF}/papers/${p.id ?? ''}` };
  };

  return executarBuscaGenerica(itens, extrair, 'hf_papers', docDir, { evento_cancelar, dispatch_event, throttle: 0 });
}

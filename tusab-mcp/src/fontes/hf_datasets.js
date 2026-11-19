// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de hf_datasets.py: conjuntos de dados abertos do Hugging Face Hub —
// dataset card completo (conteúdo, origem, licença).

import { executarBuscaGenerica, limitarMax, pastaDocumentos, resultadoVazio, tamanho } from './_base.js';
import { HF, baixarCard, buscarRepos, cabecalhoRepo } from './_huggingface.js';

export const FONTE_META = {
  "id": "hf_datasets",
  "nome": "Hugging Face — Datasets",
  "area": "tecnologia",
  "descricao": "Conjuntos de dados abertos do Hugging Face Hub — dataset card completo (conteúdo, origem, licença).",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const itens = await buscarRepos('datasets', query, Math.min(max * 2, 100));
  if (!itens.length) return resultadoVazio();
  let salvos = 0;

  const extrair = async (item) => {
    if (salvos >= max) return null;
    const card = await baixarCard('datasets/', item.id ?? '');
    if (!card || tamanho(card) < 200) return null;
    salvos += 1;
    return {
      titulo: `Dataset ${item.id}`,
      texto: `${cabecalhoRepo(item, 'Dataset')}\n\n${card}`,
      url_origem: `${HF}/datasets/${item.id}`,
    };
  };

  return executarBuscaGenerica(itens, extrair, 'hf_datasets', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}

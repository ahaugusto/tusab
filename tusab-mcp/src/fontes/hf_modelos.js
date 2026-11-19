// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de hf_modelos.py: modelos de IA abertos do Hugging Face Hub — model
// card completo de cada um. Pede o dobro: parte dos mais baixados é gated (sem card).

import { executarBuscaGenerica, limitarMax, pastaDocumentos, resultadoVazio, tamanho } from './_base.js';
import { HF, baixarCard, buscarRepos, cabecalhoRepo } from './_huggingface.js';

export const FONTE_META = {
  "id": "hf_modelos",
  "nome": "Hugging Face — Modelos",
  "area": "tecnologia",
  "descricao": "Modelos de IA abertos do Hugging Face Hub — model card completo de cada um (uso, treino, limitações).",
  "requer_auth": false,
  "suporta_data": false,
  "suporta_autor": false
};

export async function buscar({ query, max_resultados, projeto_nome, evento_cancelar, dispatch_event, raiz }) {
  const max = limitarMax(max_resultados);
  const docDir = pastaDocumentos(raiz, projeto_nome);

  const itens = await buscarRepos('models', query, Math.min(max * 2, 100));
  if (!itens.length) return resultadoVazio();
  let salvos = 0;

  const extrair = async (item) => {
    if (salvos >= max) return null;
    const card = await baixarCard('', item.id ?? '');
    if (!card || tamanho(card) < 200) return null;
    salvos += 1;
    return { titulo: `Modelo ${item.id}`, texto: `${cabecalhoRepo(item, 'Modelo')}\n\n${card}`, url_origem: `${HF}/${item.id}` };
  };

  return executarBuscaGenerica(itens, extrair, 'hf_modelos', docDir, { evento_cancelar, dispatch_event, throttle: 0.3 });
}

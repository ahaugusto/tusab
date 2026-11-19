// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Economia de tokens: quanto a IA recebeu do Tusab (trechos) × quanto receberia se as
// fontes inteiras fossem anexadas na conversa. Estimativa local (~4 caracteres por
// token): a contagem exata exigiria enviar o texto ao serviço da IA, o que o Tusab não faz.
// Guarda só números agregados — nunca a pergunta nem o texto (privacidade).

import path from 'node:path';
import { caminhos, dataIso, lerJson, salvarJson } from './caminhos.js';

export const CARACTERES_POR_TOKEN = 4;
export const estimarTokens = (texto) => Math.ceil(String(texto ?? '').length / CARACTERES_POR_TOKEN);
export const tokensDeCaracteres = (n) => Math.ceil((Number(n) || 0) / CARACTERES_POR_TOKEN);

const arquivo = (raiz) => path.join(caminhos(raiz).config, 'economia_tokens.json');
const vazio = () => ({ consultas: 0, tokens_enviados: 0, tokens_sem_tusab: 0, por_ferramenta: {}, por_dia: {} });

/** Soma uma consulta ao contador local. */
export function registrarConsulta(raiz, { ferramenta, enviados, semTusab }) {
  if (!raiz || !(semTusab > 0)) return;
  const dados = { ...vazio(), ...lerJson(arquivo(raiz), {}) };
  const somar = (alvo) => {
    alvo.consultas = (alvo.consultas || 0) + 1;
    alvo.tokens_enviados = (alvo.tokens_enviados || 0) + enviados;
    alvo.tokens_sem_tusab = (alvo.tokens_sem_tusab || 0) + Math.max(semTusab, enviados);
  };
  somar(dados);
  somar((dados.por_ferramenta[ferramenta] ??= {}));
  somar((dados.por_dia[dataIso()] ??= {}));
  // Só os últimos 90 dias.
  const dias = Object.keys(dados.por_dia).sort();
  for (const d of dias.slice(0, Math.max(0, dias.length - 90))) delete dados.por_dia[d];
  try { salvarJson(arquivo(raiz), dados, 2); } catch { /* medição nunca atrapalha a consulta */ }
}

const percentual = (enviados, sem) => (sem > 0 ? Math.round((1 - enviados / sem) * 1000) / 10 : 0);

/** Resumo para a tela e para a IA. */
export function resumoEconomia(raiz) {
  const d = { ...vazio(), ...lerJson(arquivo(raiz), {}) };
  return {
    estimativa: `aproximada (~${CARACTERES_POR_TOKEN} caracteres por token)`,
    consultas: d.consultas,
    tokens_enviados: d.tokens_enviados,
    tokens_sem_tusab: d.tokens_sem_tusab,
    tokens_economizados: Math.max(0, d.tokens_sem_tusab - d.tokens_enviados),
    economia_percentual: percentual(d.tokens_enviados, d.tokens_sem_tusab),
    por_ferramenta: Object.fromEntries(Object.entries(d.por_ferramenta).map(([k, v]) => [k, {
      ...v, economia_percentual: percentual(v.tokens_enviados, v.tokens_sem_tusab),
    }])),
    ultimos_dias: Object.entries(d.por_dia).sort().slice(-30).map(([dia, v]) => ({ dia, ...v })),
  };
}

export function zerarEconomia(raiz) {
  salvarJson(arquivo(raiz), vazio(), 2);
  return { ok: true };
}

/**
 * Teste "com e sem o Tusab" para uma lista de perguntas (ex.: 20 perguntas reais de um cliente).
 * Para cada pergunta: tokens dos trechos que a IA receberia × tokens das fontes inteiras
 * desses trechos (anexar só o que importa) × tokens do projeto inteiro (anexar tudo).
 */
export function medirPerguntas(indice, projeto, perguntas, { limite = 8 } = {}) {
  const tokensProjeto = tokensDeCaracteres(indice.caracteresDoProjeto(projeto));
  const linhas = perguntas.map((pergunta) => {
    const achados = indice.buscar(pergunta, { projeto, limite });
    const enviados = estimarTokens(achados.map((a) => `${a.titulo_trecho} ${a.link || ''}\n${a.texto}`).join('\n\n'));
    const fontes = [...new Set(achados.map((a) => a.fonte_id))];
    const fontesInteiras = tokensDeCaracteres(indice.caracteresDasFontes(fontes));
    return { pergunta, trechos: achados.length, fontes: fontes.length, tokens_tusab: enviados, tokens_fontes_inteiras: fontesInteiras, tokens_projeto_inteiro: tokensProjeto };
  });
  const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
  return {
    estimativa: `aproximada (~${CARACTERES_POR_TOKEN} caracteres por token)`,
    projeto,
    perguntas: linhas,
    total: {
      tokens_tusab: soma('tokens_tusab'),
      tokens_fontes_inteiras: soma('tokens_fontes_inteiras'),
      tokens_projeto_inteiro: soma('tokens_projeto_inteiro'),
      economia_vs_fontes_inteiras: percentual(soma('tokens_tusab'), soma('tokens_fontes_inteiras')),
      economia_vs_projeto_inteiro: percentual(soma('tokens_tusab'), soma('tokens_projeto_inteiro')),
      sem_resposta: linhas.filter((l) => !l.trechos).length,
    },
  };
}

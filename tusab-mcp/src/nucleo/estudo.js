// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Modo Estudo e Digest — porte de tusab_engine/api/router_estudo.py, router_digest.py
// e da parte de leitura/gravação de tusab_engine/scheduler.py, com o MESMO formato
// em disco do desktop (um projeto estudado no desktop abre aqui e vice-versa):
//
//   data/neural/{prefixo}/management/flashcards.json           último lote: {canal, gerado_em, flashcards:[{id,pergunta,resposta}]}
//   data/neural/{prefixo}/management/postits.json              último lote: {canal, gerado_em, postits:[str]}
//   data/neural/{prefixo}/management/resumo_estudo.md          último resumo (Markdown puro)
//   data/neural/{prefixo}/management/flashcards_progresso.json {card_id: {repeticoes, intervalo_dias, fator_facilidade, ultima_revisao, proxima_revisao}}
//   data/neural/{prefixo}/management/digest_AAAA-MM-DD.md      digest semanal
//   data/neural/{prefixo}/estudo/_manifest.json                [{id, tipo, titulo, criado_em, projeto, tema, n_itens, arquivo_txt, arquivo_json, arquivo_audio?}] (mais recente primeiro)
//   data/neural/{prefixo}/estudo/estudo_{tipo}_{AAAAMMDD_HHMMSS}.txt   texto achatado (TITULO/DATA/AVISO) — pesquisável
//   data/neural/{prefixo}/estudo/estudo_{tipo}_{AAAAMMDD_HHMMSS}.json  dados estruturados (array de cards, array de post-its ou string do resumo)
//
// Na extensão NÃO existe LLM: quem gera o conteúdo é a IA do usuário, que chama as
// ferramentas MCP. As rotas de geração do desktop (POST /agent/study, POST
// /agent/digest/{p}) respondem "peça à sua IA"; TTS responde indisponível.
//
// ═══ ENTRADA DAS FUNÇÕES DE GRAVAÇÃO (para as ferramentas MCP) ═══════════════
// Todas devolvem { ok: true, ... } ou { error: true, message } (mensagem em
// português, pronta para a IA corrigir e tentar de novo). Nada é gravado se a
// entrada for recusada. O projeto precisa existir (pasta data/neural/{prefixo}).
//
// salvarFlashcards(raiz, projeto, cards, { tema?, fontes?, titulo? })
//   cards: array de 1 a 30 objetos { pergunta, resposta } (aceita também
//          question/answer ou front/back, como o desktop). Cada campo: texto
//          não vazio, pergunta até 500 caracteres, resposta até 2.000. Perguntas
//          repetidas (mesmo id) são recusadas. Também aceita uma string com o
//          array JSON (ou o formato "Q: … / A: …"), lida pelo mesmo parser do desktop.
//   O id de cada card é sha1(pergunta sem espaços nas pontas)[:12], igual ao
//   desktop: a mesma pergunta mantém o progresso de revisão entre lotes.
//   Grava management/flashcards.json (substitui o último lote) + artefato no kanban.
//   Resposta: { ok, flashcards, resumo: '', postits: [], total, artefatos: [entrada] }
//   (o mesmo JSON do POST /agent/study do desktop).
//
// salvarPostits(raiz, projeto, postits, { tema?, fontes?, titulo? })
//   postits: array de 1 a 30 itens; cada item é uma string (ou { texto } / { text })
//            não vazia de até 400 caracteres (o desktop pede ~20 palavras). Também
//            aceita string com array JSON ou lista com marcadores (-, •, *, 1.).
//   Grava management/postits.json + artefato. Resposta: { ok, flashcards: [], resumo: '', postits, total, artefatos }
//
// salvarResumo(raiz, projeto, texto, { tema?, fontes?, titulo? })
//   texto: Markdown, 1 a 30.000 caracteres. O desktop pede: tema central (1 frase),
//          conceitos-chave (3-5 tópicos), insights (2-3 parágrafos), lacunas.
//   Grava management/resumo_estudo.md + artefato. Resposta: { ok, flashcards: [], resumo, postits: [], total: 0, artefatos }
//
// salvarDocumentoEstudo(raiz, projeto, texto, { titulo?, tema?, fontes? })
//   texto: Markdown, 1 a 60.000 caracteres. Só da extensão: o que a IA gera e não é resumo
//   (quiz, mapa mental, plano de aula, prova, nota técnica, roteiro...), para o usuário abrir
//   depois na tela do Tusab (aba Materiais). Só o artefato; não mexe em management/.
//
// salvarArtefato(raiz, projeto, { tipo, conteudo, titulo?, tema?, fontes? })
//   tipo: 'flashcards' | 'postits' | 'resumo' (os três que o desktop gera; o
//   "ambos" do desktop é flashcards + resumo, duas chamadas) | 'documento'. conteudo: o mesmo
//   formato de cards/postits/texto acima. Encaminha para a função do tipo.
//
//   Opções comuns: tema (até 200 caracteres; entra no título "Flashcards — {tema} (data)"),
//   fontes (até 50 nomes de arquivo/itens usados; o desktop guarda só a contagem, em n_itens),
//   titulo (até 150 caracteres; substitui o título automático).
//
// salvarDigest(raiz, projeto, texto)
//   texto: a síntese em 3 a 5 tópicos com "•" (1 a 20.000 caracteres). Grava
//   management/digest_{hoje}.md com o mesmo cabeçalho do desktop. Recusa se não
//   houver arquivo novo na semana (como o desktop). Resposta: { ok, data, filename, arquivos_novos }
//   arquivosNovosDaSemana(raiz, projeto) lista o que a IA deve resumir.
// ════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { caminhos, dataBr, dataIso, dentroDe, escreverAtomico, lerJson, salvarJson, sanitizarNome } from './caminhos.js';
import { t } from './idioma.js';

// ── Limites ──────────────────────────────────────────────────────────────────

export const LIMITES = Object.freeze({
  projeto: 120, // StudyRequest.projeto_nome (max_length=120)
  tema: 200, // StudyRequest.tema
  titulo: 150, // RenomearArtefatoRequest.titulo
  artefatoId: 60,
  cardId: 32,
  itens: 30, // StudyRequest.n_cards (le=30)
  fontes: 50, // StudyRequest.arquivos (max_length=50)
  pergunta: 500,
  resposta: 2000,
  postit: 400,
  resumo: 30000,
  documento: 60000,
  digest: 20000,
});

export const TIPOS_ARTEFATO = ['flashcards', 'resumo', 'postits', 'documento'];
const ROTULOS = { resumo: 'Resumo', flashcards: 'Flashcards', postits: 'Post-its', documento: 'Documento' };
const AVISO_IA = 'AVISO: Conteúdo gerado por IA via Modo Estudo — derivado do material original, não é fonte primária.';
const JANELA_DIGEST_MS = 7 * 24 * 3600 * 1000;

/** Erro de validação do corpo do pedido (o FastAPI responderia 422). */
export class ErroValidacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.status = 422;
  }
}

// ── Equivalentes exatos do Python ────────────────────────────────────────────

// str.strip() do Python (str.isspace): difere do trim() do JS em \x1c-\x1f, \x85 e \ufeff.
const ESPACO_PY = '\t\n\x0b\x0c\r\x1c\x1d\x1e\x1f \x85\xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000';
export function pyStrip(s) {
  const t = String(s);
  let i = 0;
  let j = t.length;
  while (i < j && ESPACO_PY.includes(t[i])) i++;
  while (j > i && ESPACO_PY.includes(t[j - 1])) j--;
  return t.slice(i, j);
}

/**
 * round() do Python: arredonda o valor binário EXATO, com empate para o par.
 * (Math.round empata para cima e toFixed também; 12.5 → 12 no Python, 13 no JS.)
 */
export function pyRound(x, casas = 0) {
  if (!Number.isFinite(x)) return x;
  const negativo = x < 0;
  const exato = Math.abs(x).toFixed(100); // expansão decimal exata do double
  const [inteira, frac] = exato.split('.');
  const mantidos = frac.slice(0, casas);
  const resto = frac.slice(casas);
  const digitos = inteira + mantidos;
  let subir = false;
  if (resto[0] > '5') subir = true;
  else if (resto[0] === '5') {
    if (/[1-9]/.test(resto.slice(1))) subir = true;
    else subir = Number(digitos.at(-1)) % 2 === 1; // empate exato → par
  }
  let n = BigInt(digitos);
  if (subir) n += 1n;
  let s = n.toString().padStart(casas + 1, '0');
  if (casas > 0) s = `${s.slice(0, -casas)}.${s.slice(-casas)}`;
  const v = Number(s);
  return negativo && v !== 0 ? -v : v;
}

function dois(n) {
  return String(n).padStart(2, '0');
}

/** time.strftime('%d/%m/%Y %H:%M') */
function dataHoraBr(d) {
  return `${dataBr(d)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** time.strftime('%Y%m%d_%H%M%S') */
function carimbo(d) {
  return `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}_${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}`;
}

/** time.strftime('%Y-%m-%dT%H:%M:%S') */
function isoLocal(d) {
  return `${dataIso(d)}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

/** Leitura em modo texto do Python: \r\n e \r viram \n. */
function lerTexto(caminho) {
  return fs.readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function objetoSimples(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ── Caminhos ─────────────────────────────────────────────────────────────────

/** re.sub(r'[<>:"/\\|?*\s]', '_', nome).strip('_') do desktop ('' = inválido). */
export function prefixoProjeto(nome) {
  return sanitizarNome(String(nome ?? ''), '');
}

function dirProjeto(raiz, prefixo) {
  return path.join(caminhos(raiz).neural, prefixo);
}
function dirGestao(raiz, prefixo) {
  return path.join(dirProjeto(raiz, prefixo), 'management');
}
function dirEstudo(raiz, prefixo) {
  return path.join(dirProjeto(raiz, prefixo), 'estudo');
}
function caminhoManifesto(raiz, prefixo) {
  return path.join(dirEstudo(raiz, prefixo), '_manifest.json');
}
function caminhoProgresso(raiz, prefixo) {
  return path.join(dirGestao(raiz, prefixo), 'flashcards_progresso.json');
}

/** Nome vindo do manifesto → caminho dentro de estudo/ (ou null se tentar sair da pasta). */
function arquivoDoEstudo(raiz, prefixo, nome) {
  if (!nome || typeof nome !== 'string' || nome !== path.basename(nome)) return null;
  const alvo = path.join(dirEstudo(raiz, prefixo), nome);
  return dentroDe(dirEstudo(raiz, prefixo), alvo) ? alvo : null;
}

// ── Flashcards: id, validação e parsers (iguais ao desktop) ──────────────────

/** _id_flashcard: sha1(pergunta.strip())[:12] — base da repetição espaçada. */
export function idFlashcard(pergunta) {
  return crypto.createHash('sha1').update(pyStrip(pergunta), 'utf8').digest('hex').slice(0, 12);
}

function pyStr(v) {
  // str(x or y or …) do Python para os tipos que um JSON traz.
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  return JSON.stringify(v);
}

function primeiroVerdadeiro(...valores) {
  for (const v of valores) {
    if (v && !(Array.isArray(v) && !v.length) && !(objetoSimples(v) && !Object.keys(v).length)) return v;
  }
  return '';
}

/** _validar_cards: descarta itens sem pergunta/resposta (leniente, para texto de modelo). */
export function validarCards(dados) {
  const resultado = [];
  for (const item of dados) {
    if (!objetoSimples(item)) continue;
    const pergunta = pyStrip(pyStr(primeiroVerdadeiro(item.pergunta, item.question, item.front)));
    const resposta = pyStrip(pyStr(primeiroVerdadeiro(item.resposta, item.answer, item.back)));
    if (pergunta && resposta) resultado.push({ id: idFlashcard(pergunta), pergunta, resposta });
  }
  return resultado;
}

/**
 * _parsear_flashcards_json: JSON direto → primeiro bloco [...] → "Q:/A:".
 * Diferença deliberada: no fallback Q:/A: o desktop devolve cards SEM id (o
 * progresso de revisão ficaria sem chave); aqui eles passam por validarCards.
 */
export function parsearFlashcardsJson(texto) {
  const t = pyStrip(texto);
  try {
    const dados = JSON.parse(t);
    if (Array.isArray(dados)) return validarCards(dados);
  } catch { /* próxima estratégia */ }
  const bloco = t.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (bloco) {
    try {
      const dados = JSON.parse(bloco[0]);
      if (Array.isArray(dados)) return validarCards(dados);
    } catch { /* próxima estratégia */ }
  }
  const pares = [...`${t}\n`.matchAll(/Q:\s*([\s\S]+?)\nA:\s*([\s\S]+?)(?=\n(?:\d+\.|Q:)|$)/g)];
  if (pares.length) return validarCards(pares.map((m) => ({ pergunta: m[1], resposta: m[2] })));
  return [];
}

/** _parsear_postits_json: JSON direto → bloco [...] → linhas com marcador. */
export function parsearPostitsJson(texto) {
  const t = pyStrip(texto);
  const normalizar = (dados) => {
    const itens = [];
    for (const x of dados) {
      let s;
      if (typeof x === 'string') s = pyStrip(x);
      else if (objetoSimples(x)) s = pyStrip(pyStr(primeiroVerdadeiro(x.texto, x.text)));
      else continue;
      if (s) itens.push(s);
    }
    return itens;
  };
  try {
    const dados = JSON.parse(t);
    if (Array.isArray(dados)) {
      const itens = normalizar(dados);
      if (itens.length) return itens;
    }
  } catch { /* próxima estratégia */ }
  const bloco = t.match(/\[\s*(?:"|\{)[\s\S]*?\]/);
  if (bloco) {
    try {
      const dados = JSON.parse(bloco[0]);
      if (Array.isArray(dados)) {
        const itens = normalizar(dados);
        if (itens.length) return itens;
      }
    } catch { /* próxima estratégia */ }
  }
  return [...t.matchAll(/^\s*(?:[-•*]|\d+[.)])\s*(.+)$/gm)].map((m) => pyStrip(m[1])).filter(Boolean);
}

// ── Repetição espaçada (SM-2), idêntica a _aplicar_sm2 ───────────────────────

function numeroOu(estado, campo, padrao) {
  const v = objetoSimples(estado) ? estado[campo] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : padrao;
}

/**
 * SM-2 simplificado. qualidade 0-5 (a interface usa 1/3/5). `hoje` só para testes.
 * Mesmas contas em ponto flutuante do Python e o mesmo round() (empate para o par).
 */
export function aplicarSm2(estado, qualidade, hoje = new Date()) {
  let repeticoes = numeroOu(estado, 'repeticoes', 0);
  let intervalo = numeroOu(estado, 'intervalo_dias', 0);
  let ef = numeroOu(estado, 'fator_facilidade', 2.5);

  if (qualidade < 3) {
    repeticoes = 0;
    intervalo = 1;
  } else {
    if (repeticoes === 0) intervalo = 1;
    else if (repeticoes === 1) intervalo = 6;
    else intervalo = pyRound(intervalo * ef);
    repeticoes += 1;
  }

  ef = Math.max(1.3, ef + (0.1 - (5 - qualidade) * (0.08 + (5 - qualidade) * 0.02)));

  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const proxima = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + intervalo);
  return {
    repeticoes,
    intervalo_dias: intervalo,
    fator_facilidade: pyRound(ef, 2),
    ultima_revisao: dataIso(dia),
    proxima_revisao: dataIso(proxima),
  };
}

function lerProgresso(raiz, prefixo) {
  const dados = lerJson(caminhoProgresso(raiz, prefixo), {});
  return objetoSimples(dados) ? dados : {};
}

// ── Manifesto de artefatos ───────────────────────────────────────────────────

/**
 * _ler_manifest_estudo: a pasta é a fonte da verdade. Entradas cujo .txt ou .json
 * sumiu saem, e o manifesto podado é regravado.
 */
function lerManifesto(raiz, prefixo) {
  const p = caminhoManifesto(raiz, prefixo);
  if (!fs.existsSync(p)) return [];
  const dados = lerJson(p, null);
  if (dados === null) return [];
  const manifesto = Array.isArray(dados) ? dados : [];
  const validos = [];
  let orfa = false;
  for (const entrada of manifesto) {
    const txt = objetoSimples(entrada) ? arquivoDoEstudo(raiz, prefixo, entrada.arquivo_txt) : null;
    const jsn = objetoSimples(entrada) ? arquivoDoEstudo(raiz, prefixo, entrada.arquivo_json) : null;
    if (txt && jsn && fs.existsSync(txt) && fs.existsSync(jsn)) validos.push(entrada);
    else orfa = true;
  }
  if (orfa) salvarJson(p, validos, 2);
  return validos;
}

function formatarTextoIndexavel(tipo, dados) {
  if (tipo === 'flashcards') return dados.map((c) => `P: ${c.pergunta}\nR: ${c.resposta}`).join('\n\n');
  if (tipo === 'postits') return dados.map((p) => `- ${p}`).join('\n');
  return String(dados);
}

/** _salvar_estudo_indexavel: .txt achatado + .json estruturado + entrada no manifesto. */
function salvarEstudoIndexavel(raiz, prefixo, projetoNome, tipo, tema, dados, { nItens = 0, titulo = '', agora = new Date() } = {}) {
  const texto = pyStrip(formatarTextoIndexavel(tipo, dados));
  if (!texto) return null;
  const pasta = dirEstudo(raiz, prefixo);
  fs.mkdirSync(pasta, { recursive: true });
  const manifesto = lerManifesto(raiz, prefixo);

  // O desktop usa o segundo atual como id; duas gravações no mesmo segundo
  // sobrescreveriam os arquivos. Aqui o carimbo avança até ficar livre (mesmo formato).
  let quando = new Date(agora.getTime());
  const ocupado = (ts) => manifesto.some((e) => e.id === `${ts}_${tipo}`)
    || fs.existsSync(path.join(pasta, `estudo_${tipo}_${ts}.txt`))
    || fs.existsSync(path.join(pasta, `estudo_${tipo}_${ts}.json`));
  while (ocupado(carimbo(quando))) quando = new Date(quando.getTime() + 1000);

  const ts = carimbo(quando);
  const criadoEm = dataHoraBr(quando);
  const temaLimpo = pyStrip(tema || '');
  const tituloFinal = titulo || `${ROTULOS[tipo] || tipo} — ${temaLimpo || projetoNome} (${criadoEm})`;
  const nomeBase = `estudo_${tipo}_${ts}`;
  const entrada = {
    id: `${ts}_${tipo}`,
    tipo,
    titulo: tituloFinal,
    criado_em: criadoEm,
    projeto: projetoNome,
    tema: temaLimpo,
    n_itens: nItens,
    arquivo_txt: `${nomeBase}.txt`,
    arquivo_json: `${nomeBase}.json`,
  };
  escreverAtomico(path.join(pasta, entrada.arquivo_txt), `TITULO: ${tituloFinal}\nDATA: ${criadoEm}\n${AVISO_IA}\n\n${texto}\n`);
  salvarJson(path.join(pasta, entrada.arquivo_json), dados, 2);
  manifesto.unshift(entrada);
  salvarJson(caminhoManifesto(raiz, prefixo), manifesto, 2);
  return entrada;
}

// ── Validação da entrada vinda da IA ─────────────────────────────────────────

class Recusa extends Error {}

function texto(v, nome, max) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') throw new Recusa(t('{nome}: precisa ser um texto.', { nome }));
  const s = pyStrip(v);
  if (!s) throw new Recusa(t('{nome}: está vazio.', { nome }));
  if (s.length > max) throw new Recusa(t('{nome}: tem {length} caracteres (máximo {max}).', { nome, length: s.length, max }));
  return s;
}

function quantidade(lista, nome) {
  if (!lista.length) throw new Recusa(t('Nenhum {nome} válido foi enviado.', { nome }));
  if (lista.length > LIMITES.itens) throw new Recusa(t('São {length} {nome}s; o máximo por vez é {itens}.', { length: lista.length, nome, itens: LIMITES.itens }));
}

function normalizarCards(cards) {
  if (typeof cards === 'string') {
    const lidos = parsearFlashcardsJson(cards);
    if (!lidos.length) throw new Recusa(t('Não encontrei flashcards no texto. Envie um array [{"pergunta": "...", "resposta": "..."}].'));
    cards = lidos;
  }
  if (!Array.isArray(cards)) throw new Recusa('Envie os flashcards como um array [{"pergunta": "...", "resposta": "..."}].');
  quantidade(cards, 'flashcard');
  const vistos = new Map();
  return cards.map((item, i) => {
    const n = i + 1;
    if (!objetoSimples(item)) throw new Recusa(`Flashcard n.º ${n}: precisa ser um objeto {"pergunta", "resposta"}.`);
    const p = item.pergunta ?? item.question ?? item.front;
    const r = item.resposta ?? item.answer ?? item.back;
    if (p === undefined || p === null || p === '') throw new Recusa(`Flashcard n.º ${n}: falta a pergunta.`);
    if (r === undefined || r === null || r === '') throw new Recusa(`Flashcard n.º ${n}: falta a resposta.`);
    const pergunta = texto(p, `Flashcard n.º ${n}, pergunta`, LIMITES.pergunta);
    const resposta = texto(r, `Flashcard n.º ${n}, resposta`, LIMITES.resposta);
    const id = idFlashcard(pergunta);
    if (vistos.has(id)) throw new Recusa(t('Os flashcards n.º {v} e {n} têm a mesma pergunta.', { v: vistos.get(id), n }));
    vistos.set(id, n);
    return { id, pergunta, resposta };
  });
}

function normalizarPostits(postits) {
  if (typeof postits === 'string') {
    const lidos = parsearPostitsJson(postits);
    if (!lidos.length) throw new Recusa(t('Não encontrei post-its no texto. Envie um array ["ponto-chave 1", "ponto-chave 2"].'));
    postits = lidos;
  }
  if (!Array.isArray(postits)) throw new Recusa(t('Envie os post-its como um array de textos ["ponto-chave 1", "ponto-chave 2"].'));
  quantidade(postits, 'post-it');
  return postits.map((item, i) => {
    const v = objetoSimples(item) ? (item.texto ?? item.text) : item;
    return texto(v, `Post-it n.º ${i + 1}`, LIMITES.postit);
  });
}

function opcoesComuns({ tema = '', fontes = [], titulo = '' } = {}) {
  if (tema !== undefined && tema !== null && typeof tema !== 'string') throw new Recusa(t('tema: precisa ser um texto.'));
  const temaLimpo = pyStrip(tema || '');
  if (temaLimpo.length > LIMITES.tema) throw new Recusa(t('tema: tem {length} caracteres (máximo {tema}).', { length: temaLimpo.length, tema: LIMITES.tema }));
  if (fontes !== undefined && fontes !== null && !Array.isArray(fontes)) throw new Recusa(t('fontes: precisa ser uma lista de nomes.'));
  const lista = fontes || [];
  if (lista.length > LIMITES.fontes) throw new Recusa(t('fontes: são {length}; o máximo é {fontes}.', { length: lista.length, fontes: LIMITES.fontes }));
  if (lista.some((f) => typeof f !== 'string' || !f.trim())) throw new Recusa(t('fontes: cada item precisa ser um nome de arquivo ou título.'));
  let tituloLimpo = '';
  if (titulo !== undefined && titulo !== null && titulo !== '') tituloLimpo = texto(titulo, 'titulo', LIMITES.titulo);
  return { tema: temaLimpo, nItens: lista.length, titulo: tituloLimpo };
}

function projetoExistente(raiz, projeto) {
  if (typeof projeto !== 'string' || !projeto.trim()) throw new Recusa(t('Informe o projeto.'));
  const nome = projeto.trim();
  if (nome.length > LIMITES.projeto) throw new Recusa(t('projeto: máximo {projeto} caracteres.', { projeto: LIMITES.projeto }));
  const prefixo = prefixoProjeto(nome);
  if (!prefixo) throw new Recusa(t('Informe um nome de projeto válido.'));
  const dir = dirProjeto(raiz, prefixo);
  if (!dentroDe(caminhos(raiz).neural, dir) || !fs.existsSync(dir)) {
    throw new Recusa(t('Projeto \'{nome}\' não encontrado. Use um projeto que já existe no Tusab.', { nome }));
  }
  return { nome, prefixo };
}

function protegido(fn) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Recusa) return { error: true, message: e.message };
    return { error: true, message: t('Erro ao salvar: {message}', { message: e.message }) };
  }
}

// ── Gravação vinda da IA ─────────────────────────────────────────────────────

export function salvarFlashcards(raiz, projeto, cards, opcoes = {}) {
  return protegido(() => {
    const { nome, prefixo } = projetoExistente(raiz, projeto);
    const comuns = opcoesComuns(opcoes);
    const flashcards = normalizarCards(cards);
    const agora = opcoes.agora || new Date();
    salvarJson(path.join(dirGestao(raiz, prefixo), 'flashcards.json'), { canal: nome, gerado_em: isoLocal(agora), flashcards }, 2);
    const entrada = salvarEstudoIndexavel(raiz, prefixo, nome, 'flashcards', comuns.tema, flashcards, { ...comuns, agora });
    return { ok: true, flashcards, resumo: '', postits: [], total: flashcards.length, artefatos: entrada ? [entrada] : [] };
  });
}

export function salvarPostits(raiz, projeto, postits, opcoes = {}) {
  return protegido(() => {
    const { nome, prefixo } = projetoExistente(raiz, projeto);
    const comuns = opcoesComuns(opcoes);
    const lista = normalizarPostits(postits);
    const agora = opcoes.agora || new Date();
    salvarJson(path.join(dirGestao(raiz, prefixo), 'postits.json'), { canal: nome, gerado_em: isoLocal(agora), postits: lista }, 2);
    const entrada = salvarEstudoIndexavel(raiz, prefixo, nome, 'postits', comuns.tema, lista, { ...comuns, agora });
    return { ok: true, flashcards: [], resumo: '', postits: lista, total: lista.length, artefatos: entrada ? [entrada] : [] };
  });
}

export function salvarResumo(raiz, projeto, textoResumo, opcoes = {}) {
  return protegido(() => {
    const { nome, prefixo } = projetoExistente(raiz, projeto);
    const comuns = opcoesComuns(opcoes);
    if (typeof textoResumo !== 'string') throw new Recusa('Envie o resumo como texto (Markdown).');
    const resumo = textoResumo.replace(/\r\n?/g, '\n');
    if (!pyStrip(resumo)) throw new Recusa(t('O resumo está vazio.'));
    if (resumo.length > LIMITES.resumo) throw new Recusa(t('O resumo tem {length} caracteres (máximo {resumo}).', { length: resumo.length, resumo: LIMITES.resumo }));
    const agora = opcoes.agora || new Date();
    escreverAtomico(path.join(dirGestao(raiz, prefixo), 'resumo_estudo.md'), resumo);
    const entrada = salvarEstudoIndexavel(raiz, prefixo, nome, 'resumo', comuns.tema, resumo, { ...comuns, agora });
    return { ok: true, flashcards: [], resumo, postits: [], total: 0, artefatos: entrada ? [entrada] : [] };
  });
}

export function salvarDocumentoEstudo(raiz, projeto, textoDoc, opcoes = {}) {
  return protegido(() => {
    const { nome, prefixo } = projetoExistente(raiz, projeto);
    const comuns = opcoesComuns(opcoes);
    if (typeof textoDoc !== 'string') throw new Recusa(t('Envie o documento como texto (Markdown).'));
    const doc = textoDoc.replace(/\r\n?/g, '\n');
    if (!pyStrip(doc)) throw new Recusa(t('O documento está vazio.'));
    if (doc.length > LIMITES.documento) throw new Recusa(t('O documento tem {length} caracteres (máximo {max}).', { length: doc.length, max: LIMITES.documento }));
    const entrada = salvarEstudoIndexavel(raiz, prefixo, nome, 'documento', comuns.tema, doc, { ...comuns, agora: opcoes.agora || new Date() });
    return { ok: true, flashcards: [], resumo: '', postits: [], total: 0, artefatos: entrada ? [entrada] : [] };
  });
}

export function salvarArtefato(raiz, projeto, { tipo, conteudo, ...opcoes } = {}) {
  if (tipo === 'flashcards') return salvarFlashcards(raiz, projeto, conteudo, opcoes);
  if (tipo === 'postits') return salvarPostits(raiz, projeto, conteudo, opcoes);
  if (tipo === 'resumo') return salvarResumo(raiz, projeto, conteudo, opcoes);
  if (tipo === 'documento') return salvarDocumentoEstudo(raiz, projeto, conteudo, opcoes);
  return { error: true, message: t('Tipo inválido. Use: {v}.', { v: TIPOS_ARTEFATO.join(', ') }) };
}

// ── Leitura e uso (rotas /agent/study/*) ─────────────────────────────────────

/** GET /agent/study/{projeto} */
export function lerEstudo(raiz, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { flashcards: [], resumo: null, total: 0 };
  const gestao = dirGestao(raiz, prefixo);
  let flashcards = [];
  const dados = lerJson(path.join(gestao, 'flashcards.json'), null);
  if (objetoSimples(dados)) flashcards = dados.flashcards ?? [];
  let resumo = null;
  try { resumo = lerTexto(path.join(gestao, 'resumo_estudo.md')); } catch { /* sem resumo */ }
  return { flashcards, resumo, total: Array.isArray(flashcards) ? flashcards.length : 0 };
}

/**
 * GET /agent/study/itens/{projeto}: itens indexados, agregados por arquivo.
 * Recebe o Indice da extensão (data/tusab.sqlite). 'arquivo' é o nome do .txt
 * (como no desktop); `aba` é 'youtube' | 'documento' | 'texto'.
 */
export function listarItensEstudo(indice, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { error: true, message: t('Projeto não especificado.') };
  indice.atualizarSeMudou();
  const linhas = indice.db.selectObjects(`
    SELECT f.id, f.arquivo, f.tipo, f.titulo, (SELECT COUNT(*) FROM trechos t WHERE t.fonte_id = f.id) AS n
      FROM fontes f WHERE f.projeto = ? ORDER BY f.id`, [prefixo]);
  if (!linhas.length) return { error: true, message: t('Índice não encontrado para \'{projeto}\'. Indexe a base primeiro.', { projeto }) };
  const agregados = new Map();
  for (const l of linhas) {
    const arquivo = path.posix.basename(String(l.arquivo || ''));
    if (!arquivo) continue;
    if (!agregados.has(arquivo)) agregados.set(arquivo, { arquivo, titulo: l.titulo || arquivo, aba: l.tipo || 'documento', n_chunks: 0 });
    agregados.get(arquivo).n_chunks += Number(l.n) || 0;
  }
  const itens = [...agregados.values()].sort((a, b) => {
    const x = a.titulo.toLowerCase();
    const y = b.titulo.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return { ok: true, itens };
}

function validarCorpoProjeto(corpo) {
  if (!objetoSimples(corpo)) throw new ErroValidacao(t('Pedido inválido.'));
  const nome = corpo.projeto_nome;
  if (typeof nome !== 'string' || nome.length > LIMITES.projeto) throw new ErroValidacao(t('projeto_nome inválido.'));
  return nome;
}

/** POST /agent/study/revisar  corpo { projeto_nome, card_id, qualidade 0-5 }. Lança ErroValidacao (422). */
export function revisarCard(raiz, corpo, { hoje } = {}) {
  const projetoNome = validarCorpoProjeto(corpo);
  const cardId = corpo.card_id;
  if (typeof cardId !== 'string' || cardId.length > LIMITES.cardId) throw new ErroValidacao(t('card_id inválido.'));
  let q = corpo.qualidade;
  if (typeof q === 'string' && /^\s*-?\d+\s*$/.test(q)) q = Number(q);
  if (typeof q !== 'number' || !Number.isInteger(q) || q < 0 || q > 5) throw new ErroValidacao(t('qualidade deve ser um inteiro de 0 a 5.'));
  const prefixo = prefixoProjeto(projetoNome);
  if (!prefixo) return { error: true, message: t('Projeto não especificado.') };
  const progresso = lerProgresso(raiz, prefixo);
  const novo = aplicarSm2(progresso[cardId] || {}, q, hoje);
  progresso[cardId] = novo;
  fs.mkdirSync(dirGestao(raiz, prefixo), { recursive: true });
  salvarJson(caminhoProgresso(raiz, prefixo), progresso, 2);
  return { ok: true, card_id: cardId, ...novo };
}

/** GET /agent/study/revisao/{projeto} */
export function progressoRevisao(raiz, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { progresso: {} };
  return { progresso: lerProgresso(raiz, prefixo) };
}

/**
 * Fila de revisão de hoje (para a IA; o desktop calcula isso na tela): todos os
 * flashcards do projeto (último lote + artefatos salvos, sem repetir id) que nunca
 * foram revisados ou cuja proxima_revisao já chegou. → { hoje, total, cards: [{id, pergunta, resposta, proxima_revisao}] }
 */
export function filaRevisao(raiz, projeto, { hoje = new Date() } = {}) {
  const prefixo = prefixoProjeto(projeto);
  const dia = dataIso(hoje);
  if (!prefixo) return { hoje: dia, total: 0, cards: [] };
  const todos = new Map();
  const juntar = (lista) => {
    if (!Array.isArray(lista)) return;
    for (const c of lista) if (objetoSimples(c) && typeof c.id === 'string' && !todos.has(c.id)) todos.set(c.id, c);
  };
  juntar(lerEstudo(raiz, projeto).flashcards);
  for (const e of lerManifesto(raiz, prefixo)) {
    if (e.tipo === 'flashcards') juntar(lerJson(arquivoDoEstudo(raiz, prefixo, e.arquivo_json), []));
  }
  const progresso = lerProgresso(raiz, prefixo);
  const cards = [...todos.values()]
    .filter((c) => !progresso[c.id] || !(String(progresso[c.id].proxima_revisao || '') > dia))
    .map((c) => ({ id: c.id, pergunta: c.pergunta, resposta: c.resposta, proxima_revisao: progresso[c.id]?.proxima_revisao ?? null }));
  return { hoje: dia, total: cards.length, cards };
}

/** GET /agent/study/artefatos/{projeto} */
export function listarArtefatos(raiz, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { artefatos: [] };
  return { artefatos: lerManifesto(raiz, prefixo) };
}

function acharArtefato(raiz, projeto, artefatoId) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { erro: { error: true, message: t('Projeto não especificado.') } };
  const manifesto = lerManifesto(raiz, prefixo);
  const entrada = manifesto.find((e) => e.id === artefatoId);
  if (!entrada) return { erro: { error: true, message: t('Artefato não encontrado.') } };
  return { prefixo, manifesto, entrada };
}

/** GET /agent/study/artefato/{projeto}/{id} */
export function lerArtefato(raiz, projeto, artefatoId) {
  const { erro, prefixo, entrada } = acharArtefato(raiz, projeto, artefatoId);
  if (erro) return erro;
  try {
    const dados = JSON.parse(fs.readFileSync(arquivoDoEstudo(raiz, prefixo, entrada.arquivo_json), 'utf8').replace(/^\uFEFF/, ''));
    return { ok: true, artefato: entrada, dados };
  } catch (e) {
    return { error: true, message: t('Erro ao carregar artefato: {message}', { message: e.message }) };
  }
}

/** POST /agent/study/artefato/renomear  corpo { projeto_nome, artefato_id, titulo }. Lança ErroValidacao (422). */
export function renomearArtefato(raiz, corpo) {
  const projetoNome = validarCorpoProjeto(corpo);
  const { artefato_id: id, titulo } = corpo;
  if (typeof id !== 'string' || id.length > LIMITES.artefatoId) throw new ErroValidacao(t('artefato_id inválido.'));
  if (typeof titulo !== 'string' || !titulo.trim() || titulo.length > LIMITES.titulo) {
    throw new ErroValidacao(t('O título precisa ter de 1 a {titulo} caracteres.', { titulo: LIMITES.titulo }));
  }
  const { erro, prefixo, manifesto, entrada } = acharArtefato(raiz, projetoNome, id);
  if (erro) return erro;
  entrada.titulo = pyStrip(titulo);
  salvarJson(caminhoManifesto(raiz, prefixo), manifesto, 2);
  return { ok: true, artefato: entrada };
}

/** DELETE /agent/study/artefato/{projeto}/{id}: arquivos (.txt, .json, .wav) + entrada do manifesto. */
export function excluirArtefato(raiz, projeto, artefatoId) {
  const { erro, prefixo, manifesto, entrada } = acharArtefato(raiz, projeto, artefatoId);
  if (erro) return erro;
  for (const chave of ['arquivo_txt', 'arquivo_json', 'arquivo_audio']) {
    const alvo = arquivoDoEstudo(raiz, prefixo, entrada[chave]);
    if (alvo) try { fs.rmSync(alvo, { force: true }); } catch { /* como o desktop: segue */ }
  }
  salvarJson(caminhoManifesto(raiz, prefixo), manifesto.filter((e) => e.id !== artefatoId), 2);
  return { ok: true };
}

/**
 * GET /export/flashcards/{projeto}: o mesmo CSV "pergunta;resposta" do desktop.
 * Devolve { download: { nome, tipo, conteudo: Buffer } } ou { error, message } (JSON, status 200).
 */
export function exportarFlashcardsAnki(raiz, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { error: true, message: t('Projeto não especificado.') };
  const p = path.join(dirGestao(raiz, prefixo), 'flashcards.json');
  if (!fs.existsSync(p)) return { error: true, message: t('Nenhum flashcard encontrado para \'{projeto}\'. Gere os flashcards primeiro.', { projeto }) };
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return { error: true, message: t('Erro ao ler flashcards: {message}', { message: e.message }) };
  }
  const flashcards = objetoSimples(dados) && Array.isArray(dados.flashcards) ? dados.flashcards : [];
  if (!flashcards.length) return { error: true, message: t('Nenhum flashcard para exportar.') };
  const campo = (v) => (v === undefined || v === null ? '' : pyStr(v)).replaceAll(';', ',').replaceAll('\n', ' ');
  const csv = flashcards.map((fc) => `${campo(fc?.pergunta)};${campo(fc?.resposta)}`).join('\n');
  return { download: { nome: `tusab_${prefixo}_flashcards.csv`, tipo: 'text/csv; charset=utf-8', conteudo: Buffer.from(csv, 'utf8') } };
}

// ── Geração: na extensão quem gera é a IA do usuário ─────────────────────────

const PEDIDOS = {
  flashcards: (n) => t('crie {n} flashcards', { n }),
  postits: (n) => t('crie {n} post-its', { n }),
  resumo: () => t('crie um resumo de estudo'),
  ambos: (n) => t('crie {n} flashcards e um resumo de estudo', { n }),
};

/**
 * POST /agent/study na extensão: não gera; devolve { error: true, message, gerar_pela_ia: true, pedido }
 * (a interface já mostra `message` quando `error` vem true). Com `indice`, os itens
 * selecionados entram no pedido pelo título.
 */
export function pedidoGeracaoEstudo(corpo, { indice = null } = {}) {
  const c = objetoSimples(corpo) ? corpo : {};
  const tipo = c.tipo ?? 'flashcards';
  if (!Object.hasOwn(PEDIDOS, tipo)) return { error: true, message: t('Tipo inválido. Use: flashcards, resumo, postits ou ambos.') };
  const nome = String(c.projeto_nome || c.canal_nome || '');
  const prefixo = prefixoProjeto(nome);
  if (!prefixo) return { error: true, message: t('Projeto não especificado.') };
  const n = Number.isInteger(c.n_cards) && c.n_cards >= 1 && c.n_cards <= LIMITES.itens ? c.n_cards : 10;
  const tema = typeof c.tema === 'string' ? c.tema.trim().slice(0, LIMITES.tema) : '';
  let pedido = PEDIDOS[tipo](n);
  if (tema) pedido += t(' sobre {tema}', { tema });
  pedido += t(' do projeto {projeto}', { projeto: nome.trim() });
  const arquivos = Array.isArray(c.arquivos) ? c.arquivos.filter((a) => typeof a === 'string' && a).slice(0, LIMITES.fontes) : [];
  if (arquivos.length) {
    let titulos = arquivos;
    if (indice) {
      const r = listarItensEstudo(indice, nome);
      const porArquivo = new Map((r.itens || []).map((i) => [i.arquivo, i.titulo]));
      titulos = arquivos.map((a) => porArquivo.get(a) || a);
    }
    const mostrados = titulos.slice(0, 5).join('; ');
    pedido += t(', usando só: {lista}', { lista: mostrados }) + (titulos.length > 5 ? t(' e mais {n}', { n: titulos.length - 5 }) : '');
  }
  return {
    error: true,
    gerar_pela_ia: true,
    tipo,
    pedido,
    message: t('Na extensão, quem gera é a sua IA. Peça à sua IA: ‘{pedido}’. O resultado aparece aqui no Estudo.', { pedido }),
  };
}

/** TTS (POST /agent/tts e POST /agent/study/artefato/{p}/{id}/audio). GET /agent/tts/status → { disponivel: false }. */
export function ttsIndisponivel() {
  return { error: true, message: t('TTS não disponível nesta edição do Tusab.') };
}

// ── Digest semanal ───────────────────────────────────────────────────────────

/** _arquivos_novos: youtube/, documents/ e texts/ (sem recursão, como o desktop) com mtime < 7 dias. */
export function arquivosNovosDaSemana(raiz, projeto, agora = Date.now()) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return [];
  const corte = agora - JANELA_DIGEST_MS;
  const novos = [];
  for (const sub of ['youtube', 'documents', 'texts']) {
    const pasta = path.join(dirProjeto(raiz, prefixo), sub);
    let nomes = [];
    try { nomes = fs.readdirSync(pasta); } catch { continue; }
    for (const nome of nomes) {
      if (nome.startsWith('_')) continue;
      try {
        if (fs.statSync(path.join(pasta, nome)).mtimeMs > corte) novos.push({ nome, sub });
      } catch { /* sumiu */ }
    }
  }
  return novos;
}

/** GET /agent/digest/{projeto} → { digests: [{ data, preview, filename }] } (mais recente primeiro). */
export function listarDigests(raiz, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { digests: [] };
  const gestao = dirGestao(raiz, prefixo);
  let nomes = [];
  try { nomes = fs.readdirSync(gestao); } catch { return { digests: [] }; }
  const digests = [];
  for (const nome of nomes) {
    if (!(nome.startsWith('digest_') && nome.endsWith('.md'))) continue;
    let preview = '';
    try { preview = pyStrip(lerTexto(path.join(gestao, nome)).slice(0, 300).slice(0, 200)); } catch { /* vazio */ }
    digests.push({ data: nome.slice('digest_'.length, -'.md'.length), preview, filename: nome });
  }
  digests.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return { digests };
}

/** POST /agent/digest/{projeto} na extensão: { ok: false, message, gerar_pela_ia, pedido } (formato do desktop). */
export function pedidoGeracaoDigest(raiz, projeto) {
  const prefixo = prefixoProjeto(projeto);
  if (!prefixo) return { ok: false, message: t('Projeto inválido.') };
  const novos = arquivosNovosDaSemana(raiz, projeto);
  if (!novos.length) return { ok: false, message: t('Nenhum arquivo novo esta semana.') };
  const pedido = t('crie o digest da semana do projeto {v}', { v: String(projeto).trim() });
  return {
    ok: false,
    gerar_pela_ia: true,
    pedido,
    arquivos_novos: novos.length,
    message: t('Na extensão, quem gera é a sua IA. Peça à sua IA: ‘{pedido}’ ({length} arquivo(s) novo(s)).', { pedido, length: novos.length }),
  };
}

/** Grava management/digest_{hoje}.md no formato do desktop (com síntese). */
export function salvarDigest(raiz, projeto, sintese, { agora = new Date() } = {}) {
  return protegido(() => {
    const { prefixo } = projetoExistente(raiz, projeto);
    if (typeof sintese !== 'string') throw new Recusa(t('Envie o digest como texto.'));
    const corpo = pyStrip(sintese.replace(/\r\n?/g, '\n'));
    if (!corpo) throw new Recusa(t('O digest está vazio.'));
    if (corpo.length > LIMITES.digest) throw new Recusa(t('O digest tem {length} caracteres (máximo {digest}).', { length: corpo.length, digest: LIMITES.digest }));
    const novos = arquivosNovosDaSemana(raiz, projeto, agora.getTime());
    if (!novos.length) throw new Recusa(t('Nenhum arquivo novo esta semana.'));
    const data = dataIso(agora);
    const filename = `digest_${data}.md`;
    const conteudo = corpo.startsWith('# Digest da semana')
      ? `${corpo}\n`
      : `# Digest da semana — ${data}\n\n> Gerado automaticamente pelo Tusab · ${novos.length} arquivo(s) novo(s)\n\n${corpo}\n`;
    escreverAtomico(path.join(dirGestao(raiz, prefixo), filename), conteudo);
    return { ok: true, data, filename, arquivos_novos: novos.length };
  });
}

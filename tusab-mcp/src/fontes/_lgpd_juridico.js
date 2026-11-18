// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de _lgpd_juridico.py: salvaguardas de privacidade compartilhadas pelas
// fontes de jurisprudência (stf, tcu, tst) — Lei 13.709/2018 (LGPD).
//
// Princípio de minimização (LGPD, art. 6º, III): o corpus local só precisa do
// conteúdo jurídico. Dados pessoais de partes, advogados e signatários não são
// gravados em disco. Defesa em camadas:
// 1. cada adaptador escolhe explicitamente quais campos da API viram texto;
// 2. blocos de qualificação das partes dentro do inteiro teor são removidos
//    (cabeçalho em colunas do STF, linhas "RECTE.(S): ..." do extrato de ata,
//    "em que é Recorrente FULANO e Recorrido EMPRESA" do TST);
// 3. os nomes de pessoa colhidos nesses blocos (e, no TCU, dos campos de
//    responsáveis/advogados, lidos só em memória) viram um dicionário de
//    redação: toda ocorrência no texto corrido vira "[nome omitido — LGPD]";
// 4. CPF (inclusive "XXX.956.260-XX") e inscrição na OAB são mascarados.
// Pessoas jurídicas e entes públicos ficam no texto. Risco residual: pessoa
// citada só no texto corrido, sem bloco de qualificação, não é detectável sem NER.
//
// Diferenças de motor de regex tratadas aqui: o \w e o \b do Python são Unicode
// (aqui viram [\p{L}\p{N}_] com a flag u) e o (?i:...) com escopo é expandido
// para classes maiúscula/minúscula.

export const LIMITE_CHARS_DOCUMENTO = 200_000;

const AVISO_PARTES = '[qualificação das partes omitida — LGPD]';
const AVISO_NOME = '[nome omitido — LGPD]';
const W = '\\p{L}\\p{N}_';

/** Torna um trecho de regex insensível a caixa (equivale ao (?i:...) do Python). */
function semCaixa(padrao) {
  let saida = '';
  let emClasse = false;
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === '\\') { saida += c + padrao[++i]; continue; }
    if (c === '[') { emClasse = true; saida += c; continue; }
    if (c === ']') { emClasse = false; saida += c; continue; }
    const lo = c.toLowerCase();
    const up = c.toUpperCase();
    if (lo === up || /[^\p{L}]/u.test(c)) { saida += c; continue; }
    saida += emClasse ? lo + up : `[${lo}${up}]`;
  }
  return saida;
}

const RE_CPF = new RegExp(`(?<![${W}.])[X\\d]{3}\\.?[X\\d]{3}\\.?[X\\d]{3}-[X\\d]{2}(?![${W}])`, 'gu');
const RE_OAB = new RegExp(
  '\\d{1,3}(?:\\.\\d{3})*\\s*/\\s*OAB\\s*-?\\s*[A-Z]{2}'
  + '|OAB\\s*[-/]\\s*[A-Z]{2}\\s*(?:n[ºo°]\\s*)?\\d{1,3}(?:\\.?\\d{3})*(?:-?[A-Z])?'
  + '|\\(\\d{3,7}[A-Z]?/[A-Z]{2}\\)',
  'g',
);

// Rótulo de parte do STF: "RECTE.(S)", "ADV.(A/S)", "PROC.(A/S)(ES)", "AM. CURIAE.".
const ROTULO_PARTE = '[A-ZÀ-Ü][A-ZÀ-Ü. ]{1,30}\\.?\\s*\\((?:S|A/S|ES|AS|A)\\)(?:\\s*\\([A-Z/]+\\))*';
const RE_LINHA_ROTULO = new RegExp(
  '^\\s*(?:RELATORA?(?:\\(A\\))?|REDATORA?(?:\\(A\\))?\\s+DO\\s+AC[ÓO]RD[ÃA]O|REVISORA?(?:\\(A\\))?'
  + `|${ROTULO_PARTE}|AM\\.\\s*CURIAE\\.?)\\s*$`,
);
// Extrato de ata: rótulo e valor na mesma linha — "AGTE.(S): M.X.Q.S.".
const RE_ROTULO_COM_VALOR = new RegExp(`^[ \\t]*(${ROTULO_PARTE})[ \\t]*:(.*)$`, 'gm');

const SECOES_STF = [
  'RELATÓRIO', 'RELATORIO', 'VOTO', 'EMENTA', 'ACÓRDÃO', 'ACORDAO', 'EXTRATODEATA',
  'DEBATE', 'ANTECIPAÇÃO', 'ESCLARECIMENTO', 'OBSERVAÇÃO', 'CONFIRMAÇÃO', 'ADITAMENTO',
  'DECISÃO', 'DECISAO', 'APARTE', 'EXPLICAÇÃO', 'QUESTÃODEORDEM', 'PROPOSTA',
  'RETIFICAÇÃO', 'MANIFESTAÇÃO', 'INTEIROTEOR', 'SUPREMOTRIBUNALFEDERAL',
];

const ROTULOS_TST = 'Recorrentes?|Agravantes?|Embargantes?|Reclamantes?|Autora?|Autores|Impetrantes?|Requerentes?'
  + '|Suscitantes?|Exequentes?|Recorrid[oa]s?|Agravad[oa]s?|Embargad[oa]s?|Reclamad[oa]s?|R[ée]us?'
  + '|Requerid[oa]s?|Suscitad[oa]s?|Executad[oa]s?|Impetrad[oa]s?|Interessad[oa]s?';
const RE_QUALIFICACAO_EM_QUE = new RegExp(
  `(em\\s+que\\s+(?:é|são|figuram?\\s+como)\\s+(?:${semCaixa(ROTULOS_TST)}))`
  + '(.{0,1500}?)'
  + '(\\n[ \\t]*\\.[ \\t]*(?=\\n|$)|[ \\t]\\.[ \\t]*(?=\\n|$)|\\.[ \\t]*\\n(?=[ \\t]*[A-ZÀ-Ü](?:[a-zà-ü]|[ \\t]+[a-zà-ü])))',
  'gs',
);
const RE_SEPARA_PARTES_TST = new RegExp(
  `(?:(?<![${W}])(?:e\\s+)?(?:é|são)\\s+(?:${ROTULOS_TST})(?![${W}]))|\\s+e\\s+|\\n|,|(?:^|\\s)(?:${ROTULOS_TST})(?=\\s|$)`,
  'iu',
);

// Termos que indicam pessoa jurídica / ente público (não é dado pessoal).
const INSTITUCIONAL = [
  'UNIÃO', 'UNIAO', 'ESTADO', 'MUNICÍPIO', 'MUNICIPIO', 'DISTRITO FEDERAL', 'MINISTÉRIO', 'MINISTERIO',
  'PROCURADOR', 'PROCURADORIA', 'ADVOCACIA', 'ADVOGADO-GERAL', 'DEFENSOR', 'DEFENSORIA', 'ASSEMBLEIA',
  'PARTIDO', 'ASSOCIAÇÃO', 'ASSOCIACAO', 'SINDICATO', 'CONFEDERAÇÃO', 'FEDERAÇÃO', 'LTDA', 'S.A', 'S/A',
  'EIRELI', ' ME ', 'BANCO', 'EMPRESA', 'COMPANHIA', ' CIA', 'INSTITUTO', 'CONSELHO', 'TRIBUNAL', 'MESA ',
  'PRESIDENTE', 'GOVERNADOR', 'PREFEITO', 'SUPERIOR', 'FUNDAÇÃO', 'FUNDACAO', 'FUNDO', 'AGÊNCIA', 'AGENCIA',
  'CÂMARA', 'CAMARA', 'SENADO', 'CONGRESSO', 'COOPERATIVA', 'ORDEM DOS', 'SECRETARIA', 'SECRETÁRIO',
  'UNIVERSIDADE', 'SERVIÇO', 'SERVICO', 'AUTARQUIA', 'CAIXA', 'PETROBRAS', 'INSS', 'COMISSÃO', 'COMITÊ',
  'MINISTRO', 'MIN.', 'JUIZ', 'JUÍZO', 'VARA ', 'COMARCA', 'GRUPO', 'HOLDING', 'TECNOLOGIA', 'COMÉRCIO',
  'INDÚSTRIA', 'SOCIEDADE', 'ENTIDADE', 'CENTRAL', 'NACIONAL', 'BRASIL', 'OUTRO(A/S)',
];
const CONECTIVOS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'del', 'van', 'von']);

function aparar(s, chars) {
  let i = 0;
  let j = s.length;
  while (i < j && chars.includes(s[i])) i++;
  while (j > i && chars.includes(s[j - 1])) j--;
  return s.slice(i, j);
}

/** str.isupper() do Python: tem letra com caixa e todas estão em maiúscula. */
function ehMaiusculo(s) {
  let temCaixa = false;
  for (const c of s) {
    if (c.toLowerCase() !== c.toUpperCase()) {
      temCaixa = true;
      if (c !== c.toUpperCase()) return false;
    }
  }
  return temCaixa;
}

/** str.title() do Python: maiúscula após caractere sem caixa, minúscula no resto. */
function titulo(s) {
  let saida = '';
  let anteriorComCaixa = false;
  for (const c of s) {
    const comCaixa = c.toLowerCase() !== c.toUpperCase();
    saida += comCaixa ? (anteriorComCaixa ? c.toLowerCase() : c.toUpperCase()) : c;
    anteriorComCaixa = comCaixa;
  }
  return saida;
}

function limparNome(nome) {
  let n = String(nome || '').replace(/\(.*?\)/g, ' ');
  n = n.replace(new RegExp(`\\s+e\\s+outr[oa]s?(?![${W}]).*$`, 'iu'), '');
  return aparar(n.replace(/\s+/g, ' '), ' .,;:-–—\t');
}

/** Nome de pessoa física provável: 2-8 palavras capitalizadas, sem termo institucional. */
function parecePessoa(nome) {
  const tokens = nome.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 8) return false;
  const maiusculo = ` ${nome.toUpperCase()} `;
  if (INSTITUCIONAL.some((t) => maiusculo.includes(t))) return false;
  for (const t of tokens) {
    if (CONECTIVOS.has(t.toLowerCase())) continue;
    if (!/^[A-ZÀ-Ü][A-Za-zÀ-ü'-]+$/.test(t)) return false;
  }
  return true;
}

function nomesDe(valores) {
  const nomes = new Set();
  for (const v of valores) {
    const nome = limparNome(v);
    if (parecePessoa(nome)) nomes.add(nome);
  }
  return nomes;
}

/**
 * Nomes de pessoa de um campo de partes/responsáveis/advogados (ex.: TCU
 * INTERESSADOS = "3. Responsáveis: Fulano de Tal (XXX.956.260-XX); ..."). Só em memória.
 */
export function extrairNomesDeCampo(texto) {
  if (!texto) return new Set();
  let t = String(texto).replace(/<[^>]+>/g, '\n').replace(/\(.*?\)/g, ' ');
  const pedacos = t.split(/[;,\n]|\s\d+(?:\.\d+)*\.\s|\s+e\s+/);
  return nomesDe(pedacos.map((p) => p.slice(p.lastIndexOf(':') + 1)));
}

function secao(linha) {
  const compacto = linha.replace(/\s+/g, '').toUpperCase();
  return SECOES_STF.some((s) => compacto.startsWith(s));
}

/** Remove TODOS os blocos de cabeçalho em colunas (rótulos + linhas ': VALOR'), colhendo os valores. */
function removerCabecalhosStf(texto, nomes) {
  const linhas = texto.split('\n');
  const saida = [];
  let i = 0;
  while (i < linhas.length) {
    if (!RE_LINHA_ROTULO.test(linhas[i])) {
      saida.push(linhas[i]);
      i += 1;
      continue;
    }
    let j = i;
    const valores = [];
    let ultimoValor = false;
    while (j < linhas.length) {
      const linha = linhas[j];
      if (!linha.trim() || RE_LINHA_ROTULO.test(linha)) {
        // linha vazia ou outro rótulo: continua no bloco
      } else if (linha.trimStart().startsWith(':')) {
        valores.push(linha.trimStart().slice(1).trim());
        ultimoValor = true;
      } else if (ultimoValor && !/[a-zà-ü]/.test(linha) && !secao(linha)) {
        valores[valores.length - 1] += ` ${linha.trim()}`;
      } else {
        break;
      }
      j += 1;
    }
    if (valores.length) {
      for (const n of nomesDe(valores)) nomes.add(n);
      saida.push(AVISO_PARTES);
      i = j;
    } else { // rótulo solto sem valores — não é cabeçalho, mantém
      saida.push(linhas[i]);
      i += 1;
    }
  }
  return saida.join('\n');
}

function redigirRotulosComValor(texto, nomes) {
  return texto.replace(RE_ROTULO_COM_VALOR, (_m, _rotulo, valor) => {
    for (const n of nomesDe([valor])) nomes.add(n);
    return AVISO_PARTES;
  });
}

function redigirQualificacaoEmQue(texto, nomes) {
  return texto.replace(RE_QUALIFICACAO_EM_QUE, (_m, _g1, g2) => {
    const pedacos = g2.split(RE_SEPARA_PARTES_TST).filter((p) => p && p.trim());
    for (const n of nomesDe(pedacos.map((p) => (ehMaiusculo(p) ? titulo(p.trim()) : p)))) nomes.add(n);
    return `em que ${AVISO_PARTES}.\n`;
  });
}

function variantes(nome) {
  const tokens = nome.split(/\s+/).filter(Boolean);
  const v = new Set([nome]);
  if (tokens.length >= 3) v.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);
  return v;
}

const VARIANTES_LETRA = { a: '[aáàâãä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôõö]', u: '[uúùûü]', c: '[cç]' };
const escapar = (c) => c.replace(/[\^$\\.*+?()[\]{}|/]/g, '\\$&');

/** Regex tolerante a acento e hífen ("Geraldo Antonio" casa "Geraldo Antônio", "Aben-Athar" casa "Aben Athar"). */
function padraoNome(nome) {
  const semAcento = nome.normalize('NFKD').replace(/\p{Mn}/gu, '').toLowerCase();
  const tokens = semAcento.split(/[\s-]+/).filter(Boolean);
  const partes = tokens.map((t) => Array.from(t).map((c) => VARIANTES_LETRA[c] ?? escapar(c)).join(''));
  return `(?<![${W}À-ü])${partes.join('[\\s\\-]+')}(?![${W}À-ü])`;
}

/** Troca cada ocorrência (sem diferenciar caixa, acento ou hífen) dos nomes pelo aviso. */
export function redigirNomes(texto, nomes) {
  const alvos = new Set();
  for (const nome of nomes) for (const v of variantes(nome)) alvos.add(v);
  // nome completo antes da forma curta
  for (const alvo of [...alvos].sort((a, b) => Array.from(b).length - Array.from(a).length)) {
    texto = texto.replace(new RegExp(padraoNome(alvo), 'giu'), AVISO_NOME);
  }
  return texto;
}

/**
 * Aplica as salvaguardas de LGPD sobre texto já convertido de HTML.
 * `nomesExtras`: nomes de pessoas vindos de campos de partes da própria API.
 */
export function sanitizarTextoJuridico(texto, nomesExtras = []) {
  if (!texto) return '';
  const nomes = nomesDe(nomesExtras);
  let t = removerCabecalhosStf(texto, nomes);
  t = redigirRotulosComValor(t, nomes);
  t = redigirQualificacaoEmQue(t, nomes);
  t = redigirNomes(t, nomes);
  t = t.replace(RE_CPF, '[CPF omitido]').replace(RE_OAB, '[OAB omitida]');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/** Corta no limite por documento, sinalizando o corte no próprio texto. */
export function limitarTexto(texto, limite = LIMITE_CHARS_DOCUMENTO) {
  const letras = Array.from(texto);
  if (letras.length <= limite) return texto;
  return `${letras.slice(0, limite).join('').trimEnd()}\n\n[texto truncado no limite de 200.000 caracteres do Tusab]`;
}

/**
 * Testes de utils/tabelasChat.js — rodar com:
 *   cd web_interface; node --test src/utils/
 * (test runner nativo do Node, sem dependência nova)
 *
 * Os casos "reais" abaixo reproduzem padrões de saída malformada vistos em
 * modelos locais pequenos (llama3.2:1b) e nos achados de 31/ago/2026.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTabelasMarkdown, contemTabela, ehSeparador, dividirCelulas,
  pareceNumero, tabelaParaCsv, slugAssunto, nomeArquivoPlanilha, rehypeTabelasChat,
} from './tabelasChat.js';

const linhasTabela = (txt) => txt.split('\n').filter(l => l.trim().startsWith('|'));

test('tabela já bem formada não muda (idempotência)', () => {
  const t = 'Comparação:\n\n| Item | Valor (R$) |\n| --- | ---: |\n| A | 10,50 |\n| B | 20,00 |\n\nFim.';
  assert.equal(normalizarTabelasMarkdown(t), t);
  assert.equal(normalizarTabelasMarkdown(normalizarTabelasMarkdown(t)), t);
});

test('texto sem tabela não é tocado', () => {
  const t = 'Use a opção A | B no menu.\n\n- item 1\n- item 2\n\nOutra linha com | um pipe.';
  assert.equal(normalizarTabelasMarkdown(t), t);
});

test('código cercado com pipes não é tocado', () => {
  const t = '```\n| a | b\n| c\n```';
  assert.equal(normalizarTabelasMarkdown(t), t);
});

test('insere linha separadora ausente', () => {
  const t = '| Cidade | População |\n| Recife | 1.488.920 |\n| Natal | 751.300 |';
  const r = normalizarTabelasMarkdown(t);
  const ls = linhasTabela(r);
  assert.equal(ls.length, 4);
  assert.ok(ehSeparador(ls[1]));
  assert.ok(contemTabela(t));
});

test('completa linhas com menos colunas e corta pipe sobrando', () => {
  const t = '| A | B | C |\n|---|---|---|\n| 1 | 2 |\n| 4 | 5 | 6 | |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls[2], '| 1 | 2 |  |');
  assert.equal(ls[3], '| 4 | 5 | 6 |');
});

test('cabeçalho com menos colunas que o corpo ganha coluna vazia (não perde dado)', () => {
  const t = '| Nome | Valor |\n|---|---|\n| A | 1 | x |\n| B | 2 | y |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(dividirCelulas(ls[0]).length, 3);
  assert.equal(dividirCelulas(ls[1]).length, 3);
  assert.equal(ls[2], '| A | 1 | x |');
});

test('excedente com conteúdo é anexado à última célula', () => {
  const t = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 | sobra |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls[4], '| 5 | 6; sobra |');
});

test('pipes das pontas ausentes são adicionados', () => {
  const t = 'Produto | Preço\n--- | ---\nCafé | 12,90\nPão | 1,50';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.deepEqual(ls, ['| Produto | Preço |', '| --- | --- |', '| Café | 12,90 |', '| Pão | 1,50 |']);
});

test('separador com nº de colunas errado é refeito; alinhamento preservado quando bate', () => {
  const r1 = linhasTabela(normalizarTabelasMarkdown('| A | B | C |\n|---|---|\n| 1 | 2 | 3 |'));
  assert.equal(r1[1], '| --- | --- | --- |');
  const r2 = linhasTabela(normalizarTabelasMarkdown('| A | B |\n|:---|---:|\n| 1 | 2 |'));
  assert.equal(r2[1], '| :--- | ---: |');
});

test('separadores repetidos no meio da tabela são removidos', () => {
  const t = '| A | B |\n|---|---|\n| 1 | 2 |\n|---|---|\n| 3 | 4 |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls.length, 4);
  assert.equal(ls[3], '| 3 | 4 |');
});

test('linha "| - | - |" no corpo é dado (valor ausente), não separador', () => {
  const t = '| A | B |\n|---|---|\n| 1 | 2 |\n| - | - |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls.length, 4);
  assert.equal(ls[3], '| - | - |');
});

test('tabela colada no parágrafo anterior e posterior ganha linhas em branco', () => {
  const t = 'Veja abaixo:\n| A | B |\n|---|---|\n| 1 | 2 |\nComo se vê, A é menor.';
  const r = normalizarTabelasMarkdown(t);
  assert.equal(r, 'Veja abaixo:\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nComo se vê, A é menor.');
});

test('texto e tabela na mesma linha ("Dados: | A | B |") são separados', () => {
  const t = 'Aqui estão os dados: | Ano | Total |\n|---|---|\n| 2023 | 10 |';
  const r = normalizarTabelasMarkdown(t);
  assert.ok(r.startsWith('Aqui estão os dados:\n\n| Ano | Total |'));
});

test('cabeçalho sem pipes nas pontas ("A | B") não é confundido com texto colado', () => {
  const t = 'Ano | Total\n---|---\n2023 | 10';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls[0], '| Ano | Total |');
});

test('tabela inteira colada numa linha só (achado real 31/ago/2026)', () => {
  const t = 'Aqui estão os resultados:| Dataset | RAG | Auxiliar || --- | --- | --- || COVID-19 | 74,3% | 92,1% || Notícias | 72,1% | 89,6% |Os resultados mostram uma melhoria.';
  const r = normalizarTabelasMarkdown(t);
  const ls = linhasTabela(r);
  assert.equal(ls.length, 4);
  assert.equal(ls[2], '| COVID-19 | 74,3% | 92,1% |');
  assert.ok(r.includes('\n\nOs resultados mostram uma melhoria.'));
  assert.ok(r.startsWith('Aqui estão os resultados:\n\n|'));
});

test('pipe escapado dentro da célula é preservado', () => {
  const t = '| Expr | Sentido |\n|---|---|\n| a \\| b | ou |';
  assert.equal(normalizarTabelasMarkdown(t), t.replace('|---|---|', '| --- | --- |'));
});

test('linha solta com pipes no meio da frase não vira tabela', () => {
  const t = 'Opções: | sim | não |';
  assert.equal(normalizarTabelasMarkdown(t), t);
});

test('streaming parcial: última linha incompleta é completada sem quebrar', () => {
  const t = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls[3], '| 3 |  |');
});

test('real llama3.2:1b: linha toda vazia no fim da tabela é removida', () => {
  const t = '| | Pessoas atendidas | Orçamento |\n| --- | --- | --- |\n| 2023 | 18,2 milhões | R$ 2.911,8 milhões |\n|  |  |  |\n\nTexto depois.';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls.length, 3);
  assert.equal(ls[0], '|  | Pessoas atendidas | Orçamento |'); // canto vazio do cabeçalho é legítimo
});

test('real llama3.2:1b: cabeçalho de traços antes do separador → cabeçalho verdadeiro sobe', () => {
  const t = '| | --- | --- |\n| --- | --- | --- |\n| **Atendimentos por Região** | **2023** | **2024** |\n| **Nordeste** | 24,1% | 25,5% |\n| **Sul** | 16,3% | 18,2% |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.deepEqual(ls, [
    '| **Atendimentos por Região** | **2023** | **2024** |',
    '| --- | --- | --- |',
    '| **Nordeste** | 24,1% | 25,5% |',
    '| **Sul** | 16,3% | 18,2% |',
  ]);
  // idempotente também no caso consertado
  const uma = normalizarTabelasMarkdown(t);
  assert.equal(normalizarTabelasMarkdown(uma), uma);
});

test('real gemma3:4b: separador partido por linha em branco é reunido', () => {
  const t = 'Distribuição em 2024.\n\n| Região        | Atendimentos (2024) | Porcentagem (2024) |\n|---------------\n\n|-----------------------|--------------------|\n| Nordeste      | 7.000.000             | 34%                |\n| Sul           | 3.000.000             | 14%                |';
  const ls = linhasTabela(normalizarTabelasMarkdown(t));
  assert.equal(ls.length, 4);
  assert.ok(ehSeparador(ls[1]));
  assert.equal(ls[0], '| Região | Atendimentos (2024) | Porcentagem (2024) |');
  assert.equal(ls[2], '| Nordeste | 7.000.000 | 34% |');
  assert.ok(contemTabela(t));
});

test('pareceNumero: formatos pt-BR, en, moeda, %, negativos', () => {
  for (const v of ['1.234,56', '1,234.56', '12', '-3,5', 'R$ 1.234,56', '12,5%', '(1.000)', '1 234', '2024', 'US$ 10']) {
    assert.ok(pareceNumero(v), v);
  }
  for (const v of ['abc', '12 kg', '01/02/2024', '', '1.2.3,4,5', 'v1.2']) {
    assert.ok(!pareceNumero(v), v);
  }
});

test('tabelaParaCsv: aspas, vírgula, quebra e injeção de fórmula', () => {
  const csv = tabelaParaCsv({ cabecalho: ['Nome', 'Valor (R$)'], linhas: [['A, B', '1.234,56'], ['=HYPERLINK("x")', '-12'], ['diz "oi"', '']] });
  assert.equal(csv, 'Nome,Valor (R$)\r\n"A, B","1.234,56"\r\n"\'=HYPERLINK(""x"")",-12\r\n"diz ""oi""",');
});

test('slug e nome de arquivo da planilha', () => {
  assert.equal(slugAssunto('Compare os preços de 2024!'), 'compare-os-precos-de-2024');
  assert.equal(nomeArquivoPlanilha('Gere uma planilha', new Date(2026, 9, 20)), 'tusab_gere-uma-planilha_2026-10-20.xlsx');
  assert.equal(nomeArquivoPlanilha('', new Date(2026, 0, 5)), 'tusab_tabela_2026-01-05.xlsx');
});

test('rehypeTabelasChat marca colunas numéricas e índice das tabelas', () => {
  const cel = (tag, txt) => ({ type: 'element', tagName: tag, properties: {}, children: [{ type: 'text', value: txt }] });
  const tr = (tag, vals) => ({ type: 'element', tagName: 'tr', properties: {}, children: vals.map(v => cel(tag, v)) });
  const tabela = {
    type: 'element', tagName: 'table', properties: {}, children: [
      { type: 'element', tagName: 'thead', properties: {}, children: [tr('th', ['Item', 'Valor (R$)', 'Obs'])] },
      { type: 'element', tagName: 'tbody', properties: {}, children: [tr('td', ['A', '1.234,56', 'x']), tr('td', ['B', '-', '12'])] },
    ],
  };
  const arvore = { type: 'root', children: [tabela] };
  rehypeTabelasChat()(arvore);
  assert.equal(tabela.properties.dataTabelaIndice, 0);
  assert.equal(tabela.properties.dataTabelaTotal, 1);
  const [thead, tbody] = tabela.children;
  assert.equal(thead.children[0].children[1].properties.dataNumerico, 'true');
  assert.equal(tbody.children[0].children[1].properties.dataNumerico, 'true');
  assert.equal(tbody.children[0].children[0].properties.dataNumerico, undefined);
  assert.equal(tbody.children[0].children[2].properties.dataNumerico, undefined); // coluna mista
});

test('coluna quase toda vazia com um só número não vira numérica (achado real 21/out/2026)', () => {
  const cel = (tag, txt) => ({ type: 'element', tagName: tag, properties: {}, children: [{ type: 'text', value: txt }] });
  const tr = (tag, vals) => ({ type: 'element', tagName: 'tr', properties: {}, children: vals.map(v => cel(tag, v)) });
  const linhas = [['', '15,2 milhões', '22,4 milhões'], ['', '31.020', '31.020'], ['', 'R$ 2,5 bi', 'R$ 3,5 bi'], ['34%', '34%', '']];
  const tabela = {
    type: 'element', tagName: 'table', properties: {}, children: [
      { type: 'element', tagName: 'thead', properties: {}, children: [tr('th', ['Pessoas atendidas', '2023', '2024'])] },
      { type: 'element', tagName: 'tbody', properties: {}, children: linhas.map(l => tr('td', l)) },
    ],
  };
  rehypeTabelasChat()({ type: 'root', children: [tabela] });
  const [thead, tbody] = tabela.children;
  assert.equal(thead.children[0].children[0].properties.dataNumerico, undefined);
  assert.equal(tbody.children[3].children[0].properties.dataNumerico, undefined);
});

// Três idiomas (pt, en, es): dicionários completos, prompts traduzidos e o idioma escolhido na
// tela valendo para a API e para o que a IA vê (títulos das ferramentas e atalhos do "+").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import EN from '../src/nucleo/textos/en.js';
import ES from '../src/nucleo/textos/es.js';
import { MESMO_TEXTO } from '../src/nucleo/textos/nomes.js';
import { CATEGORIAS, PROMPTS, listarPrompts, montarPrompt } from '../src/nucleo/prompts.js';
import { normalizarIdioma, t } from '../src/nucleo/idioma.js';
import { todasAsChaves } from './chaves-i18n.js';
import { DESCRICOES } from '../src/nucleo/textos/ferramentas.js';

const ENTRADA = fileURLToPath(new URL('../src/index.js', import.meta.url));
const variaveis = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('toda frase do plugin tem tradução em inglês e espanhol, com as mesmas variáveis', () => {
  const chaves = todasAsChaves();
  assert.ok(chaves.length > 400, `poucas frases encontradas (${chaves.length}): o coletor quebrou?`);
  for (const [nome, dic] of [['en', EN], ['es', ES]]) {
    const faltando = chaves.filter((k) => !(k in dic));
    assert.deepEqual(faltando, [], `faltam ${faltando.length} frase(s) em ${nome}.js`);
    const erradas = chaves.filter((k) => variaveis(k).join() !== variaveis(dic[k]).join());
    assert.deepEqual(erradas, [], `variáveis diferentes em ${nome}.js`);
    const sobrando = Object.keys(dic).filter((k) => !chaves.includes(k) && !MESMO_TEXTO.includes(k));
    assert.deepEqual(sobrando, [], `frases em ${nome}.js que o código não usa mais`);
  }
});

test('t(): idioma, variáveis e chave desconhecida', () => {
  assert.equal(t('Fonte {id} não encontrada.', { id: 7 }, 'pt'), 'Fonte 7 não encontrada.');
  assert.equal(t('Fonte {id} não encontrada.', { id: 7 }, 'en'), 'Source 7 not found.');
  assert.equal(t('Fonte {id} não encontrada.', { id: 7 }, 'es'), 'Fuente 7 no encontrada.');
  assert.equal(t('frase que não está no dicionário', null, 'en'), 'frase que não está no dicionário');
  assert.equal(normalizarIdioma('pt-BR'), 'pt');
  assert.equal(normalizarIdioma('es-419'), 'es');
  assert.equal(normalizarIdioma('fr'), null);
});

test('os 21 prompts e as categorias existem nos três idiomas, com as mesmas variáveis', () => {
  for (const p of PROMPTS) {
    for (const lng of ['pt', 'en', 'es']) {
      const x = p.textos[lng];
      assert.ok(x?.titulo && x.descricao && x.pedido, `${p.id} sem texto em ${lng}`);
      assert.deepEqual(variaveis(x.pedido), variaveis(p.textos.pt.pedido), `${p.id}: variáveis em ${lng}`);
      assert.ok(CATEGORIAS[p.categoria][lng], `categoria ${p.categoria} em ${lng}`);
    }
  }
  const en = montarPrompt('flashcards', { projeto: 'Bio', tema: 'cell' }, null, 'en');
  // Todo pedido começa pela checagem de conexão (sem o Tusab, a IA avisa em vez de responder de memória).
  assert.match(en, /^Before you start: if the Tusab tools \(tusab_buscar\) are not available/);
  assert.match(en, /\n\nCreate 10 flashcards about "cell"/);
  assert.match(en, /Search the Tusab base in the project "Bio"/);
  assert.match(en, /tusab_salvar_estudo \(project "Bio", type flashcards\)/);
  const es = montarPrompt('quiz', { projeto: 'Bio', tema: 'célula', quantidade: 5 }, null, 'es');
  assert.match(es, /^Antes de empezar: si las herramientas de Tusab/);
  assert.match(es, /\n\nArma un quiz de 5 preguntas de opción múltiple sobre "célula"/);
  // O quiz é guardado como documento, para abrir depois na aba Materiais.
  assert.match(es, /tusab_salvar_estudo \(proyecto "Bio", tipo documento, en Markdown/);
  assert.match(es, /pestaña Materiales de Tusab\.$/);
  const lista = listarPrompts(null, 'es');
  assert.ok(lista.categorias.includes('Estudiar'));
  assert.equal(lista.prompts.find((p) => p.id === 'resumo').titulo, 'Resumen de estudio');
  assert.equal(lista.prompts.find((p) => p.id === 'resumo').categoria_id, 'estudar');
});

test('o idioma da tela vale para a API e para a IA (ferramentas e atalhos do "+")', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-idioma-'));
  const cliente = new Client({ name: 't', version: '0' });
  await cliente.connect(new StdioClientTransport({
    command: process.execPath, args: [ENTRADA], stderr: 'ignore',
    env: { ...process.env, TUSAB_REPOSITORIO: raiz, TUSAB_SEM_BOAS_VINDAS: '1', TUSAB_IDIOMA: 'pt' },
  }));
  try {
    const titulo = async (nome) => (await cliente.listTools()).tools.find((x) => x.name === nome).title;
    assert.equal(await titulo('tusab_buscar'), 'Buscar na base do Tusab');
    const r = await cliente.callTool({ name: 'tusab_abrir_painel', arguments: { abrir_navegador: false } });
    const [, porta, chave] = r.content[0].text.match(/127\.0\.0\.1:(\d+)\/\?chave=([\w-]+)/);
    const pedir = (idioma) => fetch(`http://127.0.0.1:${porta}/api/prompts/montar`, {
      method: 'POST', headers: { 'X-Tusab-Chave': chave, 'X-Tusab-Idioma': idioma, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'resumo', projeto: '' }),
    }).then((x) => x.json());

    // Descrição em português antes da troca, para comparar depois
    const ferramentasPt = (await cliente.listTools()).tools;
    assert.equal((await pedir('en')).message, 'Choose a project.');
    assert.equal(await titulo('tusab_buscar'), 'Search the Tusab base');
    // As descrições (tela de permissões do Claude e o que a IA lê) também trocam, em todas as ferramentas
    const ferramentasEn = (await cliente.listTools()).tools;
    for (const f of ferramentasEn) {
      assert.ok(DESCRICOES[f.name]?.en && DESCRICOES[f.name]?.es, `${f.name} sem descrição em en/es (textos/ferramentas.js)`);
      assert.equal(f.description, DESCRICOES[f.name].en);
      assert.notEqual(f.description, ferramentasPt.find((x) => x.name === f.name).description);
    }
    const atalhos = (await cliente.listPrompts()).prompts;
    assert.equal(atalhos.find((p) => p.name === 'resumo').title, '📝 Study summary');
    assert.equal(atalhos.find((p) => p.name === 'abrir_tusab').title, 'Open Tusab');
    const vazio = await cliente.callTool({ name: 'tusab_listar_projetos', arguments: {} });
    assert.match(vazio.content[0].text, /is still empty/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'config', 'idioma.json'), 'utf8')), { idioma: 'en' });

    assert.equal((await pedir('es')).message, 'Elige un proyecto.');
    assert.equal(await titulo('tusab_status'), 'Estado de Tusab');
    assert.equal((await pedir('xx')).message, 'Elige un proyecto.', 'idioma desconhecido não muda nada');

    // Sem a chave da sessão, o cabeçalho de idioma não muda nada.
    await fetch(`http://127.0.0.1:${porta}/api/status`, { headers: { 'X-Tusab-Idioma': 'pt' } });
    assert.equal(await titulo('tusab_status'), 'Estado de Tusab');
  } finally {
    await cliente.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('a tela de extensões do Claude Desktop tem inglês e espanhol para todas as ferramentas e atalhos', () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
  assert.equal(manifesto.localization.default_locale, 'pt-BR');
  for (const locale of ['en-US', 'es-ES']) {
    const arq = path.join(raiz, manifesto.localization.resources.replace('${locale}', locale));
    const r = JSON.parse(fs.readFileSync(arq, 'utf8'));
    assert.ok(r.description && r.long_description, locale);
    assert.deepEqual(r.tools.map((x) => x.name), manifesto.tools.map((x) => x.name), `${locale}: ferramentas`);
    assert.deepEqual(r.prompts.map((x) => x.name), manifesto.prompts.map((x) => x.name), `${locale}: atalhos`);
    assert.ok(r.tools.every((x) => x.description) && r.prompts.every((x) => x.description && x.text), `${locale}: textos vazios`);
  }
});

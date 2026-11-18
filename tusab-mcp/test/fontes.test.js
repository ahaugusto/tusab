// Fontes públicas (fase C): registro, contrato, bases genéricas, adaptadores
// que leem XML e o ciclo buscar → status → arquivos → aoSalvar → cancelar.
// Sem rede: globalThis.fetch é trocado por um falso em cada teste.
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  EventoCancelar, ErroHTTP, ErroTimeout, configurarEsperas, executarBuscaGenerica, htmlParaTexto,
  mensagemErroBuscaExterna, obter, sanitizarNomeArquivo, unescapeHtml,
} from '../src/fontes/_base.js';
import { AREAS_META, MODULOS, TAXONOMIA, TIPOS_CONTEUDO, listarFontes, obterFonte } from '../src/fontes/index.js';
import { ErroValidacao, ServicoFontes, validarPedido } from '../src/fontes/servico.js';
import { sanitizarTextoJuridico, extrairNomesDeCampo, limitarTexto } from '../src/fontes/_lgpd_juridico.js';
import { contemTodas, normalizar, palavrasSignificativas, radical } from '../src/fontes/_termos_busca.js';
import { buscarDspace7 } from '../src/fontes/_dspace7.js';
import { buscarMediawiki, limitarTexto as limitarWiki, urlPagina } from '../src/fontes/_mediawiki.js';
import { buscarVufind, normalizarTitulo } from '../src/fontes/_vufind.js';
import { intercalar, limparTexto } from '../src/fontes/_portais_dados.js';
import { limparCard } from '../src/fontes/_huggingface.js';

configurarEsperas(0); // throttles e Retry-After sem espera real

// ── Infra de teste ───────────────────────────────────────────────────────────

const fetchOriginal = globalThis.fetch;
let chamadas = [];
let raiz;

function resposta({ json, texto, bytes, status = 200, tipo, headers = {} } = {}) {
  let corpo = bytes ?? texto ?? '';
  let ct = tipo;
  if (json !== undefined) { corpo = JSON.stringify(json); ct = ct ?? 'application/json'; }
  return new Response(corpo, { status, headers: { 'content-type': ct ?? 'text/plain; charset=utf-8', ...headers } });
}

/** rotas: [[testeDaUrl (string contida ou RegExp ou função), (url, init) => Response | objeto de resposta()]] */
function fetchFalso(rotas) {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    chamadas.push({ url: u, init });
    for (const [teste, fazer] of rotas) {
      const casa = typeof teste === 'function' ? teste(u, init) : teste instanceof RegExp ? teste.test(u) : u.includes(teste);
      if (casa) {
        const r = await fazer(u, init);
        return r instanceof Response ? r : resposta(r);
      }
    }
    return resposta({ status: 404, texto: 'sem rota' });
  };
}

function criarProjeto(nome = 'Projeto') {
  fs.mkdirSync(path.join(raiz, 'data', 'neural', nome, 'documents'), { recursive: true });
  return nome;
}

function docDir(nome = 'Projeto') {
  return path.join(raiz, 'data', 'neural', nome, 'documents');
}

function lerDocumentos(nome = 'Projeto') {
  const dir = docDir(nome);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
  return manifest.map((m) => ({ ...m, conteudo: fs.readFileSync(path.join(dir, m.nome_txt), 'utf8') }));
}

const corpoDe = (conteudo) => conteudo.split(`${'-'.repeat(70)}\n`).slice(1).join(`${'-'.repeat(70)}\n`);

beforeEach(() => {
  chamadas = [];
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tusab-fontes-'));
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  fs.rmSync(raiz, { recursive: true, force: true });
});

// ── Registro e contrato ──────────────────────────────────────────────────────

// Ordem e contagem do registro do desktop (tusab_engine/motor/fontes/__init__.py::_MODULOS).
const IDS_DESKTOP = [
  'arxiv', 'openalex', 'datacite', 'doaj', 'zenodo', 'crossref', 'hal', 'open_library', 'agencia_brasil',
  'github', 'gitlab', 'codeberg', 'hf_modelos', 'hf_datasets', 'hf_papers', 'stackexchange', 'hacker_news',
  'bcb', 'ipea', 'ibge_noticias', 'worldbank_wds',
  'portais_br_federal', 'portais_br_estados', 'portais_br_municipios', 'portais_internacionais', 'data_europa_eu', 'data_gov_uk',
  'bdtd', 'oasisbr', 'capes_teses', 'educapes', 'wikilivros_pt', 'wikiversidade_pt', 'eric',
  'camara', 'camara_discursos', 'senado_leis', 'senado_materias', 'senado_discursos', 'stf', 'tcu', 'tst', 'govbr_noticias',
  'almg', 'federal_register',
  'bvs_ms', 'anvisalegis', 'fiocruz_arca', 'inca', 'unasus_ares', 'paho_iris', 'who_iris', 'pubmed', 'clinicaltrials',
  'uniprot', 'europepmc', 'openfda',
  'nasa_cmr', 'nasa_ntrs', 'usgs_pubs', 'cern_opendata', 'osti', 'inspire_hep',
  'wikisource_pt', 'art_institute_chicago', 'the_met', 'cleveland_art', 'gutenberg', 'wikipedia', 'wiktionary',
];
const AREAS_DESKTOP = {
  geral: 9, tecnologia: 8, economia: 4, dados: 6, educacao: 7, direito: 11,
  saude: 12, terra: 3, fisica: 3, patrimonio: 5, antropologia: 2,
};

test('registro completo: 70 fontes em 11 áreas, mesma ordem do desktop', () => {
  assert.deepEqual(MODULOS.map((m) => m.FONTE_META.id), IDS_DESKTOP);
  const { areas } = new ServicoFontes(raiz).listar();
  assert.deepEqual(Object.keys(areas), Object.keys(AREAS_DESKTOP));
  for (const [id, n] of Object.entries(AREAS_DESKTOP)) {
    assert.equal(areas[id].fontes.length, n, `área ${id}`);
    assert.equal(areas[id].nome, AREAS_META[id]);
  }
  assert.equal(Object.values(areas).reduce((s, a) => s + a.fontes.length, 0), 70);
  // Os chips de tipo da área saem só dos tipos presentes nela.
  assert.deepEqual(areas.geral.tipos, { artigos: 'Artigos científicos', dados: 'Conjuntos de dados', livros: 'Livros e textos integrais', noticias: 'Notícias' });
  // Cópias: mexer na lista não muda o FONTE_META do módulo.
  areas.geral.fontes[0].nome = 'x';
  assert.equal(obterFonte('arxiv').FONTE_META.nome, 'arXiv');
  assert.equal(obterFonte('nao_existe'), null);
});

test('contrato de cada fonte (FONTE_META + taxonomia + buscar)', () => {
  const ids = new Set();
  for (const m of MODULOS) {
    const meta = m.FONTE_META;
    assert.ok(!ids.has(meta.id), `id repetido ${meta.id}`);
    ids.add(meta.id);
    for (const campo of ['id', 'nome', 'area', 'descricao']) assert.equal(typeof meta[campo], 'string', `${meta.id}.${campo}`);
    for (const campo of ['requer_auth', 'suporta_data', 'suporta_autor']) assert.equal(typeof meta[campo], 'boolean', `${meta.id}.${campo}`);
    assert.equal(meta.requer_auth, false, meta.id);
    assert.ok(AREAS_META[meta.area], `${meta.id}: área ${meta.area}`);
    assert.equal(typeof m.buscar, 'function', meta.id);
    const tax = TAXONOMIA[meta.id];
    assert.ok(tax, `taxonomia de ${meta.id}`);
    assert.ok(['br', 'int'].includes(tax.regiao), meta.id);
    assert.ok(tax.tipos.length && tax.tipos.every((t) => TIPOS_CONTEUDO[t]), meta.id);
    if (meta.subfontes) {
      assert.ok(meta.id.startsWith('portais_'), meta.id);
      assert.deepEqual(meta.subfontes, m.PORTAIS.map((p) => p.nome));
      assert.equal(typeof meta.subfontes_rotulo, 'string');
    }
  }
  const comData = MODULOS.filter((m) => m.FONTE_META.suporta_data).map((m) => m.FONTE_META.id).sort();
  assert.deepEqual(comData, ['arxiv', 'camara_discursos', 'eric', 'federal_register', 'openalex', 'senado_discursos', 'senado_materias', 'stf', 'worldbank_wds']);
  const comAutor = MODULOS.filter((m) => m.FONTE_META.suporta_autor).map((m) => m.FONTE_META.id).sort();
  assert.deepEqual(comAutor, ['arxiv', 'eric', 'openalex']);
});

// ── _base ────────────────────────────────────────────────────────────────────

test('_base: HTML, entidades, nomes de arquivo e mensagens de erro', async () => {
  assert.equal(htmlParaTexto('<p>Sa&uacute;de &amp; <b>vida</b></p><script>x()</script><p>Fim&nbsp;&#8211; ok</p>'), 'Saúde & vida\nFim – ok');
  assert.equal(unescapeHtml('&eacute &lt;b&gt; &#x41; &naoexiste;'), 'é <b> A &naoexiste;');
  assert.equal(sanitizarNomeArquivo('Saúde: um estudo/2026 com título bem comprido demais'), 'Sa_de__um_estudo_2026_com_t_tulo_bem_com');

  fetchFalso([['429', () => ({ status: 429, texto: 'calma' })], ['lento', () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); }]]);
  const r = await obter('https://x.org/429');
  const e429 = (() => { try { r.raise_for_status(); } catch (e) { return e; } })();
  assert.ok(e429 instanceof ErroHTTP);
  assert.match(e429.message, /^429 Client Error: Too Many Requests for url/);
  assert.equal(mensagemErroBuscaExterna(e429, 'Fonte X'), 'Fonte X está limitando o número de buscas no momento — aguarde alguns segundos e tente novamente.');
  const eTempo = await obter('https://x.org/lento').catch((e) => e);
  assert.ok(eTempo instanceof ErroTimeout);
  assert.equal(mensagemErroBuscaExterna(eTempo, 'Fonte X'), 'Fonte X demorou demais para responder — tente novamente.');
  assert.equal(mensagemErroBuscaExterna(new Error('quebrou'), 'Fonte X'), 'Erro ao buscar em Fonte X: quebrou');
});

test('_base: executarBuscaGenerica grava no formato do desktop, preserva o manifest e isola erros', async () => {
  const dir = docDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify([{ id: 'antigo', nome_txt: 'antigo.txt' }]));
  const eventos = [];
  const itens = [{ t: 'Primeiro título' }, { t: null }, { t: 'quebra' }, { t: 'Último' }];
  const r = await executarBuscaGenerica(itens, (it) => {
    if (it.t === 'quebra') throw new Error('item ruim');
    return it.t ? { titulo: it.t, texto: `Texto de ${it.t} — ç`, url_origem: 'https://ex.org/1' } : null;
  }, 'fonte_teste', dir, { dispatch_event: (ev, d) => eventos.push([ev, d]), throttle: 1 });

  assert.deepEqual(r, { ok: true, total_encontrados: 4, total_salvos: 2, erros: [{ titulo: '{"t":"quebra"}', erro: 'item ruim' }] });
  assert.deepEqual(eventos.map(([e]) => e), ['total', 'processed', 'processed']);
  assert.deepEqual(eventos[2][1], { processed: 2, total: 4, titulo: 'Último' });
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
  assert.equal(manifest.length, 3);
  assert.equal(manifest[0].id, 'antigo');
  const novo = manifest[1];
  assert.deepEqual(Object.keys(novo), ['id', 'nome_original', 'nome_txt', 'tipo', 'tamanho', 'data', 'chars', 'fonte_externa']);
  assert.match(novo.nome_txt, /^[0-9a-f]{8}_Primeiro_t_tulo\.txt$/);
  assert.equal(novo.tipo, 'fonte_teste');
  assert.equal(novo.fonte_externa, 'fonte_teste');
  assert.equal(novo.chars, 'Texto de Primeiro título — ç'.length);
  assert.equal(novo.tamanho, Buffer.byteLength('Texto de Primeiro título — ç'));
  assert.match(novo.data, /^\d{2}\/\d{2}\/\d{4}$/);
  const conteudo = fs.readFileSync(path.join(dir, novo.nome_txt), 'utf8');
  assert.equal(conteudo, `TITULO: Primeiro título\nFONTE: fonte_teste\nDATA: ${novo.data}\nURL_ORIGEM: https://ex.org/1\n${'-'.repeat(70)}\nTexto de Primeiro título — ç`);

  // Cancelado antes de começar: nada é salvo, manifest continua íntegro.
  const ev = new EventoCancelar();
  ev.set();
  const r2 = await executarBuscaGenerica([{ t: 'a' }], (it) => ({ titulo: it.t, texto: 'x' }), 'f', dir, { evento_cancelar: ev });
  assert.equal(r2.total_salvos, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')).length, 3);
});

test('_termos_busca: radical sem acento nem caixa', () => {
  assert.equal(normalizar('Tributária ÇÃO'), 'tributaria cao');
  assert.deepEqual(palavrasSignificativas('Saneamento básico de IA no SUS'), ['saneamento', 'basico']);
  assert.equal(radical('licitacao'), 'licita');
  assert.ok(contemTodas('licitacoes publicas', ['licitacao']));
  assert.ok(!contemTodas('despacho saneador', ['saneamento']));
});

// ── Bases genéricas ──────────────────────────────────────────────────────────

test('_dspace7: filtro de abstract no Solr com nova tentativa, abstracts juntos e texto integral (bundle TEXT)', async () => {
  const projeto = criarProjeto();
  const item = (uuid, handle, titulo, abstracts) => ({
    _embedded: { indexableObject: { uuid, handle, name: titulo, metadata: {
      'dc.title': titulo ? [{ value: titulo }] : [],
      'dc.description.abstract': abstracts.map((value) => ({ value, language: '' })),
    } } },
  });
  const textoIntegral = 'Texto integral extraído pelo DSpace. '.repeat(20);
  fetchFalso([
    [(u) => u.includes('discover/search') && u.includes('description.abstract'), () => ({ status: 400, texto: 'solr' })],
    ['discover/search', () => ({ tipo: 'application/hal+json', json: { _embedded: { searchResult: { _embedded: { objects: [
      item('u1', '10665/1', 'Dengue no Brasil', ['[ABSTRACT] Dengue', '[RESUMO] Dengue', '[ABSTRACT] Dengue']),
      item('u2', null, 'Sem resumo', []),
      item('u3', '10665/3', 'Outro', ['Resumo do outro']),
    ] } } } } })],
    ['/core/items/u1/bundles', () => ({ tipo: 'application/hal+json', json: { _embedded: { bundles: [
      { name: 'ORIGINAL' },
      { name: 'TEXT', _embedded: { bitstreams: { _embedded: { bitstreams: [{ sizeBytes: 100, _links: { content: { href: 'https://repo.org/bits/1/content' } } }] } } } },
    ] } } })],
    ['/core/items/u3/bundles', () => ({ tipo: 'application/hal+json', json: { _embedded: { bundles: [] } } })],
    ['bits/1/content', () => ({ tipo: 'text/plain', bytes: Buffer.from(textoIntegral, 'utf8') })],
  ]);
  const r = await buscarDspace7('https://repo.org/server/api', 'https://repo.org', { id: 'ipea', nome: 'IPEA' }, 'dengue', 5, docDir(projeto), {
    usarTextoIntegral: true,
  });
  assert.equal(r.total_salvos, 2);
  const buscas = chamadas.filter((c) => c.url.includes('discover/search'));
  assert.equal(buscas.length, 2);
  assert.match(decodeURIComponent(buscas[0].url.replace(/\+/g, ' ')), /query=\(dengue\) AND dc\.description\.abstract:\*/);
  assert.match(buscas[0].url, /size=10/);
  const docs = lerDocumentos(projeto);
  assert.equal(corpoDe(docs[0].conteudo), textoIntegral.trim());
  assert.match(docs[0].conteudo, /URL_ORIGEM: https:\/\/repo\.org\/handle\/10665\/1/);
  assert.equal(corpoDe(docs[1].conteudo), 'Resumo do outro');

  // Sem texto integral: o abstract repetido por idioma entra uma vez só.
  const proj2 = criarProjeto('P2');
  await buscarDspace7('https://repo.org/server/api', 'https://repo.org', { id: 'who_iris', nome: 'WHO' }, 'dengue', 1, docDir(proj2));
  assert.equal(corpoDe(lerDocumentos('P2')[0].conteudo), '[ABSTRACT] Dengue\n\n[RESUMO] Dengue');
});

test('_mediawiki: um título por chamada, fallback para parse, descarte de página curta e 429 com nova tentativa', async () => {
  const projeto = criarProjeto();
  let tentativas429 = 0;
  const longo = 'Conteúdo didático de verdade. '.repeat(20);
  fetchFalso([
    [(u) => u.includes('list=search'), () => {
      tentativas429 += 1;
      if (tentativas429 === 1) return { status: 429, texto: 'devagar', headers: { 'retry-after': '30' } };
      return { json: { query: { search: [{ title: 'Cálculo/Limites' }, { title: 'Portal curto' }] } } };
    }],
    [(u) => u.includes('prop=extracts') && u.includes('Limites'), () => ({ json: { query: { pages: { 1: { extract: 'curto' } } } } })],
    [(u) => u.includes('action=parse') && u.includes('Limites'), () => ({ json: { parse: { text: { '*': `<p>${longo}</p>` } } } })],
    [(u) => u.includes('prop=extracts'), () => ({ json: { query: { pages: { 2: { extract: 'só links' } } } } })],
    [(u) => u.includes('action=parse'), () => ({ json: { parse: { text: { '*': '<a>x</a>' } } } })],
  ]);
  const r = await buscarMediawiki('https://pt.wikibooks.org/w/api.php', 'wikilivros_pt', 'Wikilivros (PT)', 'limites', 5, docDir(projeto));
  assert.equal(tentativas429, 2);
  assert.deepEqual([r.total_encontrados, r.total_salvos], [2, 1]);
  const [doc] = lerDocumentos(projeto);
  assert.equal(doc.nome_original, 'Cálculo/Limites');
  assert.match(doc.conteudo, /URL_ORIGEM: https:\/\/pt\.wikibooks\.org\/wiki\/C%C3%A1lculo\/Limites\n/);
  assert.equal(corpoDe(doc.conteudo), longo.trim());
  assert.equal(urlPagina('https://pt.wikisource.org/w/api.php', 'Dom Casmurro (1899)'), 'https://pt.wikisource.org/wiki/Dom_Casmurro_(1899)');
  const enorme = 'palavra '.repeat(10_000);
  const cortado = limitarWiki(enorme, 'https://ex.org');
  assert.ok(cortado.length <= 60_000);
  assert.match(cortado, /\[Texto truncado em 60\.000 caracteres — íntegra em https:\/\/ex\.org\]$/);
});

test('_vufind: campos pedidos um a um, resumo PT+EN, sem resumo curto e sem título repetido', async () => {
  const projeto = criarProjeto();
  const resumoPt = 'Este trabalho investiga a alfabetização de crianças em escolas públicas brasileiras e seus desafios.';
  fetchFalso([['vufind/api/v1/search', () => ({ json: { resultCount: 4, records: [
    { id: 'a1', title: 'Alfabetização: um estudo.', summary: [resumoPt, 'This work studies literacy.'], authors: { primary: { 'Silva, Ana': {} }, secondary: [] }, publicationDates: ['2020'], urls: [{ url: 'https://repo.br/a1.pdf' }] },
    { id: 'a2', title: 'alfabetizacao um estudo', summary: [resumoPt] },
    { id: 'a3', title: 'Eco do título', summary: ['Eco do título ...'] },
    { id: 'a4', title: 'Outra tese', summary: `<p>${resumoPt}</p>` },
  ] } })]]);
  const r = await buscarVufind('https://bdtd.ibict.br', 'bdtd', 'BDTD', 'alfabetização', 2, docDir(projeto));
  assert.equal(r.total_salvos, 2);
  const url = new URL(chamadas[0].url);
  assert.deepEqual(url.searchParams.getAll('field[]'), ['id', 'title', 'summary', 'urls', 'publicationDates', 'authors']);
  assert.equal(url.searchParams.get('limit'), '6');
  const docs = lerDocumentos(projeto);
  assert.equal(corpoDe(docs[0].conteudo), `Autoria: Silva, Ana\nAno: 2020\n\n${resumoPt}\n\nThis work studies literacy.`);
  assert.match(docs[0].conteudo, /URL_ORIGEM: https:\/\/repo\.br\/a1\.pdf/);
  assert.match(docs[1].conteudo, /URL_ORIGEM: https:\/\/bdtd\.ibict\.br\/vufind\/Record\/a4/);
  assert.equal(normalizarTitulo('Alfabetização: um estudo.'), 'alfabetizacao um estudo');
});

test('_portais_dados: paralelo, intercalado, portal fora do ar fica de fora e subfontes filtram', async () => {
  const projeto = criarProjeto();
  const desc = 'Descrição longa o bastante do conjunto de dados de saúde pública estadual.';
  const ckan = (prefixo, n) => ({ json: { result: { results: Array.from({ length: n }, (_, i) => ({
    title: `${prefixo} ${i + 1}`, name: `${prefixo.toLowerCase()}-${i + 1}`, notes: `**${desc}** [link](http://x)`,
    organization: { title: `Secretaria ${prefixo}` }, resources: [{ name: 'dados.csv', format: '.csv', url: 'https://x/d.csv' }],
  })) } } });
  fetchFalso([
    ['dadosabertos.sp.gov.br', () => ckan('SP', 3)],
    ['dados.mg.gov.br', () => ckan('MG', 1)],
    ['dados.rs.gov.br', () => ({ status: 500, texto: 'fora' })],
  ]);
  const fonte = obterFonte('portais_br_estados');
  const r = await fonte.buscar({
    query: 'saúde', max_resultados: 3, projeto_nome: projeto, raiz,
    subfontes: ['São Paulo', 'Minas Gerais', 'Rio Grande do Sul'],
  });
  assert.equal(chamadas.length, 3, 'só os portais marcados são consultados');
  assert.deepEqual(r.portais_sem_resposta, ['Rio Grande do Sul: HTTPError']);
  assert.deepEqual(lerDocumentos(projeto).map((d) => d.nome_original), ['SP 1', 'MG 1', 'SP 2']);
  const doc = lerDocumentos(projeto)[0];
  assert.match(doc.conteudo, /URL_ORIGEM: https:\/\/dadosabertos\.sp\.gov\.br\/dataset\/sp-1\n/);
  assert.equal(corpoDe(doc.conteudo), `Portal: São Paulo | Publicado por: Secretaria SP\n\n${desc} link\n\nArquivos do conjunto de dados:\n- dados.csv [CSV] https://x/d.csv`);

  fetchFalso([[() => true, () => ({ status: 503, texto: 'fora' })]]);
  await assert.rejects(
    fonte.buscar({ query: 'x', max_resultados: 3, projeto_nome: projeto, raiz, subfontes: ['Goiás'] }),
    /Nenhum portal respondeu — Goiás: HTTPError/,
  );
  assert.deepEqual(intercalar([[1, 2, 3], [4], [5, 6]], 5), [1, 4, 5, 2, 6]);
  assert.equal(limparTexto({ en: 'Hello', pt: '# Título\n> citação' }), 'Título\ncitação');
});

test('_huggingface: card sem front matter, repositório restrito pulado, até o limite pedido', async () => {
  const projeto = criarProjeto();
  const card = `---\nlicense: mit\n---\n# Modelo\n![img](x.png)\n<div>texto</div>\n${'Descrição do modelo. '.repeat(15)}`;
  fetchFalso([
    ['/api/models', () => ({ json: [
      { id: 'org/fechado', downloads: 10, likes: 1, tags: ['pt'] },
      { id: 'neuralmind/bert', downloads: 5, likes: 2, tags: ['pt', 'license:mit'], pipeline_tag: 'fill-mask' },
      { id: 'org/terceiro', downloads: 1, likes: 0 },
    ] })],
    ['org/fechado/raw', () => ({ status: 401, texto: 'gated' })],
    ['/raw/main/README.md', () => ({ texto: card })],
  ]);
  const r = await obterFonte('hf_modelos').buscar({ query: 'bert', max_resultados: 1, projeto_nome: projeto, raiz });
  assert.equal(r.total_salvos, 1);
  assert.ok(!chamadas.some((c) => c.url.includes('org/terceiro/raw')), 'depois do limite não baixa mais cards');
  const [doc] = lerDocumentos(projeto);
  assert.equal(doc.nome_original, 'Modelo neuralmind/bert');
  assert.ok(corpoDe(doc.conteudo).startsWith('Modelo: neuralmind/bert | Downloads: 5 | Curtidas: 2 | Tarefa: fill-mask | Tags: pt\n\n# Modelo\n\n texto'));
  assert.ok(!limparCard(card).includes('license'));
});

test('_lgpd_juridico: mesma saída do desktop para partes, nomes, CPF e OAB', () => {
  const amostra = [
    'RECURSO EXTRAORDINÁRIO 123', 'RELATOR', ': MIN. FULANO', 'RECTE.(S)', ': JOSÉ DA SILVA SANTOS', 'ADV.(A/S)',
    ': MARIA APARECIDA SOUZA', 'RECDO.(A/S)', ': UNIÃO', 'RELATÓRIO',
    'O recorrente José Santos alega que José da Silva Santos tem CPF 123.456.789-01 e XXX.956.260-XX.',
    'AGTE.(S): PEDRO ÁLVARES CABRAL', 'Advogado OAB/DF 12.345 e 26.348/OAB-CE e (63906/GO).',
    'Vistos, relatados e discutidos estes autos de Recurso de Revista, em que é Recorrente', 'CARLOS ALBERTO NÓBREGA',
    'e Recorrido', 'EMPRESA XYZ LTDA.', '.', 'Contra o r. despacho, Carlos Nóbrega recorre. Também Geraldo Antônio Aben Athar.',
  ].join('\n');
  // Saída do Python (tusab_engine/motor/fontes/_lgpd_juridico.py) para a mesma amostra.
  const esperado = [
    'RECURSO EXTRAORDINÁRIO 123', '[qualificação das partes omitida — LGPD]', 'RELATÓRIO',
    'O recorrente [nome omitido — LGPD] alega que [nome omitido — LGPD] tem CPF [CPF omitido] e [CPF omitido].',
    '[qualificação das partes omitida — LGPD]', 'Advogado [OAB omitida] e [OAB omitida] e [OAB omitida].',
    'Vistos, relatados e discutidos estes autos de Recurso de Revista, em que [qualificação das partes omitida — LGPD].', '',
    'Contra o r. despacho, [nome omitido — LGPD] recorre. Também [nome omitido — LGPD].',
  ].join('\n');
  assert.equal(sanitizarTextoJuridico(amostra, ['Geraldo Antonio Aben-Athar']), esperado);
  assert.deepEqual([...extrairNomesDeCampo('3. Responsáveis: Fulano de Tal (XXX.956.260-XX); Beltrano Souza (XXX) e Ciclano Lima')].sort(),
    ['Beltrano Souza', 'Ciclano Lima', 'Fulano de Tal']);
  assert.ok(limitarTexto('a'.repeat(200_001)).endsWith('[texto truncado no limite de 200.000 caracteres do Tusab]'));
});

// ── Adaptadores que leem XML ─────────────────────────────────────────────────

test('arxiv: feed Atom, PDF → texto, Resumo no cabeçalho e manifest tipo pdf', async () => {
  const projeto = criarProjeto();
  const PDFDocument = (await import('pdfkit')).default;
  const pdf = await new Promise((resolve) => {
    const doc = new PDFDocument();
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.text('Attention is all you need for transformers.');
    doc.end();
  });
  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <published>2017-06-12T17:57:34Z</published>
    <title>Attention Is All
      You Need</title>
    <summary>  The dominant sequence transduction models...  </summary>
    <link href="http://arxiv.org/abs/1706.03762v7" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/1706.03762v7" rel="related" type="application/pdf"/>
  </entry>
  <entry><id>http://arxiv.org/abs/sem-pdf</id><title>Sem PDF</title></entry>
</feed>`;
  fetchFalso([
    ['export.arxiv.org/api/query', () => ({ tipo: 'application/atom+xml', texto: atom })],
    ['arxiv.org/pdf/', () => ({ tipo: 'application/pdf', bytes: pdf })],
  ]);
  const eventos = [];
  const r = await obterFonte('arxiv').buscar({
    query: 'attention', max_resultados: 5, projeto_nome: projeto, autor: 'Vaswani', data_inicio: '2017-01-01', data_fim: '2017-12-31',
    raiz, dispatch_event: (e, d) => eventos.push([e, d]),
  });
  assert.deepEqual([r.total_encontrados, r.total_salvos, r.erros.length], [1, 1, 0]);
  assert.deepEqual(eventos.map(([e]) => e), ['total', 'processed']);
  const consulta = new URL(chamadas[0].url).searchParams.get('search_query');
  assert.equal(consulta, '((all:attention) AND au:Vaswani) AND submittedDate:[20170101 TO 20171231]');
  const [doc] = lerDocumentos(projeto);
  assert.equal(doc.nome_original, 'Attention Is All You Need');
  assert.equal(doc.tipo, 'pdf');
  assert.equal(doc.fonte_externa, 'arxiv');
  assert.equal(doc.tamanho, pdf.length);
  assert.match(doc.conteudo, /^TITULO: Attention Is All You Need\nFONTE: arxiv\n/);
  assert.match(doc.conteudo, /URL_ORIGEM: http:\/\/arxiv\.org\/abs\/1706\.03762v7\n/);
  assert.ok(corpoDe(doc.conteudo).startsWith('Resumo: The dominant sequence transduction models...\n\n'));
  assert.match(doc.conteudo, /Attention is all you need for transformers\./);
});

test('pubmed: esearch JSON + efetch XML com várias seções de abstract', async () => {
  const projeto = criarProjeto();
  const xml = `<?xml version="1.0"?><PubmedArticleSet>
<PubmedArticle><MedlineCitation><PMID>111</PMID><Article><ArticleTitle>Dengue vaccine trial</ArticleTitle>
<Abstract><AbstractText Label="BACKGROUND">Dengue is endemic.</AbstractText><AbstractText Label="RESULTS">Efficacy was 80%.</AbstractText></Abstract>
</Article></MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID>222</PMID><Article><ArticleTitle>No abstract</ArticleTitle></Article></MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;
  fetchFalso([
    ['esearch.fcgi', () => ({ json: { esearchresult: { idlist: ['111', '222'] } } })],
    ['efetch.fcgi', () => ({ tipo: 'text/xml', texto: xml })],
  ]);
  const r = await obterFonte('pubmed').buscar({ query: 'dengue', max_resultados: 2, projeto_nome: projeto, raiz });
  assert.deepEqual([r.total_encontrados, r.total_salvos], [2, 1]);
  assert.match(chamadas[1].url, /id=111%2C222/);
  const [doc] = lerDocumentos(projeto);
  assert.equal(doc.nome_original, 'Dengue vaccine trial');
  assert.equal(corpoDe(doc.conteudo), 'Dengue is endemic. Efficacy was 80%.');
  assert.match(doc.conteudo, /URL_ORIGEM: https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/111\//);
});

test('senado_leis: lista XML filtrada localmente (todas as palavras na ementa) e URN de normas.leg.br', async () => {
  const projeto = criarProjeto();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><ListaDocumento><documentos>
<documento><numero>14133</numero><normaNome>Lei nº 14.133, de 1º de abril de 2021</normaNome><ementa>Lei de Licitações e Contratos Administrativos.</ementa><dataassinatura>01/04/2021</dataassinatura></documento>
<documento><numero>1</numero><normaNome>Lei nº 1</normaNome><ementa>Dispõe sobre outra coisa.</ementa><dataassinatura>02/01/2020</dataassinatura></documento>
<documento><numero>2</numero><ementa></ementa></documento>
</documentos></ListaDocumento>`;
  fetchFalso([['legislacao/lista', () => ({ tipo: 'application/xml', texto: xml })]]);
  const r = await obterFonte('senado_leis').buscar({ query: 'licitações contratos', max_resultados: 5, projeto_nome: projeto, raiz });
  assert.deepEqual([r.total_encontrados, r.total_salvos], [1, 1]);
  const [doc] = lerDocumentos(projeto);
  assert.equal(doc.nome_original, 'Lei nº 14.133, de 1º de abril de 2021');
  assert.equal(corpoDe(doc.conteudo), 'Lei de Licitações e Contratos Administrativos.\n\nData de assinatura: 01/04/2021');
  assert.match(doc.conteudo, /URL_ORIGEM: https:\/\/normas\.leg\.br\/\?urn=urn:lex:br:federal:lei:2021-04-01;14133\n/);
});

test('gutenberg: feed OPDS, sem entradas de navegação, licença cortada e livro sem .txt pulado', async () => {
  const projeto = criarProjeto();
  const opds = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/">
<entry><id>https://www.gutenberg.org/ebooks/search.opds/?query=x&amp;sort_order=title</id><title>Sort Alphabetically</title></entry>
<entry><id>https://www.gutenberg.org/ebooks/55752.opds</id><title>Dom Casmurro</title><content type="text">Machado de Assis</content></entry>
<entry><id>https://www.gutenberg.org/ebooks/999.opds</id><title>Só áudio</title><content type="text">123 downloads</content></entry>
</feed>`;
  fetchFalso([
    ['search.opds', () => ({ tipo: 'application/atom+xml;profile=opds-catalog', texto: opds })],
    ['pg55752.txt', () => ({ texto: 'Cabeçalho\r\n*** START OF THE PROJECT GUTENBERG EBOOK DOM CASMURRO ***\r\nCapítulo I\r\nUma noite destas...\r\n*** END OF THE PROJECT GUTENBERG EBOOK DOM CASMURRO ***\r\nLicença' })],
    ['pg999.txt', () => ({ status: 404, texto: 'não' })],
  ]);
  const r = await obterFonte('gutenberg').buscar({ query: 'casmurro', max_resultados: 20, projeto_nome: projeto, raiz });
  assert.deepEqual([r.total_encontrados, r.total_salvos, r.erros.length], [2, 1, 0]);
  const [doc] = lerDocumentos(projeto);
  assert.equal(corpoDe(doc.conteudo), 'Autor: Machado de Assis\n\nCapítulo I\nUma noite destas...');
  assert.match(doc.conteudo, /URL_ORIGEM: https:\/\/www\.gutenberg\.org\/ebooks\/55752\n/);
});

test('govbr_noticias: RSS 1.0 (RDF) com content:encoded, div do corpo e órgão sem resposta', async () => {
  const projeto = criarProjeto();
  const rss = `<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel rdf:about="x"><title>ANAC</title></channel>
  <item rdf:about="https://www.gov.br/anac/noticia-1">
    <title>Nova regra para drones</title><link>https://www.gov.br/anac/noticia-1</link>
    <description>Resumo curto da regra.</description><dc:date>2026-10-01T10:00:00Z</dc:date>
    <content:encoded><![CDATA[<div id="viewlet"><div id="parent-fieldname-text"><p>Corpo da notícia.</p><div><p>Detalhe.</p></div></div><div>menu</div></div>]]></content:encoded>
  </item>
</rdf:RDF>`;
  fetchFalso([
    ['/anac/', () => ({ tipo: 'application/rss+xml; charset=utf-8', texto: rss })],
    [() => true, () => ({ status: 503, tipo: 'text/html', texto: 'manutenção' })],
  ]);
  const r = await obterFonte('govbr_noticias').buscar({ query: 'drones', max_resultados: 1, projeto_nome: projeto, raiz });
  assert.equal(r.total_salvos, 1);
  const [doc] = lerDocumentos(projeto);
  assert.equal(doc.nome_original, 'Nova regra para drones (ANAC)');
  assert.equal(corpoDe(doc.conteudo), 'Órgão: ANAC\nPublicado em: 2026-10-01T10:00:00Z\nResumo: Resumo curto da regra.\n\nCorpo da notícia.\nDetalhe.');
});

// ── Serviço (router_fontes.py) ───────────────────────────────────────────────

test('serviço: validação igual ao pydantic (422) e erros de negócio do desktop', () => {
  const s = new ServicoFontes(raiz);
  const detalhe = (corpo) => { try { validarPedido(corpo); return null; } catch (e) { assert.ok(e instanceof ErroValidacao); assert.equal(e.status, 422); return e.detail; } };
  assert.deepEqual(detalhe({ query: 'a', projeto_nome: 'P' }).map((d) => [d.type, d.loc]), [['string_too_short', ['body', 'query']]]);
  assert.deepEqual(detalhe({ query: 'ok' }).map((d) => [d.type, d.loc, d.msg]), [['missing', ['body', 'projeto_nome'], 'Field required']]);
  assert.deepEqual(detalhe({ query: 'ok', projeto_nome: 'P', max_resultados: 51, data_inicio: '2026/01/01', subfontes: 'SP' }).map((d) => d.type),
    ['less_than_equal', 'string_pattern_mismatch', 'list_type']);
  assert.equal(detalhe({ query: 'ok', projeto_nome: 'P', max_resultados: '0' })[0].msg, 'Input should be greater than or equal to 1');
  assert.equal(detalhe([])[0].type, 'model_attributes_type');
  assert.deepEqual(validarPedido({ query: 'ok', projeto_nome: 'P', max_resultados: '7' }), {
    query: 'ok', max_resultados: 7, projeto_nome: 'P', data_inicio: '', data_fim: '', autor: '', subfontes: [],
  });
  assert.throws(() => s.buscar('nao_existe', { query: 'a' }), ErroValidacao); // corpo é validado antes, como no FastAPI
  assert.deepEqual(s.buscar('nao_existe', { query: 'ok', projeto_nome: 'P' }), { error: true, message: 'Fonte desconhecida' });
  assert.deepEqual(s.buscar('bcb', { query: 'ok', projeto_nome: '  ' }), { error: true, message: 'Selecione um projeto antes de buscar' });
  assert.deepEqual(s.buscar('bcb', { query: 'ok', projeto_nome: 'Inexistente' }), { error: true, message: 'Projeto não encontrado. Crie o projeto antes de buscar.' });
  assert.deepEqual(s.buscar('bcb', { query: 'ok', projeto_nome: '..' }), { error: true, message: 'Selecione um projeto antes de buscar' });
  assert.deepEqual(s.status('bcb'), { running: false, status: 'Ocioso', total: 0, processed: 0 });
  assert.deepEqual(s.cancelar('bcb'), { message: 'Nenhuma busca em andamento' });
});

test('serviço: buscar → status → arquivos gravados → aoSalvar', async () => {
  criarProjeto('Meu_Projeto'); // a pasta já tem o nome sanitizado, como o POST /neural/projeto cria
  let liberar;
  const portao = new Promise((r) => { liberar = r; });
  fetchFalso([['dadosabertos.bcb.gov.br', async () => {
    await portao;
    return { json: { result: { results: [
      { title: 'Taxa Selic', name: 'selic', notes: 'Série histórica da taxa Selic.' },
      { title: 'Sem notas', name: 'vazio', notes: '' },
      { title: 'IPCA', name: 'ipca', notes: 'Índice de preços ao consumidor.' },
    ] } } };
  }]]);
  const salvos = [];
  const logs = [];
  let avisar;
  const reindexou = new Promise((r) => { avisar = r; });
  const s = new ServicoFontes(raiz, {
    aoSalvar: (projeto, info) => { salvos.push([projeto, info]); avisar(); },
    aoLogar: (linha) => logs.push(linha),
  });

  assert.deepEqual(s.buscar('bcb', { query: ' selic ', max_resultados: 10, projeto_nome: ' Meu Projeto ' }), { ok: true, message: 'Busca iniciada' });
  assert.deepEqual(s.status('bcb'), { running: true, status: 'Buscando em Banco Central do Brasil', total: 0, processed: 0, itens: [] });
  assert.deepEqual(s.buscar('bcb', { query: 'outra', projeto_nome: 'Meu_Projeto' }),
    { error: true, message: 'Já há uma busca em Banco Central do Brasil em andamento' });

  liberar();
  await s.aguardar('bcb');
  await reindexou;
  assert.deepEqual(s.status('bcb'), { running: false, status: 'Finalizado ✓', total: 3, processed: 2, itens: ['Taxa Selic', 'IPCA'] });
  assert.deepEqual(salvos, [['Meu_Projeto', { fonte_id: 'bcb', total_salvos: 2 }]]);
  assert.equal(new URL(chamadas[0].url).searchParams.get('q'), 'selic');
  const docs = lerDocumentos('Meu_Projeto');
  assert.deepEqual(docs.map((d) => d.nome_original), ['Taxa Selic', 'IPCA']);
  assert.match(docs[0].conteudo, /^TITULO: Taxa Selic\nFONTE: bcb\nDATA: \d{2}\/\d{2}\/\d{4}\nURL_ORIGEM: https:\/\/dadosabertos\.bcb\.gov\.br\/dataset\/selic\n-{70}\nSérie histórica da taxa Selic\.$/);
  assert.equal(logs[0], '🔎 Buscando "selic" em Banco Central do Brasil (até 10 resultados)...');
  assert.equal(logs.at(-1), '🏁 Busca em Banco Central do Brasil concluída — 2 resultado(s) salvos.');
});

test('serviço: cancelar no meio guarda o que já foi salvo; erro da fonte vira status Erro com mensagem', async () => {
  const projeto = criarProjeto();
  let liberar;
  const portao = new Promise((r) => { liberar = r; });
  let chegouNoSegundo;
  const noSegundo = new Promise((r) => { chegouNoSegundo = r; });
  fetchFalso([
    ['search.json', () => ({ json: { docs: [{ key: '/works/1', title: 'Livro 1' }, { key: '/works/2', title: 'Livro 2' }, { key: '/works/3', title: 'Livro 3' }] } })],
    ['/works/2.json', async () => { chegouNoSegundo(); await portao; return { json: { description: { value: 'Descrição 2' } } }; }],
    ['/works/', (u) => ({ json: { description: `Descrição de ${u}` } })],
  ]);
  let salvou = 0;
  const s = new ServicoFontes(raiz, { aoSalvar: () => { salvou += 1; } });
  s.buscar('open_library', { query: 'livros', projeto_nome: projeto });
  await noSegundo;
  assert.deepEqual(s.cancelar('open_library'), { message: 'Cancelando' });
  liberar();
  await s.aguardar('open_library');
  const st = s.status('open_library');
  assert.equal(st.running, false);
  assert.equal(st.status, 'Finalizado ✓');
  assert.deepEqual([st.total, st.processed], [3, 2]);
  assert.ok(!chamadas.some((c) => c.url.includes('/works/3.json')), 'parou antes do terceiro');
  assert.equal(lerDocumentos(projeto).length, 2);
  await new Promise((r) => setImmediate(r));
  assert.equal(salvou, 1);

  // Erro da fonte: 429 vira a mensagem acionável do desktop.
  fetchFalso([['zenodo.org', () => ({ status: 429, texto: 'limite' })]]);
  s.buscar('zenodo', { query: 'dados', projeto_nome: projeto });
  await s.aguardar('zenodo');
  assert.deepEqual(s.status('zenodo'), {
    running: false, status: 'Erro', total: 0, processed: 0, itens: [],
    message: 'Zenodo está limitando o número de buscas no momento — aguarde alguns segundos e tente novamente.',
  });

  // Subfontes fora da lista da fonte são ignoradas.
  chamadas = [];
  fetchFalso([['dados.recife.pe.gov.br', () => ({ json: { result: { results: [] } } })]]);
  s.buscar('portais_br_municipios', { query: 'saúde', projeto_nome: projeto, subfontes: ['Prefeitura do Recife', 'Inventada'] });
  await s.aguardar('portais_br_municipios');
  assert.equal(chamadas.length, 1);
  assert.equal(s.status('portais_br_municipios').status, 'Finalizado ✓');
});

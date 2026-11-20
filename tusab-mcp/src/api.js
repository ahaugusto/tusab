// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// API local da extensão: mesmas rotas e mesmos campos do FastAPI do desktop
// (tusab_engine/api/*), para a interface React do desktop funcionar sem mudança.
// Rotas de recursos que a extensão não tem (chat, LLM, Ollama, Drive…) respondem
// de forma neutra, para a interface esconder o recurso em vez de quebrar.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { caminhos, dentroDe, sanitizarNome } from './nucleo/caminhos.js';
import {
  criarProjeto, listarProjetos, listarRepositorio, pastaProjeto, relatorio, resumirProjetosYoutube,
} from './nucleo/gestao.js';
import {
  buscarTexto, excluirArquivo, lerArquivo, limparHistorico, limparProjeto, resetTotal, salvarDocumento, salvarPagina,
} from './nucleo/repositorio.js';
import {
  ErroValidacao, excluirArtefato, exportarFlashcardsAnki, lerArtefato, lerEstudo, listarArtefatos, listarDigests,
  listarItensEstudo, pedidoGeracaoDigest, pedidoGeracaoEstudo, progressoRevisao, renomearArtefato,
  revisarCard, ttsIndisponivel,
} from './nucleo/estudo.js';
import {
  exportarBase, exportarBaseCompartilhavel, exportarRelatorioPdf, exportarTabelaVideos, importarBaseCompartilhavel,
  statusSomenteLeitura,
} from './nucleo/exportar.js';
import { ErroValidacao as ErroValidacaoFontes } from './fontes/servico.js';
import { excluirPromptUsuario, listarPrompts, montarPrompt, montarPromptComTrechos, renomearPasta, salvarPromptUsuario } from './nucleo/prompts.js';
import { medirPerguntas, resumoEconomia, zerarEconomia } from './nucleo/tokens.js';
import { URL_CANAL } from './nucleo/ytdlp.js';
import { t } from './nucleo/idioma.js';

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Métricas (router_metrics.py): amostra a cada 2 s, histórico de 60 pontos.
const historicoMetricas = [];
let cpuAnterior = process.cpuUsage();
let tempoAnterior = Date.now();
function amostrarMetricas() {
  const agora = Date.now();
  const uso = process.cpuUsage(cpuAnterior);
  const decorrido = Math.max(1, agora - tempoAnterior) * 1000;
  cpuAnterior = process.cpuUsage();
  tempoAnterior = agora;
  const amostra = {
    ts: Math.floor(agora / 1000),
    ram_mb: Math.round((process.memoryUsage().rss / 1048576) * 10) / 10,
    cpu_pct: Math.round(((uso.user + uso.system) / decorrido) * 1000) / 10,
    sys_cpu: Math.round((os.loadavg()[0] / os.cpus().length) * 1000) / 10,
  };
  historicoMetricas.push(amostra);
  if (historicoMetricas.length > 60) historicoMetricas.shift();
  return amostra;
}
const relogioMetricas = setInterval(amostrarMetricas, 2000);
relogioMetricas.unref();

function abrirPasta(alvo) {
  const [cmd, args] = process.platform === 'win32' ? ['explorer', [alvo]]
    : process.platform === 'darwin' ? ['open', [alvo]] : ['xdg-open', [alvo]];
  const filho = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: false });
  filho.on('error', () => {});
  filho.unref();
}

/** Rotas /agent/* e afins chamadas pela interface: respostas neutras ("sem assistente local"). */
const NEUTRAS = {
  'GET /agent/config': () => ({ provider: 'externo', modo_extensao: true, api_key_set: false }),
  'GET /agent/custom/status': () => ({ ativo: false }),
  'GET /agent/chat-stats': () => ({ total: 0 }),
  'GET /agent/summarize/pending': () => ({ pendentes: [], total: 0 }),
  'GET /agent/ollama/status': () => ({ instalado: false, rodando: false, modelos: [] }),
  'GET /agent/tts/status': () => ({ disponivel: false }),
};

/**
 * Estudo (fase D): uso dos flashcards, post-its, resumos e digests gravados pela IA
 * do usuário (ferramentas MCP) — mesmo formato e mesmas respostas do desktop.
 * A geração em si responde "peça à sua IA" (não há LLM dentro da extensão).
 */
async function rotaEstudo(tusab, metodo, caminho, json) {
  const raiz = tusab.raiz;
  const ok = (corpo) => ({ status: 200, corpo });
  const dec = decodeURIComponent;
  const validando = (fn) => {
    try { return ok(fn()); } catch (e) {
      if (e instanceof ErroValidacao) throw new ErroHttp(422, e.message);
      throw e;
    }
  };
  let m;
  if (metodo === 'GET') {
    if ((m = caminho.match(/^\/agent\/study\/itens\/([^/]+)$/))) return ok(listarItensEstudo(tusab.indice, dec(m[1])));
    if ((m = caminho.match(/^\/agent\/study\/revisao\/([^/]+)$/))) return ok(progressoRevisao(raiz, dec(m[1])));
    if ((m = caminho.match(/^\/agent\/study\/artefatos\/([^/]+)$/))) return ok(listarArtefatos(raiz, dec(m[1])));
    if ((m = caminho.match(/^\/agent\/study\/artefato\/([^/]+)\/([^/]+)$/))) return ok(lerArtefato(raiz, dec(m[1]), dec(m[2])));
    if ((m = caminho.match(/^\/agent\/digest\/([^/]+)$/))) return ok(listarDigests(raiz, dec(m[1])));
    if ((m = caminho.match(/^\/export\/flashcards\/([^/]+)$/))) {
      const r = exportarFlashcardsAnki(raiz, dec(m[1]));
      if (!r?.download) return ok(r);
      return {
        status: 200,
        corpo: r.download.conteudo,
        tipo: r.download.tipo,
        cabecalhos: { 'Content-Disposition': `attachment; filename="${r.download.nome}"` },
      };
    }
    if ((m = caminho.match(/^\/agent\/study\/([^/]+)$/))) return ok(lerEstudo(raiz, dec(m[1])));
  }
  if (metodo === 'DELETE' && (m = caminho.match(/^\/agent\/study\/artefato\/([^/]+)\/([^/]+)$/))) {
    const r = excluirArtefato(raiz, dec(m[1]), dec(m[2]));
    return ok(r);
  }
  if (metodo === 'POST') {
    if (caminho === '/agent/study/artefato/renomear') { const c = await json(); return validando(() => renomearArtefato(raiz, c)); }
    if (caminho === '/agent/study/revisar') { const c = await json(); return validando(() => revisarCard(raiz, c)); }
    if (caminho === '/agent/study') return ok(pedidoGeracaoEstudo(await json(), { indice: tusab.indice }));
    if (caminho === '/agent/tts' || /^\/agent\/study\/artefato\/[^/]+\/[^/]+\/audio$/.test(caminho)) return ok(ttsIndisponivel());
    if ((m = caminho.match(/^\/agent\/digest\/([^/]+)$/))) return ok(pedidoGeracaoDigest(raiz, dec(m[1])));
  }
  return null;
}

/**
 * Atende uma chamada da interface.
 * @returns {Promise<{status:number, corpo:any}>}
 */
export async function atenderApi(tusab, metodo, caminho, query, lerCorpo) {
  const motor = tusab.motor;
  const raiz = tusab.raiz;
  const corpo = async () => {
    if (metodo === 'GET') return {};
    const c = await lerCorpo();
    return c instanceof FormData ? c : (c || {});
  };
  const json = async () => {
    const c = await corpo();
    if (c instanceof FormData) throw new ErroHttp(415, 'Envie JSON.');
    return c;
  };
  const projetoAtivo = (nome) => nome || motor.stats.projeto_nome || '';
  const depoisDeMudar = (r) => {
    if (r?.ok) try { tusab.sincronizar(); } catch { /* o índice tenta de novo na próxima consulta */ }
    return r;
  };
  const ok = (c, status = 200) => ({ status, corpo: c });
  const rota = `${metodo} ${caminho}`;

  switch (rota) {
    // ── Extração ───────────────────────────────────────────────────────────
    case 'GET /status': return ok(motor.status());
    case 'GET /conexao': return ok(tusab.estadoConexao());
    case 'POST /log/clear': return ok(motor.limparLog());
    case 'POST /set-channel': return ok(motor.definirCanal(await json()));
    case 'POST /start': return ok(motor.iniciar(await json()));
    case 'POST /pause': return ok(motor.pausar());
    case 'POST /cancel': return ok(motor.cancelarExtracao());
    case 'GET /queue': return ok(motor.filaStatus());
    case 'POST /queue/add': return ok(motor.filaAdicionar(await json()));
    case 'DELETE /queue/clear': return ok(motor.filaLimpar());
    case 'POST /queue/move': return ok(motor.filaMover(await json()));
    case 'GET /canal-search': {
      const q = String(query.get('q') || '').trim();
      if (q.length > 200) return ok({ error: true, message: t('Termo de busca muito longo') });
      return ok({ canais: await motor.ytdlp.buscarCanais(q, 10) });
    }
    case 'GET /canal-info': {
      const url = String(query.get('url') || '').trim();
      if (!URL_CANAL.test(url)) return ok({ error: true, message: t('URL inválida') });
      return ok(await motor.ytdlp.infoCanal(url));
    }
    case 'GET /playlists-canal': {
      const url = String(query.get('url') || '').trim();
      if (!URL_CANAL.test(url)) return ok({ error: true, message: t('URL inválida') });
      return ok(await motor.ytdlp.playlistsCanal(url));
    }

    // ── Repositório, histórico e relatório ─────────────────────────────────
    case 'GET /history': return ok(resumirProjetosYoutube(raiz));
    case 'GET /repositorio': return ok(listarRepositorio(raiz));
    case 'GET /neural/projetos': return ok(listarProjetos(raiz));
    case 'POST /neural/projeto': return ok(criarProjeto(raiz, (await json()).nome));
    case 'POST /neural/texto': {
      const { titulo, conteudo, canal } = await json();
      return ok(tusab.salvarTexto({ titulo, conteudo, projeto: projetoAtivo(canal) }));
    }
    case 'POST /neural/upload': {
      const form = await corpo();
      const arquivo = form instanceof FormData ? form.get('arquivo') : null;
      if (!arquivo || typeof arquivo.arrayBuffer !== 'function') return ok({ error: true, message: t('Nenhum arquivo enviado.') });
      const bytes = Buffer.from(await arquivo.arrayBuffer());
      return ok(depoisDeMudar(await salvarDocumento(raiz, { nome: arquivo.name || 'arquivo', bytes, projeto: projetoAtivo(form.get('canal')) })));
    }
    case 'POST /neural/url': {
      const { url, canal } = await json();
      return ok(depoisDeMudar(await salvarPagina(raiz, { url, projeto: projetoAtivo(canal) })));
    }
    case 'POST /neural/buscar': return ok(buscarTexto(raiz, await json()));
    case 'POST /neural/ler-arquivo': return ok(lerArquivo(raiz, (await json()).caminho));
    case 'DELETE /neural/limpar': return ok(depoisDeMudar(limparProjeto(raiz, await json())));
    case 'DELETE /historico/limpar': return ok(limparHistorico(raiz, (await json()).prefixos || []));
    case 'DELETE /reset-total': {
      if (motor.is_running) motor.cancelarExtracao();
      await motor.execucao;
      const r = resetTotal(raiz);
      motor.fila = [];
      motor.logs = [];
      motor.canal_url = '';
      motor.projeto_nome = '';
      motor.stats = { ...motor.stats, status: 'Ocioso', progress: 0, projeto_nome: '' };
      tusab.indice.recriar();
      return ok(r);
    }
    case 'GET /metrics': {
      const current = historicoMetricas.at(-1) || amostrarMetricas();
      return ok({ current, history: [...historicoMetricas], available: true });
    }
    case 'GET /open-folder': {
      const nome = String(query.get('name') || '');
      const prefixo = query.get('prefixo') ? sanitizarNome(query.get('prefixo'), '') : '';
      const c = caminhos(raiz);
      const pastas = {
        data: c.data,
        gestao: prefixo ? path.join(pastaProjeto(raiz, prefixo), 'management') : c.neural,
        projeto: prefixo ? pastaProjeto(raiz, prefixo) : c.neural,
        canal_youtube: prefixo ? path.join(pastaProjeto(raiz, prefixo), 'youtube') : c.neural,
        canal_documents: prefixo ? path.join(pastaProjeto(raiz, prefixo), 'documents') : c.neural,
      };
      const alvo = pastas[nome];
      if (!alvo) return ok({ error: true, message: 'Pasta desconhecida' });
      if (alvo !== c.data && alvo !== c.neural && !dentroDe(c.neural, alvo)) throw new ErroHttp(400, t('Caminho inválido'));
      fs.mkdirSync(alvo, { recursive: true });
      abrirPasta(alvo);
      return ok({ ok: true });
    }
    default:
      break;
  }

  // Índice de busca: a "indexação" do desktop vira a sincronização do SQLite.
  if (rota === 'GET /agent/status') {
    const canais = tusab.indice.resumoPorProjeto();
    const projeto = query.get('canal') ? sanitizarNome(query.get('canal'), '') : '';
    const doProjeto = canais.find((c) => c.nome === projeto);
    return ok({
      configured: true,
      provider: 'externo',
      canal_indexado: projeto,
      index_count: doProjeto ? doProjeto.chunks : canais.reduce((s, c) => s + c.chunks, 0),
      indexed: canais.length > 0,
      canais_indexados: canais,
      base_desatualizada: false,
      novos_desde_indexacao: 0,
      indices_corrompidos: [],
      indexing: false,
      logs: [],
      progress: { processed: 0, total: 0 },
    });
  }
  if (rota === 'POST /agent/index') {
    const r = tusab.sincronizar();
    return ok({ ok: true, message: t('Índice atualizado ({lidos} arquivo(s) lido(s)).', { lidos: r.lidos }), ...r });
  }
  if (rota === 'POST /agent/config') return ok({ ok: true, modo_extensao: true });
  // ── Atualização automática de canais (fase B) ──────────────────────────
  if (rota === 'POST /auto-update/config') return ok(tusab.atualizacao.salvarConfig(await json()));
  if (rota === 'POST /auto-update/run') return ok(tusab.atualizacao.executar());

  // ── Exportações e base compartilhável .tusab (fase B) ──────────────────
  // Arquivo: { corpo: Buffer, cabecalhos } · erro: JSON com status 200, como o desktop.
  const arquivo = (r) => (Buffer.isBuffer(r.corpo)
    ? { status: 200, corpo: r.corpo, tipo: r.cabecalhos?.['Content-Type'] || r.tipo, cabecalhos: r.cabecalhos }
    : ok(r.corpo));
  if (rota === 'POST /export/base') return arquivo(await exportarBase(raiz));
  if (rota === 'POST /export/tabela-videos') return arquivo(await exportarTabelaVideos(raiz, await json(), projetoAtivo('')));
  if (rota === 'POST /export/relatorio-pdf') return arquivo(await exportarRelatorioPdf(await json(), motor.stats.projeto_nome));
  if (rota === 'GET /export/readonly-status') return ok(statusSomenteLeitura(raiz));
  if (rota === 'POST /import/base-compartilhavel') {
    const form = await corpo();
    const enviado = form instanceof FormData ? form.get('arquivo') : null;
    if (!enviado || typeof enviado.arrayBuffer !== 'function') return { status: 400, corpo: { error: true, message: t('Nenhum arquivo enviado.') } };
    const r = depoisDeMudar(importarBaseCompartilhavel(raiz, { nome: enviado.name || '', bytes: Buffer.from(await enviado.arrayBuffer()) }));
    // A tela só mostra o erro da importação quando o HTTP não é 2xx.
    return { status: r.error ? 400 : 200, corpo: r };
  }

  // Rotas com parâmetro no caminho
  let m;
  if (metodo === 'GET' && (m = caminho.match(/^\/auto-update\/config\/([^/]+)$/))) {
    return ok(tusab.atualizacao.lerConfig(decodeURIComponent(m[1]), query.get('projeto_prefixo') || ''));
  }
  if (metodo === 'GET' && (m = caminho.match(/^\/export\/base-compartilhavel\/([^/]+)$/))) {
    // ?originais=1: incluir os arquivos originais (desligado por padrão — podem ter dados pessoais).
    return arquivo(await exportarBaseCompartilhavel(raiz, decodeURIComponent(m[1]), { comOriginais: query.get('originais') === '1' }));
  }
  if (metodo === 'GET' && (m = caminho.match(/^\/relatorio\/(.+)$/))) return ok(relatorio(raiz, decodeURIComponent(m[1])));
  if (metodo === 'DELETE' && (m = caminho.match(/^\/queue\/item\/(-?\d+)$/))) return ok(motor.filaRemover(Number(m[1])));
  if (metodo === 'DELETE' && (m = caminho.match(/^\/prompts\/usuario\/(u-[0-9a-f]{8})$/))) {
    const r = excluirPromptUsuario(raiz, m[1]);
    if (r.ok) tusab.aoMudarPrompts?.();
    return ok(r);
  }
  if (metodo === 'DELETE' && (m = caminho.match(/^\/neural\/arquivo\/([^/]+)\/([^/]+)$/))) {
    return ok(depoisDeMudar(excluirArquivo(raiz, decodeURIComponent(m[1]), decodeURIComponent(m[2]))));
  }
  // ── Prompts prontos (a IA gera; o Tusab entrega o pedido certo) ────────
  if (rota === 'GET /prompts') return ok(listarPrompts(raiz));
  if (rota === 'POST /prompts/montar') {
    const { id, projeto, tema, quantidade, navegador } = await json();
    try {
      if (!navegador) return ok({ ok: true, texto: montarPrompt(id, { projeto, tema, quantidade }, raiz) });
      // IA no navegador: os trechos vão dentro do pedido (do tema, ou um panorama do projeto)
      tusab.sincronizar();
      const proj = String(projeto || '').trim();
      let trechos = tema && String(tema).trim() ? tusab.indice.buscar(String(tema), { projeto: proj, limite: 12 }) : [];
      if (trechos.length < 4) {
        const vistos = new Set(trechos.map((x) => x.trecho_id));
        trechos = [...trechos, ...tusab.indice.panorama(proj, { limite: 12 }).filter((x) => !vistos.has(x.trecho_id))].slice(0, 12);
      }
      const r = montarPromptComTrechos(id, { projeto: proj, tema, quantidade }, trechos, raiz);
      return ok({ ok: true, texto: r.texto, trechos: r.trechos });
    } catch (e) {
      return ok({ error: true, message: e.message });
    }
  }
  // ── Economia de tokens (estimativa local) ──────────────────────────────
  if (rota === 'GET /economia-tokens') return ok(resumoEconomia(raiz));
  if (rota === 'POST /economia-tokens/zerar') return ok(zerarEconomia(raiz));
  if (rota === 'POST /economia-tokens/medir') {
    // Teste "com e sem o Tusab": uma pergunta por linha (até 50).
    const { projeto, perguntas } = await json();
    const lista = (Array.isArray(perguntas) ? perguntas : String(perguntas || '').split(/\r?\n/))
      .map((p) => String(p).trim()).filter(Boolean).slice(0, 50);
    if (!projeto || !lista.length) return ok({ error: true, message: t('Escolha um projeto e escreva ao menos uma pergunta.') });
    tusab.sincronizar();
    return ok(medirPerguntas(tusab.indice, sanitizarNome(projeto, ''), lista));
  }

  // "Meus prompts": criar (sem id) ou alterar (com id); o "+" do Claude acompanha.
  if (rota === 'POST /prompts/pasta') {
    const { de, para } = await json();
    const r = renomearPasta(raiz, de, para);
    if (r.ok) tusab.aoMudarPrompts?.();
    return ok(r);
  }
  if (rota === 'POST /prompts/usuario') {
    const r = salvarPromptUsuario(raiz, await json());
    if (r.ok) tusab.aoMudarPrompts?.();
    return ok(r);
  }

  // ── Fontes públicas (fase C) ───────────────────────────────────────────
  if (rota === 'GET /fontes') return ok(tusab.fontes.listar());
  if ((m = caminho.match(/^\/fontes\/([^/]+)\/(search|status|cancel)$/))) {
    const id = decodeURIComponent(m[1]);
    if (metodo === 'GET' && m[2] === 'status') return ok(tusab.fontes.status(id));
    if (metodo === 'POST' && m[2] === 'cancel') return ok(tusab.fontes.cancelar(id));
    if (metodo === 'POST' && m[2] === 'search') {
      try { return ok(tusab.fontes.buscar(id, await json())); } catch (e) {
        if (e instanceof ErroValidacaoFontes) return { status: 422, corpo: { detail: e.detail } };
        throw e;
      }
    }
  }

  const estudo = await rotaEstudo(tusab, metodo, caminho, json);
  if (estudo) return estudo;

  if (NEUTRAS[rota]) return ok(NEUTRAS[rota]());
  if (metodo === 'GET' && caminho.startsWith('/agent/')) return ok({ indisponivel_na_extensao: true });
  throw new ErroHttp(404, t('Recurso não disponível na extensão.'));
}

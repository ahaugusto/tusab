// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Porte de tusab_engine/api/router_fontes.py: as rotas genéricas de busca em
// fontes públicas (perfis Pesquisador e Professor). Cada método devolve o
// mesmo JSON da rota do FastAPI:
//
//   listar()              GET  /fontes                → {areas: {...}}
//   buscar(id, corpo)     POST /fontes/{id}/search    → {ok, message} | {error, message}
//   status(id)            GET  /fontes/{id}/status    → {running, status, total, processed, itens?, message?}
//   cancelar(id)          POST /fontes/{id}/cancel    → {message}
//
// A busca roda em segundo plano (BackgroundTasks no desktop) e o estado de cada
// fonte é consultável por status(). Corpo inválido gera ErroValidacao (o 422 do
// pydantic, com o mesmo `detail`). Ao terminar com documentos novos, chama
// aoSalvar(projeto) — no desktop, disparar_reindexacao_incremental().

import fs from 'node:fs';
import path from 'node:path';
import { caminhos, dentroDe } from '../nucleo/caminhos.js';
import { EventoCancelar, mensagemErroBuscaExterna } from './_base.js';
import { listarFontes, obterFonte } from './index.js';
import { t } from '../nucleo/idioma.js';

/** Corpo inválido: equivale ao HTTP 422 do FastAPI. `detail` tem o formato do pydantic v2. */
export class ErroValidacao extends Error {
  constructor(detail) {
    super(detail.map((d) => `${d.loc.slice(1).join('.') || 'corpo'}: ${d.msg}`).join('; '));
    this.name = 'ErroValidacao';
    this.status = 422;
    this.detail = detail;
  }
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$|^$/;
const comprimento = (s) => Array.from(s).length;

/**
 * Mesma validação do FonteSearchRequest (pydantic v2, modo lax):
 *   query str 2..300 · max_resultados int 1..50 (padrão 20) · projeto_nome str ≤120 (obrigatório)
 *   data_inicio/data_fim "" ou AAAA-MM-DD · autor str ≤120 · subfontes list[str] ≤60 itens
 */
export function validarPedido(corpo) {
  const erros = [];
  const erro = (campo, type, msg, input, ctx) => erros.push({
    type, loc: campo === null ? ['body'] : ['body', ...[].concat(campo)], msg, input, ...(ctx ? { ctx } : {}),
  });
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    erro(null, 'model_attributes_type', 'Input should be a valid dictionary or object to extract fields from', corpo ?? null);
    throw new ErroValidacao(erros);
  }

  const texto = (campo, { obrigatorio = false, padrao = '', min = 0, max = Infinity, padraoRe = null } = {}) => {
    if (!(campo in corpo) || corpo[campo] === undefined) {
      if (obrigatorio) { erro(campo, 'missing', 'Field required', corpo); return undefined; }
      return padrao;
    }
    const v = corpo[campo];
    if (typeof v !== 'string') { erro(campo, 'string_type', 'Input should be a valid string', v); return undefined; }
    const n = comprimento(v);
    if (n < min) {
      erro(campo, 'string_too_short', `String should have at least ${min} character${min === 1 ? '' : 's'}`, v, { min_length: min });
      return undefined;
    }
    if (n > max) {
      erro(campo, 'string_too_long', `String should have at most ${max} character${max === 1 ? '' : 's'}`, v, { max_length: max });
      return undefined;
    }
    if (padraoRe && !padraoRe.test(v)) {
      erro(campo, 'string_pattern_mismatch', `String should match pattern '${String.raw`^\d{4}-\d{2}-\d{2}$|^$`}'`, v,
        { pattern: String.raw`^\d{4}-\d{2}-\d{2}$|^$` });
      return undefined;
    }
    return v;
  };

  const inteiro = (campo, padrao, min, max) => {
    if (!(campo in corpo) || corpo[campo] === undefined) return padrao;
    const v = corpo[campo];
    let n;
    if (typeof v === 'boolean') n = v ? 1 : 0;
    else if (typeof v === 'number') {
      if (!Number.isFinite(v)) { erro(campo, 'finite_number', 'Input should be a finite number', v); return undefined; }
      if (!Number.isInteger(v)) {
        erro(campo, 'int_from_float', 'Input should be a valid integer, got a number with a fractional part', v);
        return undefined;
      }
      n = v;
    } else if (typeof v === 'string' && /^\s*[+-]?\d+(?:_\d+)*\s*$/.test(v)) {
      n = Number(v.replace(/_/g, '').trim());
    } else if (typeof v === 'string') {
      erro(campo, 'int_parsing', 'Input should be a valid integer, unable to parse string as an integer', v);
      return undefined;
    } else {
      erro(campo, 'int_type', 'Input should be a valid integer', v);
      return undefined;
    }
    if (n < min) { erro(campo, 'greater_than_equal', `Input should be greater than or equal to ${min}`, v, { ge: min }); return undefined; }
    if (n > max) { erro(campo, 'less_than_equal', `Input should be less than or equal to ${max}`, v, { le: max }); return undefined; }
    return n;
  };

  const lista = (campo, maxItens) => {
    if (!(campo in corpo) || corpo[campo] === undefined) return [];
    const v = corpo[campo];
    if (!Array.isArray(v)) { erro(campo, 'list_type', 'Input should be a valid list', v); return undefined; }
    let ok = true;
    v.forEach((x, i) => {
      if (typeof x !== 'string') { erro([campo, i], 'string_type', 'Input should be a valid string', x); ok = false; }
    });
    if (v.length > maxItens) {
      erro(campo, 'too_long', `List should have at most ${maxItens} items after validation, not ${v.length}`, v,
        { field_type: 'List', max_length: maxItens, actual_length: v.length });
      ok = false;
    }
    return ok ? [...v] : undefined;
  };

  const pedido = {
    query: texto('query', { obrigatorio: true, min: 2, max: 300 }),
    max_resultados: inteiro('max_resultados', 20, 1, 50),
    projeto_nome: texto('projeto_nome', { obrigatorio: true, max: 120 }),
    data_inicio: texto('data_inicio', { padraoRe: RE_DATA }),
    data_fim: texto('data_fim', { padraoRe: RE_DATA }),
    autor: texto('autor', { max: 120 }),
    subfontes: lista('subfontes', 60),
  };
  if (erros.length) throw new ErroValidacao(erros);
  return pedido;
}

export class ServicoFontes {
  /**
   * @param {string} raiz pasta que contém data/
   * @param {{aoSalvar?: (projeto: string, info: object) => any, aoLogar?: (linha: string, info: object) => void}} opcoes
   */
  constructor(raiz, { aoSalvar = null, aoLogar = null } = {}) {
    this.raiz = raiz;
    this.aoSalvar = aoSalvar;
    this.aoLogar = aoLogar;
    this.estados = new Map();
    this.tarefas = new Map();
  }

  /** Estado por fonte é criado sob demanda, como no desktop. */
  _estado(fonteId) {
    if (!this.estados.has(fonteId)) {
      this.estados.set(fonteId, {
        running: false,
        cancel: new EventoCancelar(),
        stats: { status: 'Ocioso', total: 0, processed: 0 },
      });
    }
    return this.estados.get(fonteId);
  }

  _log(linha, info) {
    if (!this.aoLogar) return;
    try { this.aoLogar(linha, info); } catch { /* log nunca derruba a busca */ }
  }

  /** GET /fontes */
  listar() {
    return { areas: listarFontes() };
  }

  /** POST /fontes/{fonte_id}/search — valida, confere projeto e dispara a busca em segundo plano. */
  buscar(fonteId, corpo) {
    const req = validarPedido(corpo);
    const fonte = obterFonte(fonteId);
    if (!fonte) return { error: true, message: t('Fonte desconhecida') };

    const fstate = this._estado(fonteId);
    if (fstate.running) return { error: true, message: t('Já há uma busca em {nome} em andamento', { nome: t(fonte.FONTE_META.nome) }) };

    // Mesma regra do desktop (re.sub(r'[<>:"/\\|?*\s]', '_', ...).strip('_')); a mais,
    // pontos no início saem e o caminho final precisa ficar dentro de data/neural.
    const prefixo = req.projeto_nome.trim().replace(/[<>:"/\\|?*\s]/g, '_').replace(/^[_.]+|_+$/g, '');
    if (!prefixo) return { error: true, message: t('Selecione um projeto antes de buscar') };

    const neural = caminhos(this.raiz).neural;
    const projetoDir = path.join(neural, prefixo);
    if (!dentroDe(neural, projetoDir) || !fs.existsSync(projetoDir) || !fs.statSync(projetoDir).isDirectory()) {
      return { error: true, message: t('Projeto não encontrado. Crie o projeto antes de buscar.') };
    }

    // O desktop só marca "running" quando a tarefa começa; aqui já fica marcado
    // ao aceitar o pedido, para dois cliques seguidos não abrirem duas buscas.
    fstate.running = true;
    fstate.stats = { status: t('Buscando em {nome}', { nome: t(fonte.FONTE_META.nome) }), total: 0, processed: 0, itens: [] };
    fstate.cancel.clear();

    const tarefa = new Promise((resolve) => setImmediate(resolve)).then(() => this._executar(
      fonteId, req.query.trim(), req.max_resultados, prefixo, req.data_inicio, req.data_fim, req.autor.trim(), req.subfontes,
    ));
    this.tarefas.set(fonteId, tarefa);
    return { ok: true, message: 'Busca iniciada' };
  }

  async _executar(fonteId, query, maxResultados, projeto, dataInicio, dataFim, autor, subfontes) {
    const fonte = obterFonte(fonteId);
    const fstate = this._estado(fonteId);
    const nomeFonte = t(fonte.FONTE_META.nome);
    const info = { projeto, fonte: fonteId };
    try {
      fstate.running = true;
      fstate.stats = { status: `Buscando em ${nomeFonte}`, total: 0, processed: 0, itens: [] };

      const filtroAutor = autor.trim() ? t(' do(a) autor(a) {autor}', { autor }) : '';
      const periodo = dataInicio || dataFim ? ` entre ${dataInicio || '...'} e ${dataFim || 'hoje'}` : '';
      this._log(t('🔎 Buscando "{query}"{filtroAutor} em {nomeFonte}{periodo} (até {maxResultados} resultados)...', { query, filtroAutor, nomeFonte, periodo, maxResultados }), info);

      const dispatch = (evento, dados = {}) => {
        if (evento === 'total') {
          const total = dados.total ?? 0;
          fstate.stats.total = total;
          fstate.stats.status = 'Baixando resultados';
          this._log(`📄 ${total} resultado(s) encontrado(s) em ${nomeFonte} — salvando...`, info);
        } else if (evento === 'processed') {
          const processed = dados.processed ?? 0;
          fstate.stats.processed = processed;
          if (dados.titulo) fstate.stats.itens.push(dados.titulo);
          this._log(t('💾 Resultado {processed}/{total} salvo no projeto ({nomeFonte})', { processed, total: fstate.stats.total, nomeFonte }), info);
        }
      };

      const extra = {};
      const validas = fonte.FONTE_META.subfontes;
      if (validas && subfontes && subfontes.length) extra.subfontes = subfontes.filter((x) => validas.includes(x));

      const resultado = await fonte.buscar({
        query, max_resultados: maxResultados, projeto_nome: projeto,
        data_inicio: dataInicio, data_fim: dataFim, autor,
        evento_cancelar: fstate.cancel, dispatch_event: dispatch, raiz: this.raiz, ...extra,
      });
      fstate.stats.status = resultado?.ok ? 'Finalizado ✓' : 'Erro';
      if (resultado?.ok) {
        const totalSalvos = resultado.total_salvos ?? 0;
        this._log(t('🏁 Busca em {nomeFonte} concluída — {totalSalvos} resultado(s) salvos.', { nomeFonte, totalSalvos }), info);
        // Reindexação em segundo plano: não segura o "running" da fonte.
        if (totalSalvos > 0 && this.aoSalvar) {
          setImmediate(() => {
            Promise.resolve()
              .then(() => this.aoSalvar(projeto, { fonte_id: fonteId, total_salvos: totalSalvos }))
              .catch((e) => this._log(t('⚠️ Reindexação após a busca em {nomeFonte} falhou: {v}', { nomeFonte, v: e?.message ?? e }), info));
          });
        }
      }
    } catch (e) {
      const mensagem = mensagemErroBuscaExterna(e, nomeFonte);
      this._log(`❌ ERRO NA BUSCA ${fonteId.toUpperCase()}: ${mensagem}`, info);
      fstate.stats.status = 'Erro';
      fstate.stats.message = mensagem;
    } finally {
      fstate.running = false;
    }
  }

  /** POST /fontes/{fonte_id}/cancel — não desfaz resultados já salvos. */
  cancelar(fonteId) {
    const fstate = this._estado(fonteId);
    if (fstate.running) {
      fstate.cancel.set();
      return { message: 'Cancelando' };
    }
    return { message: 'Nenhuma busca em andamento' };
  }

  /** GET /fontes/{fonte_id}/status (polling). */
  status(fonteId) {
    const fstate = this._estado(fonteId);
    return { running: fstate.running, ...structuredClone(fstate.stats) };
  }

  /** Espera a busca em andamento na fonte terminar (testes, MCP e encerramento). */
  aguardar(fonteId) {
    return this.tarefas.get(fonteId) ?? Promise.resolve();
  }

  /** Cancela todas as buscas em andamento (ao fechar o plugin). */
  cancelarTodas() {
    for (const fstate of this.estados.values()) if (fstate.running) fstate.cancel.set();
    return Promise.all([...this.tarefas.values()]);
  }
}

// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// O Tusab da extensão: um repositório (pasta com data/), o motor de extração
// e o índice de busca. Uma instância por processo do plugin; a interface (via
// API local) e a IA (via MCP) usam a mesma — a tela vê as extrações pedidas pela IA.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataBr, escreverAtomico, garantirEstrutura, lerJson, salvarJson, sanitizarNome } from './caminhos.js';
import { pastaProjeto } from './gestao.js';
import { Indice } from './indice.js';
import { Atualizacao } from './atualizacao.js';
import { Motor } from './motor.js';
import { ServicoFontes } from '../fontes/servico.js';
import { carregarIdioma } from './idioma.js';
import { t } from './idioma.js';

const TAMANHO_MAX_TEXTO = 5 * 1024 * 1024;

export class Tusab {
  constructor(raiz, indice, motor) {
    this.raiz = raiz;
    this.indice = indice;
    this.motor = motor;
    // Atualização automática de canais: verifica ao abrir e de hora em hora (timers não seguram o processo).
    this.atualizacao = new Atualizacao(raiz, motor);
    // Fontes públicas (fase C): resultados vão para documents/ e entram no índice; log no mesmo painel do motor.
    this.fontes = new ServicoFontes(raiz, { aoSalvar: () => this.sincronizar(), aoLogar: (linha) => motor.log(linha) });
  }

  static async abrir(raiz, opcoes = {}) {
    garantirEstrutura(raiz);
    carregarIdioma(raiz);
    const indice = await Indice.abrir(raiz);
    const motor = new Motor(raiz, { ...opcoes, aoConcluir: () => indice.sincronizar() });
    const tusab = new Tusab(raiz, indice, motor);
    try { indice.sincronizar(); } catch (e) { process.stderr.write(`[tusab] índice: ${e.message}\n`); }
    return tusab;
  }

  /** Atualiza o índice se algum .txt mudou (barato quando nada mudou). */
  sincronizar() {
    return this.indice.sincronizar();
  }

  /**
   * Mesmo formato de POST /neural/texto do desktop: neural/{projeto}/texts/{id}_{nome}.txt
   * com cabeçalho TITULO/FONTE/DATA e entrada em _manifest.json.
   */
  salvarTexto({ titulo, conteudo, projeto, tipo = 'texto' }) {
    const proj = sanitizarNome(String(projeto || '').slice(0, 120), '');
    if (!proj) return { error: true, message: t('Selecione um projeto antes de salvar texto.') };
    const corpo = String(conteudo ?? '');
    if (!corpo.trim()) return { error: true, message: t('Conteúdo vazio') };
    if (Buffer.byteLength(corpo, 'utf8') > TAMANHO_MAX_TEXTO) return { error: true, message: 'Texto maior que 5 MB.' };
    const tit = String(titulo || 'texto').slice(0, 200);
    const dir = path.join(pastaProjeto(this.raiz, proj), 'texts');
    fs.mkdirSync(dir, { recursive: true });
    const fid = crypto.randomUUID().slice(0, 8);
    const nomeLimpo = tit.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'texto';
    const nomeTxt = `${fid}_${nomeLimpo}.txt`;
    escreverAtomico(path.join(dir, nomeTxt), `TITULO: ${tit}\nFONTE: ${tipo}\nDATA: ${dataBr()}\n${'-'.repeat(70)}\n${corpo}`);
    const manifestoPath = path.join(dir, '_manifest.json');
    const manifesto = lerJson(manifestoPath, []);
    const lista = Array.isArray(manifesto) ? manifesto : [];
    lista.push({ id: fid, titulo: tit, nome_txt: nomeTxt, tipo, chars: corpo.length, data: dataBr() });
    salvarJson(manifestoPath, lista, 2);
    try { this.indice.sincronizar(); } catch { /* o índice tenta de novo na próxima consulta */ }
    return { ok: true, id: fid, titulo: tit, projeto: proj, arquivo: `data/neural/${proj}/texts/${nomeTxt}` };
  }

  fechar() {
    this.atualizacao.pararAgendamento();
    this.fontes.cancelarTodas().catch(() => {});
    this.indice.fechar();
  }
}

#!/usr/bin/env node
// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Linha de comando do repositório (mesmo motor do plugin, sem a IA).
//
//   node src/cli.js painel [--sem-navegador]     abre a tela do Tusab (Ctrl+C fecha)
//   node src/cli.js projetos
//   node src/cli.js buscar "<consulta>" [projeto]
//   node src/cli.js youtube <link> <projeto> [max_videos]
//   node src/cli.js indexar
//   node src/cli.js medir-tokens <perguntas.txt> <projeto> [saida.csv]

import fs from 'node:fs';
import { Painel, abrirNoNavegador } from './painel.js';
import { medirPerguntas } from './nucleo/tokens.js';
import { pastaRepositorio } from './nucleo/caminhos.js';
import { Tusab } from './nucleo/tusab.js';
import { VERSAO } from './servidor.js';

const [comando, ...args] = process.argv.slice(2);

async function principal() {
  const tusab = await Tusab.abrir(pastaRepositorio());
  console.log(`Repositório: ${tusab.raiz}`);

  switch (comando) {
    case 'painel': {
      tusab.atualizacao.iniciarAgendamento();
      const url = await new Painel(tusab, { versao: VERSAO }).iniciar();
      console.log(`Painel do Tusab: ${url}`);
      if (!args.includes('--sem-navegador')) abrirNoNavegador(url);
      return; // o servidor mantém o processo aberto
    }
    case 'projetos':
      console.table(tusab.indice.listarProjetos());
      break;
    case 'indexar':
      console.log(tusab.sincronizar());
      break;
    case 'medir-tokens': {
      // Teste "com e sem o Tusab": um arquivo com uma pergunta por linha (ex.: 20 perguntas reais).
      const [arquivoPerguntas, projeto, saidaCsv] = args;
      const perguntas = fs.readFileSync(arquivoPerguntas, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      tusab.sincronizar();
      const r = medirPerguntas(tusab.indice, projeto, perguntas);
      console.table(r.perguntas.map((l) => ({ pergunta: l.pergunta.slice(0, 50), trechos: l.trechos, tusab: l.tokens_tusab, fontes_inteiras: l.tokens_fontes_inteiras, projeto_inteiro: l.tokens_projeto_inteiro })));
      console.log(`Estimativa ${r.estimativa}. Economia: ${r.total.economia_vs_fontes_inteiras}% contra anexar as fontes inteiras; ` +
        `${r.total.economia_vs_projeto_inteiro}% contra anexar o projeto inteiro. Sem resposta na base: ${r.total.sem_resposta}.`);
      if (saidaCsv) {
        const cel = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const linhas = [['pergunta', 'trechos', 'tokens_tusab', 'tokens_fontes_inteiras', 'tokens_projeto_inteiro'].join(','),
          ...r.perguntas.map((l) => [cel(l.pergunta), l.trechos, l.tokens_tusab, l.tokens_fontes_inteiras, l.tokens_projeto_inteiro].join(','))];
        fs.writeFileSync(saidaCsv, `﻿${linhas.join('\n')}\n`);
        console.log(`CSV: ${saidaCsv}`);
      }
      break;
    }
    case 'buscar': {
      const [consulta, projeto] = args;
      for (const a of tusab.indice.buscar(consulta || '', { projeto })) {
        console.log(`\n▶ ${a.minuto ?? '--'}  ${a.titulo_trecho}  (${a.projeto})\n  ${a.link ?? ''}\n  ${a.texto.slice(0, 240)}…`);
      }
      break;
    }
    case 'youtube': {
      const [url, projeto, max] = args;
      const m = tusab.motor;
      m.extrairOuEnfileirar({ url, projeto_nome: projeto, maxVideos: Number(max) || null });
      let visto = 0;
      const relogio = setInterval(() => {
        for (const l of m.logs.slice(visto)) console.log(`${l.timestamp} ${l.message}`);
        visto = m.logs.length;
      }, 1000);
      await m.execucao;
      clearInterval(relogio);
      for (const l of m.logs.slice(visto)) console.log(`${l.timestamp} ${l.message}`);
      console.log(`Status: ${m.stats.status}`);
      break;
    }
    default:
      console.log('Comandos: painel | projetos | indexar | medir-tokens <perguntas.txt> <projeto> [saida.csv] | buscar "<consulta>" [projeto] | youtube <link> <projeto> [max]');
      process.exitCode = 2;
  }
  tusab.fechar();
}

principal().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
});

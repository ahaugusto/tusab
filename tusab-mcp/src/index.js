#!/usr/bin/env node
// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Ponto de entrada do plugin MCP (iniciado pela ferramenta de IA).
//
// O stdout é o canal do protocolo MCP: qualquer console.log de uma biblioteca
// (pdfjs, por exemplo, avisa quando falta um componente opcional) corromperia a
// conversa com a IA. Por isso, antes de carregar qualquer módulo, console.log/
// info/debug passam a escrever no stderr.
const paraStderr = (...args) => console.error(...args);
console.log = paraStderr;
console.info = paraStderr;
console.debug = paraStderr;

const { iniciar } = await import('./servidor.js');

iniciar().catch((e) => {
  process.stderr.write(`[tusab] falha ao iniciar: ${e.stack || e.message}\n`);
  process.exit(1);
});

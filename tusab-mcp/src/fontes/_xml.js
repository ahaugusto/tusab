// Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
// Mini ElementTree sobre o fast-xml-parser: os adaptadores do Python usam
// xml.etree.ElementTree (findall/findtext/itertext, .text, .tail, .attrib).
// Aqui o XML vira a mesma árvore, com os mesmos nomes de método, para o porte
// ficar linha a linha. Prefixos de namespace são descartados (o Python
// comparava "{ns}tag"; nas fontes do Tusab o nome local basta).

import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  commentPropName: '#comment',
});

export class Elemento {
  constructor(tag, attrib = {}) {
    this.tag = tag;
    this.attrib = attrib;
    this.text = null;
    this.tail = null;
    this.filhos = [];
  }

  get(nome, padrao = null) {
    return Object.prototype.hasOwnProperty.call(this.attrib, nome) ? this.attrib[nome] : padrao;
  }

  /** Itera este elemento e todos os descendentes (Element.iter). */
  *iter(tag = null) {
    if (tag === null || tag === '*' || this.tag === tag) yield this;
    for (const f of this.filhos) yield* f.iter(tag);
  }

  /** Element.itertext */
  *itertext() {
    if (this.text) yield this.text;
    for (const f of this.filhos) {
      yield* f.itertext();
      if (f.tail) yield f.tail;
    }
  }

  /** Suporta os caminhos usados nas fontes: "tag", "a/b", ".//tag", "./tag", "*". */
  findall(caminho) {
    let atuais = [this];
    let partes = String(caminho).split('/');
    if (partes[0] === '.') partes = partes.slice(1);
    let descendente = false;
    for (const parte of partes) {
      if (parte === '') { descendente = true; continue; }
      const proximos = [];
      for (const el of atuais) {
        if (descendente) {
          for (const d of el.iter()) if (d !== el && (parte === '*' || d.tag === parte)) proximos.push(d);
        } else {
          for (const f of el.filhos) if (parte === '*' || f.tag === parte) proximos.push(f);
        }
      }
      // .//x pode achar o mesmo nó por dois caminhos: sem repetição, na ordem do documento
      atuais = [...new Set(proximos)];
      descendente = false;
    }
    return atuais;
  }

  find(caminho) {
    return this.findall(caminho)[0] ?? null;
  }

  /** Element.findtext: texto do primeiro achado ("" se não tiver texto), ou o padrão. */
  findtext(caminho, padrao = null) {
    const el = this.find(caminho);
    if (!el) return padrao;
    return el.text ?? '';
  }
}

function construir(nos, pai) {
  let anterior = null;
  for (const no of nos) {
    if (Object.prototype.hasOwnProperty.call(no, '#text')) {
      const t = String(no['#text']);
      if (anterior) anterior.tail = (anterior.tail ?? '') + t;
      else pai.text = (pai.text ?? '') + t;
      continue;
    }
    const tag = Object.keys(no).find((k) => k !== ':@');
    if (!tag || tag === '#comment' || tag.startsWith('?')) continue;
    const el = new Elemento(tag, { ...(no[':@'] || {}) });
    construir(no[tag] || [], el);
    pai.filhos.push(el);
    anterior = el;
  }
}

/** ET.fromstring: devolve o elemento raiz. Aceita string ou bytes (UTF-8). */
export function fromstring(xml) {
  const texto = typeof xml === 'string' ? xml : new TextDecoder('utf-8').decode(xml);
  const nos = parser.parse(texto.replace(/^﻿/, ''));
  const doc = new Elemento('#documento');
  construir(nos, doc);
  const raiz = doc.filhos[0];
  if (!raiz) {
    const erro = new Error('XML sem elemento raiz');
    erro.name = 'ParseError';
    throw erro;
  }
  return raiz;
}

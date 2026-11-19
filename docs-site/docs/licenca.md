---
id: licenca
title: Licença
sidebar_label: Licença
slug: /licenca
---

# Licença

## Código — Elastic License 2.0

O código-fonte do Tusab é **source-available** sob a [Elastic License 2.0](https://github.com/criaugu/tusab/blob/main/LICENSE): pode ser lido, auditado, executado e modificado para uso próprio. A restrição relevante é **não oferecer o Tusab como serviço hospedado ou gerenciado a terceiros**.

O pacote da extensão declara `"license": "Elastic-2.0"` no `manifest.json` e leva os arquivos `LICENSE` e `TRADEMARK.md` (copiados da raiz pelo `scripts/gerar-licencas.mjs`).

## Bibliotecas de terceiros

| Onde | Arquivo |
|---|---|
| Extensão (plugin e tela embutida no `.mcpb`) | `tusab-mcp/THIRD_PARTY_NOTICES.txt`, gerado por `node scripts/gerar-licencas.mjs` com o texto completo da licença de cada biblioteca |
| Repositório | [`THIRD_PARTY_NOTICES.md`](https://github.com/criaugu/tusab/blob/main/THIRD_PARTY_NOTICES.md) na raiz (dependências diretas da extensão e da tela) |
| App desktop (descontinuado) | [`THIRD_PARTY_NOTICES.md`](https://github.com/criaugu/tusab/blob/desktop-final/THIRD_PARTY_NOTICES.md) e [`THIRD_PARTY_NOTICES.txt`](https://github.com/criaugu/tusab/blob/desktop-final/THIRD_PARTY_NOTICES.txt) na etiqueta `desktop-final` |

As bibliotecas embutidas na extensão usam licenças permissivas (MIT, ISC, BSD, Apache-2.0, BlueOak).

## Marca

O nome "Tusab" e o logo **não estão cobertos pela licença de código**. Um fork ou versão modificada precisa de outro nome e não pode sugerir ser o projeto oficial. Termos completos em [`TRADEMARK.md`](https://github.com/criaugu/tusab/blob/main/TRADEMARK.md).

## Conteúdo das fontes

A licença do Tusab cobre o código, não o conteúdo que o usuário guarda na base. Transcrições, documentos e resultados de fontes públicas seguem os termos de cada origem (por exemplo, o Stack Overflow e a Wikipédia usam CC BY-SA; o Tusab guarda o link de cada item, e no Stack Overflow também o autor e a licença).

---

Copyright © 2026 CriAugu — CNPJ 65.131.075/0001-57.

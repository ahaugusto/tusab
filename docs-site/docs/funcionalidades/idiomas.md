---
id: idiomas
title: Idiomas
sidebar_label: Idiomas
slug: /funcionalidades/idiomas
---

# Idiomas

O Tusab funciona em **português, inglês e espanhol** (`pt`, `en`, `es`).

## O que muda de idioma

| Parte | Como |
|---|---|
| Tela do Tusab | Arquivos de tradução da interface (`web_interface/src/locales/pt.json`, `en.json`, `es.json`) |
| Mensagens do plugin (respostas das ferramentas, erros, avisos) | Função `t()` em `tusab-mcp/src/nucleo/idioma.js`. A chave é a própria frase em português; as traduções ficam em `src/nucleo/textos/en.js` e `es.js` |
| Títulos das ferramentas na conversa | Atualizados na hora quando o idioma muda |
| Atalhos do "+" do Claude (prompts) e regras de busca e citação | Os 21 prompts e as regras existem nos três idiomas; títulos e textos são atualizados na hora |
| Tela de extensões do Claude Desktop | `manifest.json` em pt-BR (`default_locale`) e `mcpb-resources/en-US.json` e `es-ES.json`, gerados por `node scripts/gerar-recursos-manifesto.mjs` |

As descrições técnicas das ferramentas (lidas só pela IA) ficam em português. As instruções do servidor pedem que a IA responda sempre no idioma em que o usuário escreve.

## De onde vem o idioma

1. A tela envia o idioma escolhido no cabeçalho `X-Tusab-Idioma` de cada chamada à API (lido só depois de a [chave da sessão](/tela#segurança-do-servidor-local) ser conferida).
2. O plugin grava a escolha em `data/config/idioma.json`, para valer também no que a IA vê.
3. Antes de a tela ser aberta pela primeira vez, vale a variável `TUSAB_IDIOMA` (se definida) ou o idioma do sistema; se não for pt, en nem es, o plugin usa inglês.

## O que fica em português de propósito

Para manter a compatibilidade com o app desktop, **não** passam por tradução:

- formatos gravados em disco: rótulos dos blocos dos `.txt`, status do CSV de gestão (`Sucesso`, `Sem Legenda`…), a marca `[Página N]` nos textos de PDF;
- termos de busca enviados às fontes públicas;
- textos usados para detectar formatos (WhatsApp, reuniões, documentos jurídicos);
- nomes das ferramentas (`tusab_buscar`…).

## Teste

`tusab-mcp/test/idioma.test.js` falha se alguma frase usada no código ficar sem tradução em `en.js` ou `es.js`, ou se as variáveis (`{nome}`) não forem as mesmas. Os testes rodam sempre em português, qualquer que seja o idioma do sistema (`test/_ambiente.js` define `TUSAB_IDIOMA=pt`).

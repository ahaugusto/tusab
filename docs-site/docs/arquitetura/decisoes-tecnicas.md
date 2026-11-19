---
id: decisoes-tecnicas
title: Decisões técnicas não óbvias
sidebar_label: Decisões técnicas
slug: /arquitetura/decisoes-tecnicas
---

# Decisões técnicas não óbvias

Decisões que não seriam evidentes só lendo o código; o motivo importa tanto quanto a decisão. As do backend Python do app desktop estão em [App desktop — decisões técnicas](/desktop/decisoes-tecnicas).

| Decisão | Motivo |
|---|---|
| A IA do usuário gera o material; o Tusab só entrega o pedido e guarda a memória | A IA conversa, resume e monta quizzes melhor; o que ela não faz é lembrar entre conversas. Por isso o Tusab guarda flashcards e revisão espaçada (`tusab_salvar_estudo`, `tusab_revisao_hoje`) e oferece [prompts prontos](/biblioteca-de-prompts) em vez de gerar |
| Uma só instância atende a IA (MCP) e a tela (HTTP) | O que a IA pede aparece na tela e vice-versa, sem sincronização entre processos |
| `console.log`/`info`/`debug` redirecionados para o stderr antes de carregar qualquer módulo | O stdout é o canal do protocolo MCP; um aviso de biblioteca (o pdfjs avisa quando falta um componente opcional) corromperia a conversa com a IA |
| Mesmo formato em disco do app desktop, inclusive rótulos em português | A extensão abre bases existentes do desktop e o `.tusab` funciona nos dois sentidos |
| `.txt` como fonte da verdade; SQLite só como índice reconstruível | O índice pode ser apagado e refeito a qualquer momento; nenhum dado existe só nele |
| SQLite em WebAssembly (`@sqlite.org/sqlite-wasm`), sem binário nativo | O pacote `.mcpb` funciona em Windows e macOS sem compilar nada no computador do usuário |
| Banco em memória com gravação atômica e arquivo de trava | Mais de uma ferramenta de IA pode abrir o mesmo repositório ao mesmo tempo |
| Pergunta convertida em termos entre aspas ligados por `OR` | Expressão FTS5 sempre válida: caracteres da pergunta nunca viram operadores da consulta |
| Metadados, capítulos e legenda numa única chamada do yt-dlp por vídeo | O desktop faz três chamadas; menos chamadas, menos risco de bloqueio 429 |
| yt-dlp oficial baixado com conferência SHA-256 | O pacote não precisa levar o binário; um download alterado é descartado |
| Tela servida pelo plugin, não por um site | Navegadores como Firefox e Safari não deixam um site gravar numa pasta do computador; aqui o navegador só mostra a tela e quem grava é o plugin |
| Chave da sessão num cabeçalho próprio (`X-Tusab-Chave`) e nenhum cabeçalho CORS | Um cabeçalho próprio obriga verificação prévia em pedidos de outros sites, e o servidor não libera nenhuma |
| `Host` conferido em todo pedido | Proteção contra DNS rebinding |
| Idioma (`X-Tusab-Idioma`) só lido depois da chave | Quem não tem a chave não muda nada no plugin, nem o idioma |
| Caminho do original sempre recalculado, nunca lido do manifesto | Um manifesto alterado não consegue apontar para fora da pasta do projeto |
| Tipo de arquivo conferido pela assinatura, não só pela extensão do nome | Um executável renomeado para `.pdf` é recusado |
| Remoção de metadados de imagem com falha fechada | Se não dá para garantir que a localização saiu, a imagem não vai para a IA |
| Economia de tokens estimada localmente (~4 caracteres por token) | A contagem exata exigiria enviar o texto ao serviço da IA; e só números agregados são guardados |
| Regras de busca e citação acrescentadas pelo plugin, fora do texto editável | Valem também para os prompts do usuário, que não conseguem removê-las por engano |
| Descrições técnicas das ferramentas em português; títulos no idioma da tela | Só a IA lê as descrições (e as instruções pedem resposta no idioma do usuário); o título aparece para o usuário na conversa |
| Formatos de disco e termos de busca nas fontes fora da tradução | Trocar o idioma da tela não pode mudar o que é gravado nem o que é pedido às fontes |

## Divisão em trechos

As mesmas regras do desktop, para os mesmos `.txt`: por capítulo do YouTube quando existe; senão, janelas de 120 s com 15 s de sobreposição; teto de 3.000 caracteres por trecho, cortado na fronteira de uma linha da legenda. Documentos e textos são indexados por parágrafo; PDFs levam a marca `[Página N]` para a IA citar a página.

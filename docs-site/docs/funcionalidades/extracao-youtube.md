---
id: extracao-youtube
title: Extração do YouTube
sidebar_label: Extração do YouTube
slug: /funcionalidades/extracao-youtube
---

# Extração do YouTube

O Tusab baixa as **legendas** (não os vídeos) de canais, playlists e vídeos do YouTube com o [yt-dlp](https://github.com/yt-dlp/yt-dlp), rodando no computador e no IP do usuário, sem servidor intermediário. Código: `tusab-mcp/src/nucleo/motor.js`, `ytdlp.js` e `legendas.js`.

## Como pedir

- **Pela IA:** ferramenta `tusab_adicionar_youtube` (`url`, `projeto`, `max_videos` opcional). A extração roda em segundo plano; o andamento aparece em `tusab_status` e na tela.
- **Pela tela:** aba Extração, com busca do canal pelo nome, escolha de abas, playlists e período, log ao vivo e tempo restante.

Pedidos da IA e da tela passam pelo mesmo motor: o que a IA pede aparece na tela, e vice-versa.

## Como funciona

1. **Endereço:** canal nos formatos `youtube.com/@nome`, `youtube.com/channel/ID` ou `youtube.com/c/nome` (validados por expressão regular antes de ir ao yt-dlp). Pela ferramenta MCP, também link de playlist ou de vídeo avulso; sufixos como `/videos` ou `/shorts` são removidos do link do canal.
2. **Mapeamento por aba:** Vídeos, Shorts, Ao vivo, Podcasts, Cursos e Playlists; cada aba pode ser incluída ou excluída na tela.
3. **Recortes opcionais:** playlists específicas e intervalo de datas de publicação. Com filtro de data ativo, vídeos sem data conhecida ficam de fora. O filtro usado aparece no log, no Relatório e na Visão Geral.
4. **Legendas:** duas passagens de idioma, primeiro `pt,pt-BR` e, só se não vier nenhuma legenda, `en,es`; legendas traduzidas automaticamente são ignoradas. Metadados, capítulos e legenda vêm numa **única chamada** ao yt-dlp por vídeo (menos chamadas, menos risco de bloqueio por excesso de pedidos), com pausa de 1 s entre pedidos (`--sleep-requests 1`).
5. **Gravação:** o texto vai para `neural/{projeto}/youtube/{canal}/{canal}_Parte_N.txt`, o status de cada vídeo para `neural/{projeto}/management/{canal}_base.csv`, e o índice é atualizado.

## Divisão em trechos

- Por capítulo do YouTube, quando o vídeo tem capítulos.
- Sem capítulos: janelas de 120 s com 15 s de sobreposição (passo efetivo de 105 s).
- Teto de 3.000 caracteres por trecho, cortado na fronteira de uma linha da legenda; capítulos maiores viram várias partes.
- Cada bloco do `.txt` guarda título, aba, data, link, ID do vídeo, visualizações, minuto inicial, tags, descrição e conteúdo. É daí que vêm a citação com minuto (`▶ MM:SS`) e o link `&t=Ns` devolvidos por `tusab_buscar`.

## Status por vídeo (CSV de gestão)

`Sucesso`, `Sem Legenda`, `Legenda Curta`, `Falha Extração`, `Arquivo Ausente`. Os valores ficam em português porque o formato é o mesmo do app desktop.

## Extração incremental, pausa e fila

- Vídeos já extraídos são pulados numa nova rodada do mesmo canal; só o que é novo é processado. A extração retoma a última parte do `.txt`.
- A extração pode ser pausada e cancelada pela tela.
- **Fila:** se a IA (ou a tela) pede um canal enquanto outro está sendo extraído, o pedido entra na fila (`data/config/extraction_queue.json`); a resposta da ferramenta informa a posição.

## Atualização automática de canais

Cada canal pode ter a atualização automática ligada na tela (configuração em `management/{canal}_summary.json`). Com o plugin aberto, a verificação roda alguns segundos depois do início e depois a cada hora: lista os vídeos das abas com o yt-dlp (só metadados, `--flat-playlist`) e compara com o CSV. Havendo vídeo novo, o canal vai para o motor, ou para a fila se houver extração em andamento. Com a ferramenta de IA fechada, nada roda.

## Página web avulsa

No Repositório, uma URL de página é lida e o conteúdo principal vira um texto do projeto. O Tusab consulta o `robots.txt` do site (User-Agent `TusabBot/1.0`) e não insiste se a página não permitir acesso automatizado. Não executa JavaScript: só páginas estáticas.

## Segurança da extração

- URL do canal e ID de playlist validados por expressão regular antes de compor o comando.
- O yt-dlp é executado com lista de argumentos, nunca por shell.
- O binário do yt-dlp, quando baixado pelo plugin, tem a soma SHA-256 conferida com a publicada pelo projeto.

Ver [Segurança](/seguranca).

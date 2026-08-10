---
id: extracao-youtube
title: Extração de canais do YouTube
sidebar_label: Extração YouTube
slug: /funcionalidades/extracao-youtube
---

# Extração de canais do YouTube

O Tusab extrai canais inteiros do YouTube — centenas de vídeos — via [yt-dlp](https://github.com/yt-dlp/yt-dlp), rodando localmente no IP do próprio usuário, sem servidor intermediário.

## Como funciona

1. Cole a URL do canal (formatos aceitos: `@handle`, `channel/ID`, `c/nome`)
2. Selecione as fontes desejadas (vídeos, podcasts, shorts — cada um pode ser incluído ou excluído)
3. Opcionalmente, restrinja a playlists específicas ou a um intervalo de datas de publicação
4. Inicie — barra de progresso, log em tempo real, contador de vídeos processados

Cada vídeo tem sua legenda em português extraída (`sub_langs = 'pt'` fixo) e salva localmente como `.txt` em `neural/{projeto}/youtube/`.

## Extração incremental

Vídeos já processados são pulados automaticamente numa nova extração do mesmo canal — só o conteúdo novo é baixado e indexado.

## Seleção de playlists e filtro de data

Endpoint `GET /playlists-canal` permite restringir a extração a playlists escolhidas e/ou a um intervalo de datas, em vez do canal inteiro. O filtro ativo fica visível no log em tempo real, no Relatório e como ícone na Visão Geral — para não confundir um recorte do canal com a extração completa.

## Fila de extração

Perfis Professor, Pesquisador e Especialista podem enfileirar múltiplos canais para extração sequencial (`POST /queue/add`, `GET /queue`, `DELETE /queue/clear`).

## Fontes públicas (perfil Pesquisador)

Além do YouTube, o Pesquisador tem acesso a busca em fontes públicas por área de conhecimento — produção científica, tecnologia, economia, direito, saúde, ciências da terra, física/química, patrimônio cultural e antropologia/linguística — incluindo buscadores multidisciplinares como arXiv, OpenAlex, DataCite, DOAJ, Zenodo, Crossref e Open Library, todos sem necessidade de cadastro ou chave de API. Há também busca clínica via FHIR/ResearchStudy (servidor público, escopo restrito a estudos de pesquisa).

## Leitor de página web avulsa

No Repositório, cole uma URL e o Tusab extrai o conteúdo principal via [trafilatura](https://github.com/adbar/trafilatura) (Apache-2.0) e indexa. Respeita `robots.txt` — não tenta contornar bloqueio de nenhum site. Limitado a páginas estáticas (sem renderização de JavaScript).

## Segurança da extração

- URL do canal validada por regex whitelist antes de ser passada ao yt-dlp
- ID de playlist validado (`^[A-Za-z0-9_\-]{10,50}$`) antes de compor comandos
- yt-dlp sempre executado via lista de argumentos — nunca via `shell=True`

Ver [Segurança](/seguranca) para o detalhe completo dos controles aplicados.

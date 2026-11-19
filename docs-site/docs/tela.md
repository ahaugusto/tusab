---
id: tela
title: A tela do Tusab (painel local)
sidebar_label: Tela do Tusab
slug: /tela
---

# A tela do Tusab (painel local)

O plugin serve no navegador a tela do Tusab (interface React de `web_interface/`, compilada em modo extensão). O navegador só mostra a tela; quem grava na pasta, extrai do YouTube e indexa é o processo do plugin. Por isso a tela funciona igual em qualquer navegador.

## Como abrir

- Pedindo à IA (ferramenta `tusab_abrir_painel`) ou pelo atalho **Abrir o Tusab** no "+" do Claude Desktop.
- Automaticamente, uma vez, na primeira execução do plugin numa pasta.
- Pela linha de comando, sem ferramenta de IA: `npm run painel` em `tusab-mcp/` (`Ctrl+C` fecha).

O endereço tem a forma `http://127.0.0.1:<porta>/?chave=<chave da sessão>`. Ele só funciona neste computador e enquanto a ferramenta de IA estiver aberta. **O link leva a chave da sessão e não deve ser compartilhado.** Ao abrir, a tela guarda a chave só naquela aba (`sessionStorage`), tira a chave da barra de endereço e passa a enviá-la no cabeçalho `X-Tusab-Chave` de cada chamada. Se a chave faltar ou o plugin tiver fechado, a tela mostra um aviso em vez de falhar em silêncio.

## O que a tela tem

- **Extração:** YouTube (canal, playlists, abas, período) e fontes públicas, com fila, pausa, log ao vivo e atualização automática de canais.
- **Repositório:** documentos, textos e páginas web por projeto; excluir e limpar; espaço ocupado (originais × texto); marca "Só texto"; botão **Pedir à IA**.
- **Biblioteca de Prompts:** os prompts prontos e "Meus prompts", para copiar em qualquer IA (ver [Biblioteca de Prompts](/biblioteca-de-prompts)). Depois de copiar, um aviso leva ao app do Claude ou à IA no navegador e mostra o estado da conexão: se o plugin está ligado a uma ferramenta de IA (nome informado por ela ao conectar) e, depois da cópia, quando a IA usou uma ferramenta do Tusab (`GET /api/conexao`, consultado a cada 2 s enquanto o aviso está aberto).
- **Materiais:** o que a IA guardou com `tusab_salvar_estudo` (flashcards, resumos, post-its e documentos), por projeto, cada um aberto numa janela (ver [Estudo e revisão espaçada](/funcionalidades/estudo)).
- **Relatório** por canal, **Visão Geral** e **Monitor** (perfil Especialista), **Admin**.
- **Exportações:** `.tusab` (com ou sem originais), zip da base, tabela de vídeos (XLSX) e relatório em PDF; importação de `.tusab`.

Não há chat, histórico de conversa, configuração de LLM, Ollama, Google Drive nem telemetria: a conversa acontece na ferramenta de IA. A tela é a mesma interface React do [app desktop](/desktop/visao-geral) compilada em modo extensão, por isso as abas que dependem de chat ficam de fora. O onboarding inclui um passo que explica como perguntar na IA conectada; o módulo de analytics não carrega nada.

## Segurança do servidor local

Um servidor em `127.0.0.1` pode ser alvo de outros sites abertos no mesmo navegador. As proteções, em `tusab-mcp/src/painel.js`:

| Proteção | Como |
|---|---|
| Só local | Escuta em `127.0.0.1`, porta escolhida pelo sistema (aleatória), só enquanto o plugin está aberto |
| Chave por sessão | 32 bytes aleatórios (256 bits) gerados a cada início. Toda chamada a `/api/*` exige a chave no cabeçalho `X-Tusab-Chave`; a comparação é em tempo constante. Sem a chave: HTTP 401 |
| `Host` conferido | Pedido com `Host` diferente de `127.0.0.1:<porta>` é recusado (HTTP 421), contra DNS rebinding |
| `Origin` e `Sec-Fetch-Site` | Quando presentes, precisam ser do próprio painel (`same-origin` ou `none`); senão, HTTP 403 |
| Sem CORS | Nenhum cabeçalho CORS é enviado. Como a chave vai num cabeçalho próprio, um pedido de outro site exigiria uma verificação prévia que o servidor nunca libera |
| Idioma só depois da chave | O cabeçalho `X-Tusab-Idioma` só é lido depois de a chave ser conferida |
| Métodos e corpo | Só `GET`, `POST` e `DELETE` em `/api/*`. Corpo só em JSON (até 12 MB) ou `multipart/form-data` para envio de arquivo (até 50 MB por documento; limite próprio para importar `.tusab`) |
| Arquivos estáticos | Só de dentro da pasta `interface/`, com tipos de arquivo conhecidos |
| Cabeçalhos | CSP `default-src 'none'` com `script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`; imagens também de `*.ytimg.com`, `*.ggpht.com` e `*.googleusercontent.com` (miniaturas do YouTube). Além disso `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy` e `Cross-Origin-Opener-Policy` `same-origin` |
| Abrir o navegador | O link é validado por expressão regular e aberto sem shell (`rundll32` no Windows, `open` no macOS, `xdg-open` nos demais) |

## API

A tela fala com o plugin pelas rotas `/api/*` (`tusab-mcp/src/api.js`). Elas repetem os contratos da API do app desktop (mesmos nomes de campos), herança de quando a mesma interface servia aos dois. Rotas do desktop sem equivalente na extensão (chat, configuração de LLM, Ollama) respondem de forma neutra.

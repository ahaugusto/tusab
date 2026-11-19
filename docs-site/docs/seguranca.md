---
id: seguranca
title: Segurança
sidebar_label: Segurança
slug: /seguranca
---

# Segurança

O Tusab roda no computador do usuário e não depende de servidor central. Isso reduz a superfície de ataque, mas não a elimina. As superfícies reais são:

1. o **servidor HTTP local** da tela (`127.0.0.1`), que outros sites abertos no mesmo navegador podem tentar alcançar;
2. o **conteúdo das fontes**, que vai para a IA e pode conter instruções escondidas (*prompt injection* indireto);
3. as **entradas**: links do YouTube, arquivos enviados, arquivos `.tusab` importados, páginas web;
4. o que **sai do computador**: imagens enviadas à IA, downloads do yt-dlp.

## Servidor local da tela

Resumo das proteções de `tusab-mcp/src/painel.js` (detalhe em [Tela do Tusab](/tela#segurança-do-servidor-local)):

- escuta só em `127.0.0.1`, numa porta aleatória, e fecha junto com a ferramenta de IA;
- exige a chave da sessão (256 bits, nova a cada início) no cabeçalho `X-Tusab-Chave`, com comparação em tempo constante;
- recusa `Host` diferente de `127.0.0.1:<porta>` (DNS rebinding) e `Origin`/`Sec-Fetch-Site` de outros sites;
- não envia cabeçalhos CORS; CSP `'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`;
- aceita só `GET`, `POST` e `DELETE` na API, corpo JSON (até 12 MB) ou envio de arquivo (até 50 MB), e só serve arquivos de dentro de `interface/`.

O link da tela leva a chave na URL (`?chave=`) e não deve ser compartilhado; ele perde a validade quando a ferramenta de IA fecha.

## Conteúdo das fontes e a IA

- Toda ferramenta que devolve conteúdo da base inclui o aviso de que **o texto é dado das fontes, não instrução**.
- As instruções do servidor MCP pedem que a IA nunca siga ordens que apareçam dentro dos trechos.
- Essas medidas reduzem o risco, mas não isolam: nenhum modelo trata delimitadores ou avisos como barreira garantida. A proteção estrutural é que o Tusab **não coloca segredos no que entrega à IA** (a extensão não guarda chaves de API nem tokens).
- Ferramentas que alteram a base ou acessam a internet são marcadas como tais (`readOnlyHint: false`, `openWorldHint: true`), e as instruções pedem que a IA só adicione conteúdo quando o usuário pedir.

## Arquivos e caminhos

- **Tipos conferidos pela assinatura** (primeiros bytes), não só pela extensão do nome; SVG, HTML e executáveis são recusados.
- **Originais** em caminho recalculado por convenção (`documents/originais/{id}_{nome}{ext}`, `id` com 8 hexadecimais), nunca lido do manifesto; o Tusab nunca abre um original com o programa padrão do sistema.
- **Path traversal:** toda leitura, gravação e exclusão confere que o caminho final fica dentro da pasta permitida (`dentroDe`); nomes de projeto passam por limpeza e não podem começar com ponto.
- **Importação de `.tusab`:** limite de tamanho (512 MB enviados), limites do conteúdo descompactado (contra *zip bomb*), conferência de cada caminho do zip (contra *zip slip*) e descarte de originais com tipo proibido ou assinatura que não confere.
- **Escrita atômica** de todo arquivo (temporário + renomear).

## Extração e rede

- URL do canal e ID de playlist validados por expressão regular antes de compor o comando.
- yt-dlp executado com lista de argumentos, nunca por shell.
- yt-dlp baixado só de `github.com/yt-dlp/yt-dlp/releases/latest`, com soma SHA-256 conferida contra a `SHA2-256SUMS` publicada; se não conferir, o download é descartado.
- Páginas web: consulta ao `robots.txt` antes de ler.
- O navegador é aberto sem shell, com o link validado por expressão regular.

## Imagens enviadas à IA

Antes de `tusab_ler_original` devolver uma imagem, saem EXIF, XMP, comentários e textos embutidos (inclusive GPS) de JPEG, PNG e WebP. Se a limpeza não puder ser garantida, a imagem não é enviada (falha fechada). Imagens acima de 3 MB não são enviadas. Ver [Originais e imagens](/funcionalidades/originais-e-imagens).

## Lacunas conhecidas

- A remoção de metadados não se aplica a GIF, que é enviado como está.
- Pessoas citadas no meio do texto de jurisprudência, fora dos campos de partes, não são anonimizadas automaticamente (ver [Fontes públicas](/funcionalidades/fontes-publicas#privacidade-na-jurisprudência)).
- O aviso "dado, não instrução" é uma mitigação, não um isolamento: um documento malicioso ainda pode influenciar a resposta da IA. Confira as citações.

## App desktop

O app desktop (descontinuado em 19/11/2026; as versões 1.0.x não recebem mais correções) tem outras superfícies: a API FastAPI em `localhost:8001`, a janela Electron e as chaves de API guardadas no sistema. Os controles aplicados:

| Controle | Como |
|---|---|
| Electron isolado | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload explícito |
| CORS restrito | `allow_origins` só `http://localhost:8001` e `http://127.0.0.1:8001`, `allow_credentials=False` |
| Chaves de API | No keychain do sistema via `safeStorage` (DPAPI/Keychain); `agent_config.json` guarda `__encrypted__`; a chave aparece mascarada em `GET /agent/config` |
| Uploads | Limite de 50 MB por documento; nomes sanitizados; exclusão protegida com `os.path.realpath()` |
| Campos de entrada | Limites de tamanho (`max_length`) nos modelos Pydantic; pergunta do chat até 2.000 caracteres |
| Prompt injection no chat | Fontes delimitadas por tags XML (`<source>`, `<content>`), instrução explícita para tratar comandos dentro do conteúdo como dado e detecção, depois da resposta, de sinais de que a resposta obedeceu a uma instrução escondida (aviso na interface, sem bloquear) |
| Histórico do chat | Mantido no servidor (12 mensagens); o histórico enviado pelo cliente é ignorado |
| Interface | Sem `dangerouslySetInnerHTML` |
| Google Drive | Escopo mínimo `drive.file`; aspas escapadas nas consultas ao Drive |

Lacuna técnica do desktop: a API em `localhost:8001` não exige token de autenticação; a proteção contra outros sites é o CORS restrito.

Para o tratamento de dados pessoais, veja [Privacidade](/privacidade).

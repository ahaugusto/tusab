---
id: privacidade
title: Privacidade
sidebar_label: Privacidade
slug: /privacidade
---

# Privacidade

O Tusab guarda a base de conhecimento **no computador do usuário**. A CriAugu não opera servidor que receba conteúdo, conversas, bases ou dados de uso do Tusab.

Esta página descreve tecnicamente o que fica no computador e o que sai dele. A política de privacidade formal (LGPD, Lei nº 13.709/2018, e GDPR) é publicada em [tusab.solutions](https://tusab.solutions).

## O que fica só no computador

| Dado | Onde |
|---|---|
| Transcrições, documentos, textos, originais | `data/neural/{projeto}/` |
| Índice de busca | `data/tusab.sqlite` |
| Prompts próprios, idioma, fila, configurações | `data/config/` |
| Contador de economia de tokens (só números agregados) | `data/config/economia_tokens.json` |

O Tusab não tem conta, login nem telemetria: na tela, o módulo de analytics não carrega nada.

## O que sai do computador

| Para onde | O quê | Quando |
|---|---|---|
| **A ferramenta de IA do usuário** (e o serviço de IA por trás dela) | Os trechos devolvidos pelas ferramentas (`tusab_buscar`, `tusab_ler_fonte`…), páginas de PDF e imagens pedidas com `tusab_ler_original` (sem metadados), nomes de projetos e de fontes | Quando a IA chama uma ferramenta |
| YouTube | Pedidos do yt-dlp (mapeamento de canais, legendas, metadados), a partir do IP do usuário | Ao extrair ou verificar atualização de canais |
| Fontes públicas | O tema pesquisado | Ao buscar numa fonte pública |
| Sites de páginas web | Pedido da página e do `robots.txt` | Ao adicionar uma página web |
| GitHub (`github.com/yt-dlp`) | Download do yt-dlp e da lista de somas SHA-256 | Só se o computador não tiver o yt-dlp |
| Domínios de imagens do YouTube | Carregamento de miniaturas na tela | Ao exibir canais e vídeos na tela |

O que a ferramenta de IA faz com os trechos recebidos (armazenamento, uso, país dos servidores) segue os termos dessa ferramenta e do serviço de IA, não do Tusab. Os servidores podem estar fora do Brasil.

## Minimização

- A IA recebe **trechos**, não as fontes inteiras (ver [Economia de tokens](/funcionalidades/economia-de-tokens)).
- Imagens vão sem EXIF/GPS; se a remoção não puder ser garantida, não vão.
- Originais só entram num `.tusab` exportado por escolha explícita, com aviso sobre dados pessoais, autoria e localização em fotos.
- Na jurisprudência (STF, TCU, TST), os dados das partes são removidos e CPF e números de OAB são mascarados (ver [Fontes públicas](/funcionalidades/fontes-publicas#privacidade-na-jurisprudência)).

## Direitos do titular

| Direito | Como exercer |
|---|---|
| Acesso | A pasta do repositório é acessível diretamente pelo sistema operacional |
| Correção | Editar os arquivos ou usar a tela |
| Exclusão | Tela (excluir, limpar, reset total) ou o sistema de arquivos; excluir um documento apaga também o original |
| Portabilidade | Formatos abertos (`.txt`, `.json`, `.csv`) e o `.tusab` (zip) |
| Interromper o tratamento | Remover a extensão da ferramenta de IA; nada roda com ela fechada |

Contato: **tusab@tusab.solutions**

## App desktop

No [app desktop](/desktop/visao-geral), descontinuado em 19/11/2026 (vale para as versões 1.0.x ainda instaladas), além do acima:

- **Assistente:** com um provedor externo (OpenAI, Anthropic, Gemini, Groq, OpenRouter, endpoint próprio), a pergunta e os trechos recuperados vão para esse provedor; o app avisa ao configurar. Com Ollama local, nada sai.
- **Chaves de API** ficam no keychain do sistema (`safeStorage`) e são usadas direto do computador para o provedor escolhido.
- **Histórico do chat** fica na memória do backend e não persiste entre sessões.
- **Telemetria opcional (Microsoft Clarity):** só com consentimento explícito na primeira execução, revogável nas configurações. O conteúdo da tela é mascarado no computador antes do envio; os eventos levam só o nome. Sem aceite, nenhuma requisição sai. Retenção da telemetria anônima: 12 meses.
- **Google Drive** (opcional): escopo `drive.file`; o token OAuth fica até ser revogado.

---

Responsável: CriAugu — CNPJ 65.131.075/0001-57.

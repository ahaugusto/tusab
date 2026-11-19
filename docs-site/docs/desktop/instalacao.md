---
id: instalacao
title: App desktop — instalação
sidebar_label: Instalação
slug: /desktop/instalacao
---

# App desktop — instalação

:::warning App desktop descontinuado
O app desktop foi descontinuado em 19/11/2026 e não recebe mais correções nem atualizações. O código citado nesta página está na etiqueta [`desktop-final`](https://github.com/criaugu/tusab/tree/desktop-final), não mais no `main`. Esta página é mantida só como registro.
:::

Os instaladores ficam nas releases 1.0.x do GitHub; a última é a [v1.0.64](https://github.com/criaugu/tusab/releases/tag/v1.0.64).

| Plataforma | Requisito | Arquivo |
|---|---|---|
| Windows 10/11 x64 | — | `Tusab-Setup-X.X.X.exe` |
| macOS (Apple Silicon) | macOS 14 (Sonoma) ou superior | `Tusab-X.X.X-arm64.dmg` |

Python e yt-dlp vêm empacotados nos dois instaladores. macOS com processador Intel não é suportado.

## Windows

Execute o `.exe` (instalador NSIS). Se escolher outra pasta de instalação, o caminho pode ter no máximo **65 caracteres** (limite `TUSAB_MAX_INSTDIR` do instalador); com caminhos mais longos a atualização automática não consegue substituir os arquivos, e o instalador não deixa prosseguir. A pasta sugerida sempre cabe.

:::caution Versões 1.0.42 a 1.0.57 no Windows
Esses instaladores saíram sem o Python embutido: o app abria, mas extração, chat e repositório não funcionavam. Instale a 1.0.58 ou mais recente; dados e configurações continuam onde estavam.
:::

## macOS

1. Abra o `.dmg` e arraste o Tusab para **Applications**.
2. Abra pelo Applications. O app é assinado (Developer ID) e notarizado pela Apple.
3. Na primeira execução, o app verifica se o Ollama está instalado e oferece o download.

## Primeira execução

1. Idioma e tema.
2. Consentimento de telemetria (opcional; pode ser recusado ou revogado depois).
3. Perfil: Estudante, Professor, Pesquisador ou Especialista (ver [Perfis](/perfis-e-jornadas)).
4. Motor de IA do Assistente: Ollama local ou chave de um provedor externo.

## Motor de IA do Assistente

| Provedor | Modelo padrão |
|---|---|
| Ollama (padrão) | `llama3.2:1b` |
| Groq | `llama-3.1-8b-instant` |
| OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` (configurável) |
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-haiku-4-5` (chamadas auxiliares) / `claude-sonnet-4-6` (resposta final) |
| Google Gemini | o primeiro disponível na conta, começando por `gemini-1.5-flash` |
| Endpoint próprio | qualquer servidor compatível com a API da OpenAI |

A chave é testada antes de ser salva e guardada com o `safeStorage` do Electron (DPAPI no Windows, Keychain no macOS).

## Google Drive (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e habilite a **Google Drive API**.
2. Crie credenciais OAuth 2.0 do tipo *Desktop app* e baixe o JSON.
3. Renomeie para `credentials.json` e coloque na raiz do projeto (desenvolvimento) ou na pasta de dados (app instalado).
4. Habilite o Drive pela aba Repositório; o fluxo OAuth abre no navegador.
5. O `token.json` é salvo localmente.

Escopo pedido: `drive.file` (o Tusab só acessa arquivos que ele mesmo criou).

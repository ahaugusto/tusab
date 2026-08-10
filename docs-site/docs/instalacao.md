---
id: instalacao
title: Instalação
sidebar_label: Instalação
slug: /instalacao
---

# Instalação

## Download

Baixe o instalador mais recente na [página de releases do GitHub](https://github.com/ahaugusto/tusab/releases/latest).

| Plataforma | Requisito | Arquivo |
|---|---|---|
| Windows 10/11 x64 | — | `Tusab-Setup-X.X.X.exe` |
| macOS (Apple Silicon — M1 ou mais novo) | macOS 14 (Sonoma) ou superior | `Tusab-X.X.X-arm64.dmg` |

Python e yt-dlp já vêm empacotados nos dois instaladores — nada mais para instalar manualmente.

:::note macOS Intel não é suportado
Só Apple Silicon (arm64) no momento.
:::

## Instalando no Windows

Execute o `.exe` e siga o instalador NSIS. Sem passos manuais adicionais.

## Instalando no macOS

1. Baixe o `.dmg`.
2. Abra o `.dmg` e arraste o ícone do Tusab para **Applications**.
3. Abra o Tusab pelo Applications. O app é **assinado e notarizado pela Apple** (Developer ID + notarização automatizada em CI) — abre normalmente, sem precisar liberar manualmente em Ajustes do Sistema → Privacidade e Segurança.
4. Na primeira execução, o Tusab detecta se o Ollama está instalado e oferece baixar automaticamente caso não esteja.

## Primeira execução

Na primeira abertura, o Tusab guia você por:

1. Tela de boas-vindas (idioma e tema)
2. Consentimento de telemetria (opt-in, pode ser recusado ou revogado depois)
3. Escolha de perfil — Estudante, Professor, Pesquisador ou Especialista
4. Configuração do motor de IA — Ollama local (recomendado, grátis) ou uma chave de provedor externo (Groq, OpenAI, Anthropic, Gemini)

Veja o detalhe de cada jornada em [Perfis e jornadas de uso](/perfis-e-jornadas).

## Configurando o motor de IA

### Ollama (padrão, recomendado)

Zero custo, zero chave de API, funciona offline. O onboarding oferece o download automático; se preferir manualmente, baixe em [ollama.com/download](https://ollama.com/download). Modelo padrão: `llama3.2:1b` (~1.3 GB).

### Provedores externos (BYOK — bring your own key)

Configuráveis a qualquer momento na aba **Assistente**:

| Provedor | Modelo padrão | Custo |
|----------|--------------|-------|
| Groq | llama-3.1-8b-instant | Camada gratuita |
| OpenAI | gpt-4o-mini | Pago |
| Anthropic | claude-haiku-4-5 (auxiliar) / claude-sonnet-4-6 (resposta principal) | Pago |
| Google Gemini | gemini-1.5-flash | Pago |
| Endpoint customizado | qualquer servidor compatível com OpenAI | Depende do servidor |

A chave é testada antes de ser salva e armazenada de forma criptografada no sistema operacional (DPAPI no Windows, Keychain no macOS) via `safeStorage` do Electron.

## Google Drive (opcional)

Para sincronizar/compartilhar bases via Google Drive:

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e habilite a **Google Drive API**
2. Crie credenciais OAuth 2.0 (tipo Desktop app) e baixe o JSON
3. Renomeie para `credentials.json` e coloque na raiz do projeto (build de desenvolvimento) ou na pasta de dados (build empacotado)
4. Na interface do Tusab, habilite o Drive pela aba Repositório — o fluxo OAuth abre no navegador
5. Após autorizar, `token.json` é salvo localmente (ambos os arquivos são gitignored)

O escopo solicitado é o mínimo necessário: `drive.file` — o Tusab só acessa arquivos que ele mesmo criou.

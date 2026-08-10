---
id: privacidade
title: Privacidade
sidebar_label: Privacidade
slug: /privacidade
---

# Privacidade

O princípio central do Tusab é **local-first**: os dados ficam na máquina do usuário. A CriAugu não opera servidores que armazenam conteúdo, conversas ou bases de conhecimento de usuários.

Este resumo cobre os pontos essenciais da Política de Privacidade completa, elaborada em conformidade com a **LGPD** (Lei nº 13.709/2018) e o **GDPR** (Regulamento UE 2016/679).

## Dados processados só localmente

Nunca enviados a servidores da CriAugu:

| Dado | Onde fica |
|------|-----------|
| Transcrições, documentos, textos indexados | `data/neural/{projeto}/` |
| Índice BM25 | `data/indexes/{projeto}_index.json` |
| Configurações do assistente | `data/config/agent_config.json` |
| Histórico de chat | Memória RAM — não persiste entre sessões |

## Chaves de API de terceiros

Armazenadas localmente (preferencialmente via `safeStorage` do Electron — DPAPI/Keychain). Nunca transmitidas a servidores da CriAugu; usadas diretamente do dispositivo para chamar o provedor escolhido. O usuário é responsável pela segurança dessas chaves no próprio dispositivo.

## Telemetria (opt-in)

Com consentimento explícito (modal na primeira execução), eventos anônimos de uso são coletados via PostHog: abertura do app, início de extração, indexação, envio de chat (só a modalidade, não o conteúdo), provedor configurado.

**Nunca coletado:** conteúdo de mensagens, URLs de canais, títulos de vídeos, nomes de arquivo, chaves de API, ou qualquer dado pessoal identificável. Consentimento revogável a qualquer momento nas configurações.

## Transferência internacional de dados

Ao usar um provedor de IA externo (OpenAI, Gemini, Anthropic, Groq), o conteúdo das consultas — pergunta e trechos de contexto recuperados — é transmitido aos servidores desse provedor, que podem estar fora do Brasil. O Tusab exibe aviso explícito ao configurar um provedor externo. **O Ollama (padrão local) não gera nenhuma transferência de dados.**

## Direitos do titular (LGPD Art. 18 / GDPR Art. 17)

| Direito | Como exercer |
|---------|--------------|
| Acesso | Pasta de dados acessível diretamente pelo sistema operacional |
| Correção | Editar arquivos diretamente ou pela interface |
| Exclusão | Aba Repositório do app, ou diretamente no sistema de arquivos |
| Portabilidade | Dados em formatos abertos (`.txt`, `.json`, `.csv`) — exportáveis sem dependência do Tusab |
| Revogação de consentimento | Configurações do app |
| Oposição ao tratamento | Como o processamento é local, desinstalar o app interrompe qualquer tratamento |

Contato: **tusab@tusab.solutions**

## Retenção

| Dado | Período |
|------|---------|
| Base de conhecimento (`neural/`) | Indefinido — controle total do usuário |
| Configurações | Indefinido — usuário pode excluir a qualquer momento |
| Histórico de chat | Duração da sessão |
| Telemetria anônima | 12 meses |
| Token OAuth do Drive | Até revogação manual |

## Menores de idade

O Tusab não é destinado a menores de 16 anos.

---

Responsável: **CriAugu — CNPJ 65.131.075/0001-57**. Política completa, atualizada e vigente sempre em [tusab.solutions](https://tusab.solutions).

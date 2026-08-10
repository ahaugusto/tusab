---
id: intro
title: O que é o Tusab
sidebar_label: Introdução
slug: /intro
---

# O que é o Tusab

**Tusab é um sistema de gestão de conhecimento pessoal (PKM) com IA local.** Você aponta para o que quer aprender — um canal do YouTube, PDFs, documentos, anotações — e o Tusab absorve tudo, indexa e responde suas perguntas em linguagem natural, sempre citando a fonte exata de onde veio a resposta.

Roda inteiramente na sua máquina. Funciona offline com [Ollama](https://ollama.com). Zero custo na configuração padrão.

## O nome

Tusab (egípcio antigo: *s-bȝ-yt*) é o nome de um gênero literário do Egito Antigo — textos de instrução prática, onde alguém de grande experiência registrava o que aprendeu para quem viesse depois. O exemplo mais célebre são as Máximas de Ptahhotep (c. 2400 a.C.).

O produto faz o mesmo, na prática: você acumula conhecimento, o Tusab organiza e indexa, e quando você tem uma dúvida, ele instrui de volta a partir do que você escolheu aprender — nunca inventando, sempre citando a origem.

## O pipeline central — IAC

| Etapa | O que faz |
|-------|-----------|
| **I — Index** | Extrai e indexa qualquer fonte: YouTube, PDFs, DOCX, Markdown, texto colado, áudio, imagem, WhatsApp, transcrições de reunião |
| **A — Augment** | RAG (Retrieval-Augmented Generation): recupera os trechos mais relevantes da sua base e os entrega ao modelo como contexto |
| **C — Chat** | Conversa em linguagem natural, resposta em streaming, sempre citando título, data e link da fonte original |

## Por que existe

O problema central de gestão de conhecimento pessoal: você salva muito, mas não acha quando precisa. A busca por palavra-chave é ruim, você não lembra onde guardou, e acaba relendo tudo do zero.

O Tusab resolve isso com um mentor que só conhece o que você escolheu ensinar a ele — o que não é uma limitação, é a garantia de que ele não alucina fora do que você indexou.

## Os quatro perfis

O Tusab se adapta a quem está usando. O perfil é escolhido no onboarding e pode ser trocado a qualquer momento.

| Perfil | Uso principal |
|--------|---------------|
| 🎓 **Estudante** | Importa bases prontas (`.tusab`) compartilhadas por professores. Só consulta — zero configuração. |
| 📚 **Professor** | Extrai canais do YouTube, indexa material didático, exporta bases para compartilhar com a turma. |
| 🔬 **Pesquisador** | Constrói corpora de múltiplas fontes, usa Busca Ampla com re-rankeamento semântico, acessa analytics do projeto. |
| 🧑‍💻 **Especialista** | Acesso completo: monitoramento do sistema, administração, reset total, todas as ferramentas avançadas. |

O que muda entre perfis: abas visíveis, persona padrão do assistente, acesso a configuração de provedores de IA, fila de extração, integração com Drive e ferramentas administrativas.

O que **não** muda: qualidade do RAG, privacidade local-first, citação obrigatória de fonte, e custo zero com Ollama — esses são invariantes do produto, independente de perfil.

## Diferenciais

- **Extração de canais do YouTube em escala** — canais inteiros, centenas de vídeos, via yt-dlp local
- **Multi-fonte** — YouTube, PDF, DOCX, Markdown, texto livre, imagens (OCR), áudio (transcrição local), WhatsApp, transcrições de reunião (Zoom/Teams/Otter)
- **100% local** — dados nunca saem da máquina; funciona offline com Ollama
- **Citação de fonte obrigatória** — toda resposta cita título, data e link de origem
- **Fluxo professor → aluno** — exporte uma base pronta `.tusab`, o aluno importa e já conversa, sem extrair nada
- **BYOK** — Groq (grátis), OpenAI, Anthropic, Google Gemini como provedores opcionais, além do Ollama local
- **MCP Server** — exponha sua base de conhecimento para Claude Code, Cursor ou qualquer cliente MCP
- **Windows e macOS (Apple Silicon)** — instaladores nativos para os dois sistemas

## Próximos passos

- [Instalação](/instalacao) — baixe e instale o Tusab
- [Perfis e jornadas de uso](/perfis-e-jornadas) — entenda qual perfil combina com seu caso de uso
- [Funcionalidades](/funcionalidades/extracao-youtube) — veja cada recurso em detalhe
- [Arquitetura técnica](/arquitetura/visao-geral) — para quem quer entender ou contribuir com o código

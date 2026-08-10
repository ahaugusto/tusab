---
id: perfis-e-jornadas
title: Perfis e jornadas de uso
sidebar_label: Perfis e jornadas
slug: /perfis-e-jornadas
---

# Perfis e jornadas de uso

O Tusab tem quatro perfis com funcionalidades progressivamente mais avançadas. O perfil é escolhido no onboarding e pode ser trocado a qualquer momento pelo menu de perfil no cabeçalho.

## Mapa de funcionalidades por perfil

| Funcionalidade | Estudante | Professor | Pesquisador | Especialista |
|---|:---:|:---:|:---:|:---:|
| Chat RAG com streaming e fontes | ✅ | ✅ | ✅ | ✅ |
| Repositório (visualizar + upload) | ✅ | ✅ | ✅ | ✅ |
| Importar / exportar base `.tusab` | ✅ | ✅ | ✅ | ✅ |
| Configurar provedor de IA / API key | ✅ | ✅ | ✅ | ✅ |
| Busca Ampla (BM25 + CrossEncoder) | ✅ | ✅ | ✅ | ✅ |
| Google Drive (sync) | ✅ | ✅ | ✅ | ✅ |
| Extrair canal do YouTube / fila | — | ✅ | ✅ | ✅ |
| Gerenciar repositório (deletar/limpar) | ✅ | ✅ | ✅ | ✅ |
| Painel Admin | ✅ | ✅ | ✅ | ✅ |
| Visão Geral (analytics do corpus) | — | ✅ | ✅ | ✅ |
| Monitor de sistema | — | — | — | ✅ |
| Reset total | ✅ | ✅ | ✅ | ✅ |
| Persona padrão do assistente | Didático | Didático | Técnico | Objetivo |

## Estudante

Importa bases prontas (`.tusab`) compartilhadas por professores ou colegas e faz perguntas ao chat. Não precisa configurar provedor de IA, gerenciar extração nem administrar nada.

**Fluxo típico:** recebe o arquivo `.tusab` → instala o Tusab → escolhe o perfil Estudante no onboarding → importa a base pela Home ("Importar Base") → conversa no chat, recebendo respostas com citação de vídeo/minuto ou documento de origem.

## Professor

Extrai canais do YouTube, organiza materiais didáticos em projetos, e exporta bases prontas para compartilhar com a turma.

**Fluxo típico:** cola a URL do canal → seleciona fontes (desmarca Shorts, por exemplo) → inicia a extração (roda no IP do próprio professor, sem servidor intermediário) → cria um projeto no Repositório → adiciona PDFs complementares → indexa a base → exporta como `.tusab` e distribui aos alunos.

A extração é incremental: numa nova rodada, só os vídeos novos são processados.

## Pesquisador

Constrói corpora de múltiplas fontes para análise aprofundada, com controle fino sobre o que entra na base.

**Diferenciais em relação ao Professor:**
- Painel **Visão Geral** — analytics do projeto: tamanho do corpus, cobertura, distribuição de fontes
- **Busca Ampla com CrossEncoder** ativa por padrão — BM25 recupera os top-12 candidatos, um CrossEncoder (`ms-marco-MiniLM-L-6-v2`) reordena semanticamente, os top-6 vão ao prompt
- Busca em fontes públicas por área de conhecimento (arXiv, OpenAlex, DOAJ, Zenodo, Crossref, FHIR/ResearchStudy para estudos clínicos, entre outras)

## Especialista

Acesso completo — inclui monitoramento do sistema e administração. Voltado a inteligência de negócios sobre acervo próprio: relatórios, atas de reunião, vídeos de conferência.

**Diferenciais em relação ao Pesquisador:**
- Painel **Monitor** — status do sistema em tempo real (ETA de extração, uso de recursos)
- Reconhecimento automático de documentos jurídicos (petição, contrato, parecer)

**Reset total** (limpeza completa da base — hard-reset global, não por projeto) está disponível para todos os perfis, na aba Admin.

:::info Nota técnica
Internamente o slug deste perfil é `profissional` — mantido por compatibilidade com dados de instalações já existentes. O rótulo visível na interface é "Especialista" desde junho de 2026.
:::

## O momento universal: primeira pergunta com fonte

Independente do perfil, o momento definidor do produto é o mesmo: você pergunta, a resposta aparece em streaming, e ao final ela cita título, data e link da fonte exata. Clicar na fonte abre o vídeo original no YouTube ou o documento local correspondente.

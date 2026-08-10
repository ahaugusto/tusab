---
id: fontes-publicas
title: Fontes públicas por área de conhecimento
sidebar_label: Fontes públicas
slug: /funcionalidades/fontes-publicas
---

# Fontes públicas por área de conhecimento

Além do YouTube e do upload manual, o perfil **Pesquisador** tem acesso a busca em **26 fontes públicas**, organizadas em **9 áreas de conhecimento** — nenhuma exige cadastro ou chave de API. O resultado é baixado e preparado para indexação automaticamente, exatamente como qualquer outro documento do Repositório.

Mapeado a partir do documento "Bases de Dados Abertas — Consolidação Ampliada de Endpoints de API" (Equipe NDTI/DECIT/SCTIE, Ministério da Saúde, jul/2026). Só entram fontes testadas ao vivo, com conteúdo textual substantivo — não apenas metadado.

## Como buscar

1. No modal de extração, escolha **Base pública** em vez de YouTube
2. Selecione a área de conhecimento e a fonte específica
3. Digite um tema ou palavras-chave
4. Escolha quantos resultados baixar (até 50)

## Fontes por área

### Buscadores gerais e multidisciplinares

Não pertencem a uma área de domínio específica — indexam produção de qualquer campo.

| Fonte | O que cobre |
|-------|-------------|
| arXiv | Preprints de física, matemática, ciência da computação e áreas correlatas |
| OpenAlex | Catálogo aberto da produção científica global (~322 milhões de trabalhos) |
| Crossref | Metadados de DOIs — 150M+ trabalhos acadêmicos de qualquer área |
| DataCite | DOIs de datasets, software e produção de pesquisa |
| DOAJ | Diretório de periódicos e artigos de acesso aberto |
| Zenodo | Repositório do CERN/OpenAIRE — datasets, código e artefatos com DOI |
| Open Library | Metadados e descrições de livros (projeto da Internet Archive) |
| data.europa.eu | Portal de dados abertos da União Europeia |
| data.gov.uk | Portal de dados abertos do governo do Reino Unido |

### Tecnologia, IA e ciência de dados

| Fonte | O que cobre |
|-------|-------------|
| GitHub | Repositórios de código aberto — README, tópicos e linguagem |
| Stack Overflow | Perguntas e respostas técnicas da comunidade |
| Hacker News | Discussões Ask HN/Show HN — comunidade de tecnologia e startups |

### Economia, finanças e ciências sociais

| Fonte | O que cobre |
|-------|-------------|
| Banco Central do Brasil | Séries, relatórios e estatísticas econômicas e monetárias |

### Direito, normas, legislação e governo

| Fonte | O que cobre |
|-------|-------------|
| Câmara dos Deputados | Proposições legislativas federais — inteiro teor em PDF quando disponível |
| Senado Federal — Legislação | Leis federais já sancionadas — ementa oficial de cada norma |

### Saúde, biologia e genética

| Fonte | O que cobre |
|-------|-------------|
| PubMed | Literatura médica e biomédica (NCBI/Entrez) — abstract completo |
| Europe PMC | Literatura biomédica com camada semântica de anotações |
| ClinicalTrials.gov | Registro mundial de ensaios clínicos (NIH/NLM) |
| UniProt | Sequências e funções biológicas de proteínas |
| openFDA | Bulários de medicamentos aprovados pela FDA (indicações, uso, avisos) |

Há também busca clínica dedicada via **FHIR/ResearchStudy** — envie um Bundle FHIR (`.json`) pelo Repositório e o Tusab reconhece e estrutura automaticamente. Restrito a estudos de pesquisa: nunca dados de paciente, mesmo que fosse só um dado de teste.

### Ciências da Terra, clima e espaço

| Fonte | O que cobre |
|-------|-------------|
| NASA Earthdata | Catálogo de coleções de dados de satélites e sensores |

### Física, química e materiais

| Fonte | O que cobre |
|-------|-------------|
| CERN Open Data | Conjuntos de dados de colisões do LHC |

### Patrimônio cultural, história e arquivos

| Fonte | O que cobre |
|-------|-------------|
| Art Institute of Chicago | Coleção de obras com descrição curatorial narrativa |
| The Metropolitan Museum of Art | Coleção de +470 mil obras — metadado curatorial (cultura, período, meio) |

### Antropologia, linguística e conhecimento estruturado

| Fonte | O que cobre |
|-------|-------------|
| Wikipédia (PT) | Busca textual completa na Wikipédia em português |
| Wiktionary | Dicionário multilíngue livre — etimologia, pronúncia e definições |

## Por que arXiv está em "geral", não só em tecnologia/física

arXiv não "pertence" a uma única área de domínio — cobre física, matemática, ciência da computação e mais. Fica junto dos outros buscadores multidisciplinares (OpenAlex, DataCite, DOAJ, Zenodo) em vez de soterrado dentro de uma única área, mesmo cobrindo muito mais que isso.

## Extensibilidade

Cada fonte é um módulo independente com o mesmo contrato (`FONTE_META` + `buscar()`) — adicionar uma fonte nova não exige tocar nas demais. Ver `tusab_engine/motor/fontes/` no repositório para o código de referência.

---
id: fontes-publicas
title: Public sources by knowledge area
sidebar_label: Public sources
slug: /funcionalidades/fontes-publicas
---

# Public sources by knowledge area

Beyond YouTube and manual upload, the **Researcher** profile can search **26 public sources**, organized into **9 knowledge areas** — none require registration or an API key. Results are downloaded and prepared for indexing automatically, exactly like any other document in the Repository.

Mapped from "Bases de Dados Abertas — Consolidação Ampliada de Endpoints de API" (Brazil's Ministry of Health, NDTI/DECIT/SCTIE team, Jul/2026). Only sources tested live, with substantive text content, are included — not metadata-only feeds.

## How to search

1. In the extraction modal, choose **Public source** instead of YouTube
2. Select the knowledge area and the specific source
3. Type a topic or keywords
4. Choose how many results to download (up to 50)

## Sources by area

### General and multidisciplinary search engines

Don't belong to a single domain area — index output from any field.

| Source | What it covers |
|--------|-----------------|
| arXiv | Preprints in physics, mathematics, computer science, and related fields |
| OpenAlex | Open catalog of global scientific output (~322 million works) |
| Crossref | DOI metadata — 150M+ academic works from any field |
| DataCite | DOIs for datasets, software, and research output |
| DOAJ | Directory of open-access journals and articles |
| Zenodo | CERN/OpenAIRE repository — datasets, code, and DOI-tagged artifacts |
| Open Library | Book metadata and descriptions (an Internet Archive project) |
| data.europa.eu | European Union open data portal |
| data.gov.uk | UK government open data portal |

### Technology, AI, and data science

| Source | What it covers |
|--------|-----------------|
| GitHub | Open-source repositories — README, topics, and language |
| Stack Overflow | Technical Q&A from the developer community |
| Hacker News | Ask HN/Show HN discussions — tech and startup community |

### Economics, finance, and social sciences

| Source | What it covers |
|--------|-----------------|
| Central Bank of Brazil | Economic and monetary series, reports, and statistics |

### Law, regulation, legislation, and government

| Source | What it covers |
|--------|-----------------|
| Chamber of Deputies (Brazil) | Federal legislative bills — full text in PDF when available |
| Federal Senate — Legislation | Already-enacted federal laws — official summary of each statute |

### Health, biology, and genetics

| Source | What it covers |
|--------|-----------------|
| PubMed | Medical and biomedical literature (NCBI/Entrez) — full abstract |
| Europe PMC | Biomedical literature with a semantic annotation layer |
| ClinicalTrials.gov | Worldwide clinical trial registry (NIH/NLM) |
| UniProt | Protein sequences and biological function |
| openFDA | FDA-approved drug labels (indications, usage, warnings) |

Clinical search is also available via **FHIR/ResearchStudy** — upload a FHIR Bundle (`.json`) through the Repository and Tusab recognizes and structures it automatically. Scoped to research studies only: never patient data, even as test data.

### Earth sciences, climate, and space

| Source | What it covers |
|--------|-----------------|
| NASA Earthdata | Catalog of satellite and sensor data collections |

### Physics, chemistry, and materials

| Source | What it covers |
|--------|-----------------|
| CERN Open Data | LHC collision datasets |

### Cultural heritage, history, and archives

| Source | What it covers |
|--------|-----------------|
| Art Institute of Chicago | Collection of works with curatorial narrative descriptions |
| The Metropolitan Museum of Art | Collection of 470,000+ works — curatorial metadata (culture, period, medium) |

### Anthropology, linguistics, and structured knowledge

| Source | What it covers |
|--------|-----------------|
| Wikipedia (PT) | Full-text search on the Portuguese-language Wikipedia |
| Wiktionary | Free multilingual dictionary — etymology, pronunciation, and definitions |

## Why arXiv is in "general," not just technology/physics

arXiv doesn't "belong" to a single domain area — it covers physics, mathematics, computer science, and more. It sits alongside the other multidisciplinary search engines (OpenAlex, DataCite, DOAJ, Zenodo) instead of being buried inside a single area despite covering far more than that.

## Extensibility

Each source is an independent module with the same contract (`FONTE_META` + `buscar()`) — adding a new source doesn't require touching the others. See `tusab_engine/motor/fontes/` in the repository for the reference implementation.

---
id: perfis-e-jornadas
title: Profiles and user journeys
sidebar_label: Profiles and journeys
slug: /perfis-e-jornadas
---

# Profiles and user journeys

Tusab has four profiles with progressively more advanced features. The profile is chosen during onboarding and can be switched at any time from the profile menu in the header.

## Feature map by profile

| Feature | Student | Teacher | Researcher | Specialist |
|---|:---:|:---:|:---:|:---:|
| RAG chat with streaming and sources | ✅ | ✅ | ✅ | ✅ |
| Repository (view + upload) | ✅ | ✅ | ✅ | ✅ |
| Import / export `.tusab` base | ✅ | ✅ | ✅ | ✅ |
| Configure AI provider / API key | ✅ | ✅ | ✅ | ✅ |
| Broad Search (BM25 + CrossEncoder) | ✅ | ✅ | ✅ | ✅ |
| Google Drive (sync) | ✅ | ✅ | ✅ | ✅ |
| Extract YouTube channel / queue | — | ✅ | ✅ | ✅ |
| Manage repository (delete/clear) | ✅ | ✅ | ✅ | ✅ |
| Admin panel | ✅ | ✅ | ✅ | ✅ |
| Overview (corpus analytics) | — | ✅ | ✅ | ✅ |
| System Monitor | — | — | — | ✅ |
| Full reset | ✅ | ✅ | ✅ | ✅ |
| Assistant's default persona | Didactic | Didactic | Technical | Objective |

## Student

Imports ready-made bases (`.tusab`) shared by teachers or classmates and asks the chat questions. No need to configure an AI provider, manage extraction, or administer anything.

**Typical flow:** receives the `.tusab` file → installs Tusab → picks the Student profile during onboarding → imports the base from the Home screen ("Import Base") → chats, receiving answers with video/timestamp or document source citations.

## Teacher

Extracts YouTube channels, organizes teaching material into projects, and exports ready-made bases to share with the class.

**Typical flow:** pastes the channel URL → selects sources (deselects Shorts, for example) → starts extraction (runs on the teacher's own IP, no intermediary server) → creates a project in the Repository → adds complementary PDFs → indexes the base → exports as `.tusab` and distributes it to students.

Extraction is incremental: on a new run, only new videos are processed.

## Researcher

Builds corpora from multiple sources for in-depth analysis, with fine-grained control over what goes into the base.

**Differences from Teacher:**
- **Overview** panel — project analytics: corpus size, coverage, source distribution
- **Broad Search with CrossEncoder** active by default — BM25 retrieves the top-12 candidates, a CrossEncoder (`ms-marco-MiniLM-L-6-v2`) reorders them semantically, the top-6 go into the prompt
- Search [26 public sources across 9 knowledge areas](/funcionalidades/fontes-publicas) (arXiv, PubMed, Brazil's Chamber of Deputies, Central Bank, CERN Open Data, among others)

## Specialist

Full access — includes system monitoring and administration. Aimed at business intelligence over your own collection: reports, meeting minutes, conference videos.

**Differences from Researcher:**
- **Monitor** panel — real-time system status (extraction ETA, resource usage)
- Automatic recognition of legal documents (petitions, contracts, opinions)

**Full reset** (complete base wipe — a global hard reset, not per-project) is available to every profile, in the Admin tab.

:::info Technical note
Internally this profile's slug is `profissional` — kept for compatibility with existing installations' data. The label shown in the interface has been "Especialista"/"Specialist" since June 2026.
:::

## The universal moment: the first sourced answer

Regardless of profile, the defining moment of the product is the same: you ask a question, the answer streams in, and at the end it cites the exact source's title, date, and link. Clicking the source opens the original video on YouTube or the corresponding local document.

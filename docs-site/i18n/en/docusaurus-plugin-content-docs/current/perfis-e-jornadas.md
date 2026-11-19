---
id: perfis-e-jornadas
title: Profiles
sidebar_label: Profiles
slug: /perfis-e-jornadas
---

# Profiles

The [Tusab screen](/tela) has four profiles: **Student**, **Teacher**, **Researcher** and **Specialist**. The profile is chosen during onboarding and can be changed at any time in the header. It defines which tabs appear; it doesn't change the index, the data format or privacy.

The [MCP tools](/ferramentas-mcp) **don't depend on the profile**: the AI has access to the same 15 tools in every case.

The configuration lives in `web_interface/src/hooks/usePerfil.js` (`PERFIS_CONFIG`, with the extension-mode adjustments in the same file).

## What each profile shows on the screen

| Feature | Student | Teacher | Researcher | Specialist |
|---|:---:|:---:|:---:|:---:|
| Repository (view, upload, delete, clear) | ✅ | ✅ | ✅ | ✅ |
| Import / export `.tusab` | ✅ | ✅ | ✅ | ✅ |
| Per-channel report | ✅ | ✅ | ✅ | ✅ |
| Prompt Library | ✅ | ✅ | ✅ | ✅ |
| Admin and full reset | ✅ | ✅ | ✅ | ✅ |
| YouTube extraction and queue | — | ✅ | ✅ | ✅ |
| [Public sources](/funcionalidades/fontes-publicas) | — | ✅ | ✅ | ✅ |
| Overview | — | ✅ | ✅ | ✅ |
| System monitor | — | — | — | ✅ |

Permission to delete or clear files doesn't depend on the profile: it is controlled per project (read-only marker, checked via `GET /export/readonly-status`).

In the Prompt Library, each built-in prompt states the profiles it is meant for (for example, Exam and Lesson plan for Teacher; Material review and Gaps for Researcher).

## In the desktop app

The discontinued desktop app used the same profiles, with extra tabs that don't exist in the extension: **Assistant** (chat), conversation **History** and the **Study** tab (instead of the Prompt Library), plus AI provider configuration, Broad Search and Google Drive for every profile. Each profile has a default Assistant persona: Didactic (Student and Teacher), Technical (Researcher) and Objective (Specialist). In the desktop app, the Specialist could also hide the Study Mode card on the home screen.

:::info Specialist's internal slug
Internally the Specialist profile's slug is `profissional`, kept for compatibility with data already saved (`localStorage`). The label in the interface is "Specialist".
:::

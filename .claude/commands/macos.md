---
description: Consulta o especialista em build/release macOS do Tusab — Electron, code signing, notarização, empacotamento
---

Adote o papel descrito em @agents/macos.md.

Analise o problema, erro de CI ou decisão de configuração descrita pelo usuário com foco em:
- Certificado/assinatura (Developer ID Application, algoritmo do `.p12`, entitlements, Hardened Runtime)
- Notarização (App Store Connect API Key, schema do `mac.notarize`, verificação via `spctl`/`stapler`)
- Empacotamento (Python portátil, `extraResources`, paridade com o pipeline Windows)
- Limites de sistema do runner CI (`ulimit` vs `sysctl kern.maxfilesperproc`, EMFILE, espaço em disco/imagem do `.dmg`)
- Paridade de plataforma (branches `IS_MAC` sem regressão no Windows)

Antes de propor qualquer diagnóstico, consulte `agents/_historia.md` (seção "Suporte a macOS") — várias causas raiz já foram confirmadas nesta sessão e não devem ser re-hipotetizadas do zero (ex: "wrong password" no `.p12` quase sempre é algoritmo, não senha).

Responda com diagnóstico preciso, comando/config exata pra corrigir, e se aplicável o `only_job` certo pra testar isolado no CI sem pagar o custo do workflow inteiro.

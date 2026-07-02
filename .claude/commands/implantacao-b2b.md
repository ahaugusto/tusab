---
description: Consulta o engenheiro de Implantação B2B do Tusab — build variant institucional, licenciamento offline, deploy TI (silent install/GPO), LTS e ambientes corporativos restritos
---

Adote o papel descrito em @agents/implantacao-b2b.md.

Avalie a questão de empacotamento, deploy ou requisito enterprise descrita pelo usuário com foco em:
- As 5 lições de packaging já pagas (sandbox Electron, python_env ≠ .venv, degradação graciosa mascarando falha, assets renomeados, smoke em dev)
- Fases 1–2 do plano B2B (`Documentação do Produto/Plano B2B — Edição Institucional.md`)
- Restrições de ambiente corporativo (EDR/GPO, proxy, multiusuário Windows, locks do backend)
- Verificação positiva no `.exe` instalado — nunca confiar em degradação graciosa

Retorne passo a passo concreto e termine com o checklist de verificação em máquina limpa.

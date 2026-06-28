---
description: Executa o checklist completo de QA do Tusab — testa todos os fluxos críticos e retorna PASS/FAIL/WARN por item
---

Adote o papel descrito em @agents/qa.md e execute o checklist completo de QA.

Se o usuário especificou um fluxo específico (ex: "apenas extração" ou "só acessibilidade"), foque naquela seção. Caso contrário, percorra todos os 12 fluxos.

Para cada item do checklist:
1. Leia o código relevante nos arquivos do projeto para inferir o comportamento esperado
2. Marque [PASS] se a implementação está correta, [WARN] se há risco ou ambiguidade, [FAIL] se há bug evidente
3. Para FAILs, descreva o problema e proponha a correção

Ao final: resumo com contagem total e lista priorizada de FAILs.

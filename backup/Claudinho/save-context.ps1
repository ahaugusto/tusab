# save-context.ps1
# Salva um snapshot do contexto atual da sessao de trabalho com o Claudinho.
# Uso: .\backup\Claudinho\save-context.ps1 [-Note "descricao opcional"]
#
# Cria um arquivo Markdown em backup/Claudinho/ com:
#   - data/hora do snapshot
#   - branch e ultimo commit do git
#   - arquivos modificados (git status)
#   - log dos ultimos 10 commits
#   - nota livre opcional
#
# Nao commita nada -- apenas registra o estado para nao perder contexto.

param([string]$Note = "")

$ROOT    = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OUTDIR  = Join-Path $ROOT "backup\Claudinho"
$STAMP   = (Get-Date -Format "yyyy-MM-dd_HH-mm")
$OUTFILE = Join-Path $OUTDIR "ctx_$STAMP.md"

Push-Location $ROOT

$branch  = git rev-parse --abbrev-ref HEAD 2>&1
$lastsha = git log -1 --format="%H" 2>&1
$lastmsg = git log -1 --format="%s" 2>&1
$status  = git status --short 2>&1
$log10   = git log --oneline -10 2>&1

$content = @"
# Snapshot de Contexto -- Sebayt / Claudinho
**Data:** $STAMP
**Branch:** $branch
**Ultimo commit:** ``$lastsha``
> $lastmsg

---

## Nota
$(if ($Note) { $Note } else { "(nenhuma nota informada)" })

---

## Status dos arquivos (git status)
``````
$($status | Out-String)
``````

## Log (ultimos 10 commits)
``````
$($log10 | Out-String)
``````

---
*Gerado por save-context.ps1 -- nao commitar este arquivo automaticamente.*
"@

[System.IO.File]::WriteAllText($OUTFILE, $content, [System.Text.UTF8Encoding]::new($false))

Pop-Location

Write-Host ""
Write-Host "  [OK] Snapshot salvo em:" -ForegroundColor Green
Write-Host "       $OUTFILE"
Write-Host ""

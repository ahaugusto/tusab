#!/usr/bin/env bash
# Copyright (c) 2026 CriAugu — CNPJ 65.131.075/0001-57
#
# Decide se os commits desde a última tag justificam uma release.
# Uso: release-pendente.sh <ultima-tag> [ref]
# Saída (stdout): "publicar" ou "nada". O motivo vai para stderr (log do CI).
#
# Regras (subject em conventional commits, merges ignorados):
#   - feat / fix / perf / revert / security, ou "!" / BREAKING CHANGE → publicar,
#     exceto com escopo ci/docs/test(s) — ex.: fix(ci) não muda o app entregue
#   - só chore(deps)/build(deps) → publicar apenas se o bump mais antigo ainda
#     não lançado tiver MAX_DIAS_DEPS dias ou mais (padrão 28), pra correções de
#     segurança em dependências não ficarem paradas indefinidamente
#   - só docs / ci / test / refactor / style / chore → nada
set -euo pipefail

TAG="$1"
REF="${2:-HEAD}"
MAX_DIAS_DEPS="${MAX_DIAS_DEPS:-28}"

commits=$(git log --no-merges --format='%ct%x09%s' "$TAG..$REF")
if [ -z "$commits" ]; then
  echo "Nenhum commit desde $TAG." >&2
  echo nada
  exit 0
fi

relevantes=$(printf '%s\n' "$commits" | cut -f2- \
  | grep -Ei '^(feat|fix|perf|revert|security)(\([^)]*\))?!?:|^[a-z]+(\([^)]*\))?!:|BREAKING CHANGE' \
  | grep -Eiv '^[a-z]+\((ci|docs|tests?)\)!?:' || true)
if [ -n "$relevantes" ]; then
  echo "Commits que exigem release desde $TAG:" >&2
  printf '%s\n' "$relevantes" | sed 's/^/  /' >&2
  echo publicar
  exit 0
fi

deps=$(printf '%s\n' "$commits" | grep -Ei $'\t''(chore|build)\(deps\)' || true)
if [ -n "$deps" ]; then
  mais_antigo=$(printf '%s\n' "$deps" | cut -f1 | sort -n | sed -n 1p)
  idade=$(( ( $(date +%s) - mais_antigo ) / 86400 ))
  if [ "$idade" -ge "$MAX_DIAS_DEPS" ]; then
    echo "Só atualizações de dependência, mas a mais antiga está há $idade dias sem release (limite: $MAX_DIAS_DEPS)." >&2
    echo publicar
    exit 0
  fi
  echo "Só atualizações de dependência desde $TAG; a mais antiga tem $idade dias (publica ao atingir $MAX_DIAS_DEPS)." >&2
  echo nada
  exit 0
fi

echo "Só commits internos (docs/ci/test/refactor/chore) desde $TAG — nada a publicar." >&2
echo nada

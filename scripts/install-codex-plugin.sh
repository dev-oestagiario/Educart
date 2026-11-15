#!/usr/bin/env bash
set -euo pipefail
if ! command -v codex >/dev/null 2>&1; then
  echo 'Codex CLI não encontrado. Instale/configure o Codex antes de rodar este script.' >&2
  exit 127
fi
# Alternativa gerenciada às skills versionadas em .agents/skills/.
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock

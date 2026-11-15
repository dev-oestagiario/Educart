$ErrorActionPreference = 'Stop'
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw 'Codex CLI não encontrado. Instale/configure o Codex antes de executar este script.'
}
# Alternativa gerenciada às skills versionadas em .agents/skills/.
codex plugin marketplace add mattpocock/skills
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
codex plugin add mattpocock-skills@mattpocock
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

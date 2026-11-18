# Issue #66 — Segurança das dependências: contenção e diagnóstico

Data: 18/11/2026. Candidata baseada na F6.5 (#73). Status: **mitigação técnica parcial; bloqueador P0 aberto**.

## Diagnóstico

- GHSA-fc5q-39xc-vjpf / CVE-2026-112366: ReDoS de severidade alta. O [advisory oficial](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), atualizado em 17/11/2026, lista versões até 4.0.7 e nenhuma versão corrigida. A [issue upstream #247](https://github.com/micromatch/picomatch/issues/247) permanece aberta.
- No CQP-KAINA-72, npm ci limpo, npm audit --audit-level=high: exit 1, cinco entradas high, zero critical. Uma causa raiz, propagada a fdir, tinyglobby, vite e vitest. npm view: picomatch latest 4.0.7, 4.0.8 E404. Vite 8.3.8 e Vitest 5.1.1 também dependem de picomatch ^4.0.7, e tinyglobby 0.2.17 de ^4.0.4; atualizar majors não elimina a causa. Não introduzir override, fork, downgrade, patch não revisado ou redução do gate.
- npm ls picomatch --omit=dev --all: árvore vazia. npm audit --omit=dev --audit-level=high: exit 0, todas as severidades zero. Lockfile classifica os cinco pacotes como dev=true. No código src/public não foram encontradas referências aos pacotes afetados ou import.meta.glob. Isso não prova ausência de qualquer vulnerabilidade ou segurança integral.

## Contenção e verificação

- Vite dev e preview usam 127.0.0.1 por padrão; não passar --host 0.0.0.0, não expor ferramentas de desenvolvimento à rede e não publicar servidor Vite. GitHub Pages recebe artefato estático, não node_modules.
- npm run audit:runtime: diagnóstico adicional do runtime, **não substitui npm run audit**.
- npm run audit:bundle: compila em memória e verifica os IDs de módulos emitidos nos chunks, lockfile e defaults loopback. Não é prova de ausência de código vendorizado ou escaneamento integral de todos os riscos; verifica especificamente o escopo dos cinco pacotes.
- Workflow verify/pages continua exigindo npm run audit (árvore completa). Nenhuma política afrouxada, dependência ou lockfile atualizado.

## Evidências do PC

Commit c971fa657ba9681c7f919250c45761b72f9c71a1, CQP-KAINA-72 (Windows, Node 24.20.0, npm 11.19.0):
- TypeScript exit 0; Vitest 134/134; build exit 0 (10 s); Playwright 69 aprovados, 4 ignorados, zero falhas (53,1 s). Dois skips legados e dois de axe-core ausente neste worktree; a rodada F6.4 anterior, com axe, aprovou 71. Backend simulado. Não equivale a homologação real.
- audit:runtime exit 0, 0 vulnerabilidades reportadas. audit:bundle exit 0, 576 módulos inspecionados, runtimeMatches e bundleMatches vazios, loopbackDefaults true. Configuração testada no build com valores sintéticos.
- Audit completo exit 1. Não houve alteração de package-lock.json, integração, produção, publicação, tag ou execução deliberada de Actions.

## Aceite restante

- [ ] Versão corrigida oficial ou solução compatível efetivamente revisada; confirmar integridade e atualizar lockfile.
- [ ] npm ci, audit completo exit 0 e regressão automatizada completa com axe.
- [ ] Revisar evidências e fechar #66 somente após aceite. Não autorizar #71 enquanto houver P0. Pode-se avançar em #67–#70 independentemente.

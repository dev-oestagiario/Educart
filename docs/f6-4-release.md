# F6.4 — Candidata de release (não publicada)

A divergência entre main e a cadeia acumulada foi conciliada na branch F6.4. A comparação GitHub, com ancestral comum 2b23556, mostra 140 commits à frente e 4 atrás. A diferença exclusiva de main é src/styles.css: regra de toque 44 px no botão Atualizar da consulta pública. A regra integral já está presente na candidata. Merge de ancestralidade preserva ambos os históricos e o conteúdo da candidata; main permanece intacta.

## Candidata e evidências reproduzíveis
- Base de desenvolvimento: PR #64, 1ef11a1. Main observada 0711bce. Merge de ancestralidade 38a147224f836960f0757f106c4430f112f92b0d; comparação GitHub após merge: 141 commits à frente, zero atrás. Não confundir histórico truncado local (clone shallow) com divergência real. Comparação server-side confirmou que a única alteração de conteúdo exclusiva da main já constava no CSS acumulado. Nenhum merge na main.
- Regressão no localhost Termux/Debian 13 ARM64, Node 24.9.0, checkout 38a1472: TypeScript, 134/134 Vitest, 12/12 layout, 3/3 GLB, 5/5 worker, 4/4 probe, 13/13 migrations, fixtures RLS/fundação espacial e regressões SQL operacionais, restauração 28 tabelas/29 linhas de dados sintéticos, build aprovado (Vite 59,23 s). Reutilizou dependências do clone anterior; lockfile do produto não alterado. Não houve instalação limpa nesta rodada. Avisos de chunks >500 kB permanecem.
- Artefato local: scripts/verificar-artefato-release.mjs, testes 6/6 (fc935f7), confere SHA/ref/data do manifesto, HTML, JS/CSS relativos, ausência de flags experimentais na entrada compilada, rejeita links simbólicos e caminhos inválidos. Validou 2 assets de entrada reais do build 38a1472 com version.json gerado localmente, não atestação criptográfica ou evidência de deploy. Probe HTTP local sob /Educart/ passou para HTML e JS. Não valida execução JavaScript nem todos os chunks, autorização ou hospedagem. Workflow Pages futuro chama verificador antes de upload; nenhum workflow disparado intencionalmente nesta fase.
- Audit: npm audit --audit-level=high exit 1, cinco high, zero critical; GHSA-fc5q-39xc-vjpf (picomatch até 4.0.7), propagação para fdir/tinyglobby/vite/vitest. npm view picomatch retornou 4.0.7; 4.0.8 indisponível no registro consultado. Não desabilitar gate, forçar downgrade ou declarar mitigação concluída.
- Playwright: descoberta 73 testes; tentativa dos dois testes F6.2 falhou por crash fatal de GPU no Chromium/PRoot (exit_code=5) antes de concluir cenários. PCs desktop offline. Não é resultado funcional dos casos. E2E completo e homologação em navegador continuam bloqueados.
- Supabase real (Auth, JWT, PostgREST, concorrência, backup/Storage e estado remoto) não testado nesta rodada; PGlite com claims simuladas é complementar. Monitor externo, canal de alerta, aprovação da política de backup, aceite visual e responsáveis TI pendentes.

## Pré-flight de publicação (somente candidato)
```sh
npm run typecheck
npm test -- --maxWorkers=2
node --test scripts/verificar-f5-2-layout.mjs scripts/email-worker.test.mjs scripts/verificar-saude-deploy.test.mjs scripts/verificar-artefato-release.test.mjs
node scripts/generate-f5-3-assets.mjs --check
node scripts/verificar-f5-6-sql.mjs
node scripts/verificar-sql-local.mjs
node scripts/ensaiar-f6-1-recuperacao.mjs
npm run build
npm audit --audit-level=high
npm run test:e2e
```
Para testes SQL, usar prefixo local PGlite 0.5.16 conforme F5.6/F6.1. Não executar escrita em produção. Artefato validado apenas após build e metadados correspondentes ao SHA real construído. No workflow oficial, GITHUB_SHA e GITHUB_REF_NAME vêm do runner; não fabricar metadados de publicação.

## Gates e próximo passo
F6.4 preparada, **v1.0.0 não publicada**. PR consolidado em rascunho com base main para revisão de toda a cadeia; não integrar antes de resolver audit, navegador, homologação real, recuperação operacional, aceite e disponibilidade de pipeline. Nenhuma tag, release, deploy público, configuração remota ou alteração de produção. Preservar F5.6 e 3D DEV-only; desativação da entrega de e-mail continua obrigatória. F6.5 pode organizar backlog e pendências sem encerrar como aceitos os requisitos não homologados.

## Reteste no PC conectado — 18/11/2026

- Executor CQP-KAINA-72, Windows, Node 24.20.0/npm 11.19.0; worktree isolado em C:\programacao\Educart-f64-retese. Instalação limpa npm ci: 161 pacotes, 21 s, sem alterações no lockfile; avisos de scripts de instalação, build aprovado.
- Commit inicial 7f324ff: typecheck, 134/134 Vitest, layout 12/12, GLB 3/3, build 9,04 s, SQL RLS e regressões operacionais 13 migrations, restauração PGlite 28 tabelas/29 linhas. Backup 477 ms e recuperação 410 ms (sintético, não RPO/RTO real). Primeira regressão Playwright: 68 aprovados, 4 skips (2 legados e 2 axe ausente), 1 falha. Verificador de artefato falhou em criação de symlink com EPERM no Windows.
- Diagnóstico via trace: mock GLB abrangente interceptou módulo Vite .glb?import&url e causou falha de import dinâmico, não falha de WebGL da aplicação. Correção c908852 restringiu interceptação ao recurso GLB e separou testes de flag/link; junction de diretório no Windows permite exercitar segurança sem privilégios adicionais. Teste integrado revelou ainda localização exata do turno/limite de 30 s; aef8782 usa combobox pelo nome acessível e timeout proporcional de 90 s (não altera runtime).
- Dependência axe-core@4.11.1 instalada apenas no prefixo isolado; PGlite 0.5.16 fixado. Reteste completo no commit aef8782cd8b076103869ff151dece96f4ef66416: 71 Playwright aprovados, 2 skips legados da Fase 5, **0 falhas**, 54,5 s, exit 0; incluindo F5.2 (fallback GLB, detalhe, porta virtual, cache, turno e responsividade), F6.2, axe administrativo/professor/público sem violações nos recortes executados. 16/16 testes Node (5 worker, 4 probe, 7 artefato), exit 0. Diff de src, package.json, lockfile e supabase entre 7f324ff e aef8782 vazio. Não confundir testes simulados com aceite visual/físico, GPU/FPS em carga ou homologação real.
- Audit repetido no Windows: exit 1, 5 high, 0 critical; picomatch latest 4.0.7, 4.0.8 E404. Docker indisponível e WSL não instalado; Auth/JWT, PostgREST e concorrência em ambiente isolado real não executados nesta rodada. Sem modificações de configurações do Windows/produção, sem instalar Docker ou WSL.
- Gate Playwright desktop simulado aprovado; permanecem audit, homologação real, testes físicos de desempenho, política de backup/monitoramento operacional, aceite TI e pipeline indisponível. Não publicar ou taguear v1.0.0. PR #65 permanece rascunho. Sem Actions ou alterações de main/produção.

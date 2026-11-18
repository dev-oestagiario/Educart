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

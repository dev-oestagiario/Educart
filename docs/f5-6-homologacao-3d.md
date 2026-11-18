# F5.6 — Homologação e preparação de publicação (não liberada)

Base PR #60. Não promover a main, ligar menu em produção, aplicar migrations em produção ou criar release enquanto os gates abaixo estiverem abertos. O V2 segue acessível somente ao administrador em DEV com ?environment3d=1. Configuração espacial: ?spatial3d=1. A autorização real continua no backend, não na flag.

## Correções
- Contratos de resumo rejeitam timestamp inválido, saldo aritmeticamente incoerente, capacidade efetiva divergente, estado contraditório e pose incompleta. Detalhe rejeita soma de reservas divergente, período duplicado, slot/notebook duplicado ou reserva individual sem vínculo explícito no período. Comparação entre resumo e detalhe inclui identidade, modelo, pose e versão; estado desconhecido nunca equivale a livre.
- Testes anteriores de mocks foram alinhados aos contratos. E2E ampliado com quatro estados (livre, parcial, cheio e manutenção), seleção por teclado, fallback, corte, histórico, cache, troca de turno e seis larguras (320/360/390/768/1024/1280), reduced-motion. São casos preparados, não homologação executada.
- Sem mudança de SQL, políticas de autorização, aplicação de migrations remotas ou acesso a dado real. Assets permanecem ilustrativos e vínculos reais são exibidos separadamente.

## Matriz de aceite
| Gate | Evidência | Estado |
| --- | --- | --- |
| DT-024 contratos | Typecheck e Vitest 124/124 (5 novos), commit df54d94; layout 12/12, reprodução SHA-256 dos 3 GLB e build no 2997dc0 | Aprovado localmente |
| DT-024 SQL | 13 migrations aplicadas em PostgreSQL WASM/PGlite 0.5.16; f1_1_rls_read_only.sql e f5_1_spatial.sql, incluindo admin, professor, conta sem vínculo, anônimo, colisão, versão, manutenção, reserva, auditoria e consulta pública | Aprovado com claims simuladas |
| Regressões | scripts/verificar-sql-local.mjs: F3.1/F3.2/F3.3/F3.5/F3.6; email-worker 5/5 | Aprovado isoladamente |
| Segurança dependências | npm audit --audit-level=high exit 1: cinco entradas high, zero critical, uma causa raiz em picomatch (GHSA-fc5q-39xc-vjpf) propagada a fdir/tinyglobby/vite/vitest. Registry consultado retorna 4.0.7 como última versão; 4.0.8 indisponível. Não executar downgrade major automático nem patch improvisado. | Bloqueado |
| DT-025 navegador | E2E ampliado e tentativa efetiva no Chromium ARM64, com falha de infraestrutura. Chromium headless 159.0.8154.6 (Linux ARM64) e dependências Playwright instalados no Debian 13 PRoot por meio de testes desta fase. Execução F5.2 tentada com Playwright: 2/2 casos bloqueados por falha fatal do processo GPU (exit_code=5), antes de concluir os testes. Três perfis de lançamento adicionais (GPU desativada, SwiftShader e processo único) também não conseguiram abrir uma página. PCs tradicionais offline. O bloqueio é de infraestrutura no Android/PRoot; não afirmar falha funcional nem aprovação visual. | Pendente |
| DT-025 performance | F5.5 mediu nós detalhados em Node, não FPS/GPU/memória do navegador. Chunks JS >500 kB permanecem | Pendente |
| DT-026 ambiente real | JWT/PostgREST/Supabase de homologação, concorrência com conexões distintas, consistência operacional com dados controlados, comparação de patrimônio e referências físicas autorizadas, inspeção visual pela TI | Pendente |
| DT-027 release | Não houve merge, deploy, tag nem ativação de menu. Flags DEV preservadas; build de produção não contém literal environment3d (verificação estática, não teste de autorização). | Bloqueado |

## Ambiente e reprodução
localhost (Android ARM64, Termux, Debian 13 PRoot), Node 24.9.0. Clone de teste atualizado por fetch, commits via conexão Dev. Dependência PGlite instalada apenas no prefixo local de testes .local-sql-test; lockfile do produto não modificado. Não usar credenciais reais. Comandos:
```sh
npm ci
npm run typecheck
npm test -- --maxWorkers=2
node --test scripts/verificar-f5-2-layout.mjs
node scripts/generate-f5-3-assets.mjs --check
node --test scripts/email-worker.test.mjs
npm run build
npm install --prefix .local-sql-test --ignore-scripts --save-exact @electric-sql/pglite@0.5.16
node scripts/verificar-f5-6-sql.mjs
node scripts/verificar-sql-local.mjs
npm audit --audit-level=high
npm run test:e2e -- --grep 'F5.1|F5.2' --workers=1
```
PGlite cria base em memória, auth.uid e claims simuladas; não comprova Auth real nem concorrência. Fixture F5.1 executada com rollback. A primeira tentativa do runner exigiu preparar admin sintético para o teste read-only; corrigido e reexecutado com exit 0. Não se conectou ao Supabase hospedado.

## Procedimento de aceite e publicação
1. Corrigir/reavaliar advisory em atualização compatível com lockfile revisado; exigir audit e regressão. Manter Vite dev server em loopback e fora de exposição remota; isso não encerra o finding.
2. Executar todos E2E com Chromium em PC autorizado. Verificar estados, raycast por IDs, 3D desligado, fallback GLB/WebGL, toque/teclado, zoom 200%, contraste claro/escuro, redução de movimento, rede limitada e FPS/memória em configuração de referência. Registrar screenshots com dados sintéticos.
3. Em Supabase de homologação autorizado, aplicar migrations por ordem, rodar RLS com usuários distintos e teste de concorrência em Postgres com duas conexões. Conferir dashboard, relatórios, reservas, manutenção, movimentações e consulta pública para os mesmos períodos. Não testar escrita em produção.
4. A TI confere capacidades, posições e vínculos cadastrados e aprova expressamente a representação ilustrativa ou as referências reais autorizadas. Não inventar planta ou equiparar slot de GLB a patrimônio.
5. Somente com aceite documentado, elaborar PR de promoção (backup, revisão dos gates, feature flag controlada, smoke tests e rollback por reversão/desativação). Aprovação explícita antes de integrar/publicar.
6. Atualizar manual e changelog de release com evidências e limitações. F6.1 (backup/restore) pode ser preparada separadamente, mas nenhuma liberação F6.4 enquanto gates críticos F5.6 estiverem abertos.

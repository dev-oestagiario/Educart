# Issue #71 — Preparação da publicação v1.0.0

Data: 18/11/2026. **Pré-flight executado; publicação bloqueada.** Nenhuma aprovação implícita, nenhuma promoção, tag, deploy ou migration remota executada.

## Candidata e integração

A base main observada é 0711bce0805cbf9b5a4167705146ff43aa8c1b06. A candidata da #70 (a7c870bbe2f6c702e99ad7699e91fd9ff4848b84) está 161 commits à frente e zero atrás, 150 arquivos na comparação GitHub. O executor de pré-flight foi adicionado em 3b42513914e419da6b4f98a4a9e77fb38a27b771. A comparação verificou ancestralidade das cabeças de #44, #45, #64, #65, #73 e #78 na nova candidata, sem commits ausentes desses pontos. Existem 28 PRs históricos/empilhados abertos (#44–#65, #73–#78). A nova branch release/v1-0-0-candidate consolida a cadeia para revisão em um PR draft com base main; não integrar PRs duplicando alterações, não fechar PRs antigos por antecipação. Após aceite, revisar novamente o diff e ancestralidade da main atual e decidir forma de integração que preserve histórico; só então atualizar PRs já incorporados.

## Pré-flight reproduzível

Em worktree de teste limpo, Node compatível, com browsers disponíveis, dependências do lockfile instaladas e sem credenciais reais. Instalar PGlite e axe-core apenas no prefixo isolado de teste, conforme F6.1/F4.3. O comando exige opt-in EDUCART_LOCAL_RELEASE_PREFLIGHT=1. Usa configuração Supabase explicitamente sintética; não reutilizar o dist da execução para produção.

```sh
npm ci --no-audit --no-fund
npm install --prefix .local-sql-test --ignore-scripts --save-exact @electric-sql/pglite@0.5.16 axe-core@4.11.1 --no-audit --no-fund
EDUCART_LOCAL_RELEASE_PREFLIGHT=1 npm run release:preflight
```

Em PowerShell, definir `$env:EDUCART_LOCAL_RELEASE_PREFLIGHT='1'` e executar `npm.cmd run release:preflight`. Executa checagens mesmo quando audit falha para registrar diagnóstico completo. Valida E2E JSON: dois skips legados nominalmente permitidos, nenhuma falha, flaky ou novos skips. Gera version.json local com SHA verificado do checkout e ref local-rehearsal, verifica HTML/JS/CSS, probe HTTP e versão em loopback. O relatório declara publicationApproved=false invariavelmente, syntheticArtifact=true; exit 1 em qualquer falha. Exit 0 não implica aprovação de publicação. Não há operação de deploy no executor.

## Evidência efetiva

PC CQP-KAINA-72 (Windows, Node 24.20.0, npm 11.19.0), worktree Educart-issue70 atualizado para 3b42513914e419da6b4f98a4a9e77fb38a27b771. Dependências do npm ci da #70 reutilizadas, sem alteração de lockfile, PGlite/axe instalados isoladamente. Pré-flight PID 9140, duração 144,05s, log local educart-71-preflight.log. Resultado: 14/15 verificações positivas; exit 1 por audit completo.

| Gate | Resultado |
|---|---|
| TypeScript | PASS |
| Vitest | PASS, 25 arquivos |
| Node tests (layout, worker, probe, artefato, preflight, backup, monitor) | PASS |
| GLB | PASS |
| Audit completo | FAIL, 5 high, 0 critical; picomatch latest 4.0.7 |
| Audit runtime / bundle | PASS; 0 vulnerabilidades runtime reportadas |
| Verificação SQL F5.6 / regressão SQL / recuperação F6.1 | PASS, 13 migrations em PGlite, Auth com claims simuladas; não backup real |
| E2E e cobertura | PASS, 72 aprovados, 2 skips legados, 0 falhas/0 flaky, mesma rodada, 71,67s |
| Build sintético | PASS, 18,157s (tsc + Vite) |
| Artefato e HTTP loopback | PASS, dois assets de entrada, versão local conferida |

Não inferir publicação, ausência integral de vulnerabilidades ou compatibilidade com produção. O SHA testado contém o código do executor e toda a candidata; commit documental posterior não é o SHA construído.

## Estado do Supabase via conexão Myhouse

Consulta de metadados somente leitura confirmou Educart ativo, PostgreSQL 17.11.0.019, oito migrations e nenhum branch isolado. Cinco migrations futuras da candidata ainda não constam no histórico remoto:

1. 20261117173000 — localizações.
2. 20261117174739 — manutenção.
3. 20261117180935 — movimentações.
4. 20261117190439 — canal de e-mail opcional.
5. 20261117224356 — fundação espacial.

Não aplicar antes de #67, #68 e aprovação da janela. Usar conexão Myhouse para consultas/alterações autorizadas e Dev para GitHub. Não realizar upgrade destrutivo ou testes de escrita em produção. Preservar envio externo desligado e 3D DEV-only. Nenhuma nova migration aplicada nesta fase.

## Gate final: ordem de desbloqueio

| Dependência | Evidência disponível | O que bloqueia |
|---|---|---|
| #66 segurança | [contenção](issue-66-seguranca-dependencias.md); runtime/bundle aprovados | audit completo 5 high, correção compatível e regressão pendentes |
| #67 banco | [executor](issue-67-homologacao-real.md), testes PGlite | stack descartável Auth/JWT/PostgREST, concorrência real e upgrade desde baseline |
| #68 backup | [inventário e verificador](issue-68-backup-operacional.md) | exportação real cifrada, custódia, duas cópias, restore segregado, RPO/RTO aceitos |
| #69 operação | [monitor](issue-69-monitoramento-operacional.md), 24 testes | executor contínuo, heartbeat, canal e responsáveis; backup real |
| #70 aceite | [matriz](issue-70-aceite-operacional.md), regressão e carga | validações físicas, TI, leitores, impressão, GPU e aceite específico 3D |
| #71 publicação | este executor e PR consolidado | todas as dependências, pipeline autorizado, aprovação explícita e janela |

#72 opcional não bloqueia enquanto canal de e-mail continuar desativado. Cota gratuita de Actions informada como esgotada pelo usuário; não foi disparado workflow nem verificada nova disponibilidade nesta rodada. A publicação oficial via workflow Pages deve preservar audit completo, testes e validação de artefato. Resolver infraestrutura/cota ou alternativa de publicação autorizada com garantias equivalentes, sem remover gates ou importar dist sintético. Não cadastrar release/tag apenas para sinalizar conclusão de código.

## Runbook de promoção (somente após gates e aprovação)

- [ ] Revalidar base/head, revisão de código, checklist #66–70 e evidência vinculada ao SHA final.
- [ ] Aprovar janela e ponto recuperável de backup; homologar cinco migrations pendentes e compatibilidade do frontend anterior (rollback).
- [ ] Congelar alterações em janela autorizada quando necessário; aplicar migrations revisadas em ordem exclusivamente após backup validado. Conferir histórico, grants/RLS e configuração; não ligar e-mail/3D.
- [ ] Integrar o PR consolidado, construir artefato de produção com configuração pública correta (nenhuma chave privilegiada), amarrar version.json ao SHA integrado e passar verificações obrigatórias. Não reaproveitar arquivo sintético da etapa local.
- [ ] Publicar Pages via pipeline autorizado; verificar SHA, URL, HTML, bundle, consulta pública e smoke com contas autorizadas sem criar registros fictícios em produção.
- [ ] Se falhar, parar promoção, conter novas escritas quando necessário, reverter frontend a SHA compatível; não presumir rollback de schema. Seguir runbook F6.1, restaurar apenas em destino aprovado e reconciliar dados/efeitos externos.
- [ ] Só após smoke e aceite documentados, criar tag/release v1.0.0, registrar notas e encerrar issues realmente aceitas. Atualizar #33 e backlog; manter #72 como evolução opcional.

O roadmap de implementação foi percorrido; próximas ações são desbloqueio e homologação, não inventar fase adicional. Não marcar #71 como fechada.

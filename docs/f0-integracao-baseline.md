# F0 — Integração e baseline do Educart

**Roadmap:** #33 · **PR de consolidação:** #34 · **Data:** 17/11/2026.

## Constituição e especificação

Consolidar a aplicação integral, preservar os commits existentes, garantir instalação reproduzível e preparar publicação exclusiva a partir de main após CI. Não alterar regras funcionais, permissões, reservas, credenciais nem executar migrations de produção. Manter o 3D legado oculto. Homologação SQL e sessões reais continuam nas F1/F2.

## F0.1 — Inventário

Comparação main...feat/consulta-publica-carrinhos: **176 commits à frente, 0 atrás, 97 arquivos**; base e ancestral comum `0fd6d0a67392a9b1a163839571ab0b345ccc04ba`. Head acumulado preservado: `be73069f2b12e0713cbb15f6e60f15e6b17c638d`. Os 15 PRs eram abertos, em draft e mergeáveis contra suas bases respectivas; cada head é a base do PR seguinte, formando uma cadeia linear.

| PR | Head (curto) | Entrega |
|---|---|---|
| #10 | a60e2e4 | Fundação e cadastros |
| #11 | 322eed3 | Reservas |
| #12 | db3a60a | Gestão e auditoria |
| #13 | 68f02d7 | Calendário e relatórios |
| #14 | e8d6d2f | 3D legado (oculto) |
| #16 | 9e30f24 | Portal de professores |
| #18 | 4534316 | Notificações |
| #20 | 0a4cbb0 | Prévia de disponibilidade |
| #22 | f828b7a | UX reservas |
| #24 | c501912 | UX cadastros |
| #26 | 8894f14 | Responsividade |
| #28 | 97317f3 | Identidade visual |
| #29 | 784d507 | Correções de tema/menu |
| #31 | ba1dcaf | Relatório SENAI |
| #32 | be73069 | Consulta pública, temas e roadmap |

Sete migrations SQL, ordenadas pelos timestamps: fundação, reservas, gestão, solicitações, notificações, prévia, consulta pública. Preservar arquivos sem reexecutar na produção; verificar correspondência com o banco e ensaiar restauração na F2.6.

## F0.2–F0.4 — Plano e tarefas

- [x] Revisar ancestralidade e conflitos: main não contém mudanças divergentes.
- [x] Criar branch `chore/f0-integracao-baseline` a partir do head acumulado; PR #34 para main. Usar merge commit, não squash/rebase, para preservar os commits anteriores.
- [x] Gerar package-lock.json com npm no GitHub Actions (run 44105120626, job 134115256323); 256 entradas. Remover passo temporário e usar npm ci nos dois workflows.
- [x] Workflow PR/main com permissões mínimas de leitura e cancelamento de verificações obsoletas.
- [x] Pages de produção somente em main, inclusive dispatch; executar unitários, Playwright e build antes de publicar em environment github-pages; incluir dist/version.json com SHA/ref.
- [x] Documentar instalação local e regras de release.
- [ ] Verificar CI final do PR #34 com npm ci; merge condicionado ao sucesso e ausência de conflitos.
- [ ] Confirmar ancestralidade em main após merge; marcar PRs históricos integrados sem apagar branches de referência.
- [ ] Confirmar proteção de main/required checks no GitHub Settings (acesso de configuração não demonstrado pelo conector).
- [ ] Confirmar publicação e SHA em /Educart/version.json, rota pública anônima e versão de login. Se GitHub Pages environment requer aprovação/configuração, registrar bloqueio. Não publicar branches históricas.

## F0.5 — Triagem de issues

Não confundir código implementado com homologação. Sem encerrar requisitos de aceite real não verificados nesta fase.

| Issues | Implementação incorporada na baseline | Decisão |
|---|---|---|
| #1–#9 | #10, fundação/cadastros/importação e testes | Manter pendentes de aceite; #3/#9 segurança e homologação F1/F2, demais confirmar requisitos em F2.1. |
| #15 | #16, portal e aprovação | Manter para F1/F2.3 (JWT real e concorrência). |
| #17 | #18, notificações | F2.3 (isolamento real de destinatários). |
| #19 | #20, prévia | F2.3 (consistência e permissões). |
| #21/#23 | #22/#24, UX | Incorporado; verificar regressão e aceite em F2/F4. |
| #25 | #26, layout | F2.5/F4.3, dispositivos físicos. |
| #27 | #28/#29, identidade | Incorporado, revisão visual e contraste em F4. |
| #30 | #31, PDF | F2.4, relatório extenso/impressão. |
| #33 | Roadmap atual | Issue de acompanhamento, manter aberta. |

Os dois campi do SENAI Cascavel são escopo futuro F3/F5. Plantas e dimensões autorizadas ainda não fornecidas; não coletar nem publicar plantas reais sem autorização.

## Evidências e limites

- Baseline funcional previamente teve 41 Playwright aprovados e 2 testes 3D ocultos ignorados; CI final deve ser novamente validado com lockfile.
- A geração de lockfile no run de coleta passou no job verify; a instalação determinística será comprovada na última CI do PR.
- Nenhuma alteração ao banco, migrations ou dados reais. Não declarar segurança, concorrência ou homologação concluídas com E2E simulado.
- Rollback de código: manter SHA do main anterior e head acumulado; se a publicação apresentar regressão, reverter merge com PR, não forçar histórico nem restaurar banco sem plano específico.

# F6.5 — Triagem, encerramento técnico e backlog de evolução

Data: 18/11/2026. Base: PR #65, dd8ac3b. Objetivo: separar requisitos entregues, homologação pendente e evolução; não declarar v1.0.0 publicada. Sem alterações de aplicação, schema, infraestrutura ou dependências.

## Evidências de referência
- Candidata: 134 Vitest, 71 Playwright aprovados, 2 skips legados, 0 falhas; 13 migrations, 28 tabelas recuperadas em PGlite. Reteste desktop com backend simulado e axe; não é homologação institucional. [F6.4](f6-4-release.md).
- Main: PR #39 (F2.1 cadastros/reservas e CSV/XLSX com Auth real local), #40 (33 pares concorrentes), #41 (F2.3 contas/vínculos, isolamento, prévia, decisões e avisos), #42 (F2.4 relatórios reais) e #43 (mobilidade). Evidências históricas não comprovam a candidata atual nem aplicação das migrations no remoto.

## Inventário das 18 issues históricas (antes da triagem)
| Issue | Escopo | Triagem / evidência | Decisão |
|---|---|---|---|
| #1 | Spec fundação | Implementada no MVP; critérios globais e integração/aceite pendentes | Manter, #67 #70 #71 |
| #2 | Estrutura e painel | Build e navegação aprovados; conferir stack/critério histórico shadcn e política CI | Manter, #71 |
| #3 | Autenticação TI | Auth real local histórico F1.4; provisionamento institucional e matriz candidata | Manter, #67 #70 |
| #4 | Carrinhos | F2.1 F21-01/02/06/11 e regressão local | Manter até aceite da candidata, #67 |
| #5 | Professores | F2.1 F21-01/02; RLS e validação local | Manter até aceite da candidata, #67 |
| #6 | Notebooks | F2.1 F21-03/04/06; verificar uso real/edição e restrições | Manter, #67 |
| #7 | Geração em lote | F2.1 atomicidade, regressão de cadastros | Manter até aceite integral, #67 |
| #8 | Importação CSV/XLSX | F2.1 navegador real histórico; candidata e casos inválidos | Manter, #67 |
| #9 | Jornada administrativa | E2E e build aprovados; autorização real da candidata | Manter, #67 #70 |
| #15 | Portal do professor | F2.3 e F2.2 históricos; decisões de produto/multiunidade e revalidação | Manter, #67 #70 |
| #17 | Notificações internas | F2.3 histórico; critérios de migration e deploy ainda não confirmados na candidata | Manter, #67 #71 |
| #19 | Prévia do professor | F2.3 histórico + regressão mock; migration/deploy e teste real candidato | Manter, #67 #71 |
| #21 | UX reservas | Lista/formulário, calendário e histórico validados em mock; aceite físico pendente | Manter, #70 |
| #23 | UX cadastros | F4.2 e Playwright; aceite físico/pessoa autorizada pendente | Manter, #70 |
| #25 | Layout | Desktop, viewport móvel, reflow e axe aprovados; 3D legado oculto | Manter, #70 |
| #27 | Identidade | Conceito A selecionado, implementação e testes; inspeção física/aceite pendentes | Manter, #70 |
| #30 | PDF Agenda SENAI | #42 integrado, CI 44132142857/job 134211817515, 1.135 períodos e 17 páginas A4, filtros/CSV; regressão #65 | **Encerrada por aceite técnico do escopo original.** Impressão física e schema candidato em #67/#70 |
| #33 | Roadmap | Fases implementadas em graus distintos; publicação bloqueada | Manter como épico de acompanhamento |

Não encerrar requisitos apenas por código presente. Não confundir ficha histórica fechada com aceite de produção. Não alterar os requisitos originais, reabrir issues fechadas ou marcar checklists sem evidência. Comentários de triagem registrados em #30 e #33.

## Backlog de liberação
Prioridades P0 (bloqueadores da release); números referentes a issues criadas nesta fase. Dependências condicionais, sem datas/atribuições inventadas.

| Issue | Critério para encerramento | Dependência |
|---|---|---|
| [#66](https://github.com/dev-oestagiario/Educart/issues/66) | Audit aprovado com atualização compatível e regressão | [Diagnóstico e mitigação parcial](issue-66-seguranca-dependencias.md); correção oficial ou solução revisada pendente |
| [#67](https://github.com/dev-oestagiario/Educart/issues/67) | Auth, PostgREST, JWT, RLS, concorrência e regressão real de 13 migrations | [Executor e diagnóstico](issue-67-homologacao-real.md) preparados; stack real autorizado pendente |
| [#68](https://github.com/dev-oestagiario/Educart/issues/68) | Backup real aprovado, restore isolado, RPO/RTO e responsáveis | [Inventário e verificador](issue-68-backup-operacional.md) entregues; exportação, restore isolado e política autorizada pendentes |
| [#69](https://github.com/dev-oestagiario/Educart/issues/69) | Monitor contínuo, alertas e política de privacidade | [Monitor e ensaio](issue-69-monitoramento-operacional.md) entregues; executor contínuo, canal, backup real e responsável TI pendentes |
| [#70](https://github.com/dev-oestagiario/Educart/issues/70) | Aceite institucional, dispositivos físicos, impressão e acessibilidade; gate específico do 3D | Homologação real e referências autorizadas |
| [#71](https://github.com/dev-oestagiario/Educart/issues/71) | Integração, release, Pages, version.json e smoke com rollback | #66–#70 e aprovação explícita; CI disponível |

## Evolução futura
- P2 [#72](https://github.com/dev-oestagiario/Educart/issues/72) — canal de e-mail opcional (provedor, custo, opt-in, adapter, scheduler e idempotência). Manter desligado; não bloquear versão operacional por recurso opcional desativado.
- P2 — ampliar modelos autorizados e escala do 3D após #70; avaliar metas de desempenho, sem prometer inventário físico/telemetria.
- P2 — otimização de chunks >500 kB e métricas de carga após baseline mensurada; sem criar problema de performance fictício.
- Futuras definições de produto: multiunidade, políticas de exceções de reserva e manutenção, retenção e recursos de acessibilidade. Especificar antes de implementar, sem ampliar direitos de acesso.

## Limitações conhecidas / gate final
- Audit cinco high derivados de picomatch; correção indisponível no registro consultado. Não ignorar gate.
- Docker e WSL ausentes no CQP-KAINA-72; runtime nativo CLI 3.2.0 no Termux falhou na memória compartilhada PostgreSQL. Homologação integral atual não executada; Windows resolveu os E2E de mock.
- RPO/RTO, alertas, suporte e aceite dependem de responsáveis. 3D DEV-only, modelos ilustrativos; e-mail desativado; nenhuma configuração real/componentes de infraestrutura modificados.
- Main e Pages não promovidos, sem tag/release. PR #65 continua draft. F6.5 conclui triagem e organização, não libera F6.4 nem encerra #33.

# F3.5 — Reservas recorrentes

## Especificação e decisões
Recorrência semanal finita para TI e professor, com data inicial/final inclusivas, segunda a sexta, turnos comuns à série, prévia e exceções por data. Feriados permanecem reserváveis; excluir explicitamente datas não desejadas. Limite de 130 dias corridos e 93 ocorrências, conforme limites já empregados no sistema. Alterar o padrão redefine as exceções.

Materializar datas antes do envio. Uma única reserva ou solicitação contém todas as ocorrências e utiliza as RPCs existentes; capacidade, manutenção, datas, códigos e transação são verificados no servidor. Professor pode solicitar mesmo com conflito na prévia, sem ocupar capacidade; TI revalida ao aprovar. Sem nova migration, cron, rotina infinita ou criação automática futura. Não armazenar regra RRULE separada: editar a série reabre as datas concretas (avulsas), e o administrador pode escolher outro padrão explicitamente. Cancelar grupo ou período conforme as restrições existentes. Não editar agrupamentos com exceções irregulares por turno, para não reintroduzir períodos cancelados; o usuário pode cancelar períodos ou cadastrar nova reserva.

## Implementação
- Motor puro de expansão, rejeição de datas inválidas, retroativas, padrão vazio, exceções inválidas e limite excedido.
- Componente compartilhado nos formulários de reserva e solicitação, com datas, dias da semana, prévia de todas as ocorrências e seleção reversível de exceções. Exibir total de ocorrências e períodos. Layout mobile e tokens dos temas existentes.
- Prévia administrativa e períodos da listagem paginados, ordenados; consulta de códigos da edição em lotes para suportar séries longas.
- Preservar disponibilidade planejada, manutenção, histórico e restrições de custódia.

## Validação
PC CQP-KAINA-72, C:\programacao\Educart, sem GitHub Actions.
- 85 testes unitários aprovados (7 novos).
- Build de produção aprovado.
- Teste SQL em PGlite: 11 migrations existentes, série com conflito em uma ocorrência não gera registros parciais, exclusão, edição e cancelamento do agrupamento preservam reserva independente. Identidades simuladas; não substitui concorrência/Auth/PostgREST real.
- Playwright: 51 aprovados na regressão completa, 2 skips legados; novo caso de bloqueio de edição irregular aprovado isoladamente (52 aprovados combinados). Fluxo TI com conflito, exclusão e reinclusão, confirmação agrupada e edição; fluxo professor mobile, prévia, exceção e pedido pendente sem consumo; bloqueio de edição irregular.
- Nenhum pacote ou schema novo, nenhum dado de produção alterado. PR depende das fases anteriores. Auditoria de dependências picomatch e homologação Supabase real permanecem pendentes.
- Próxima F3.6: e-mails transacionais opcionais (provedor e custo sujeitos a aprovação, fila e deduplicação, preservar notificações internas).

## Reprodução
npm.cmd test -- --run
npm.cmd run build
npm.cmd run test:e2e
node scripts/verificar-sql-local.mjs

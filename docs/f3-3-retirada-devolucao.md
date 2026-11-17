# F3.3 — Controle de retirada e devolução

## Especificação e decisões
- Registrar movimentação efetivamente conferida pela TI, vinculada ao período (data e turno) de uma reserva confirmada. Uma retirada por período, no dia de utilização, com quantidade positiva até a quantidade reservada; não pressupõe horários exatos de início/fim dos turnos. Permitir retirada de parte da quantidade reservada e códigos opcionais de notebooks realmente conferidos; não inventar identificação física.
- A devolução confirma o retorno integral da quantidade retirada, ainda que em data posterior. Devoluções parciais e entregas complementares não integram esta fase; não concluir a devolução enquanto houver equipamento pendente.
- Registro dos responsáveis que receberam/devolveram, condição sem/com ressalva, observação obrigatória quando houver ressalva, horários gerados pelo banco e usuários TI que registraram. Preservar snapshots dos códigos e período, sem exclusão de histórico. Estado operacional separado de CONFIRMADA/CANCELADA: aguardando retirada, pendente de devolução e devolvida.
- Sem rastreamento em tempo real, nem presunção da localização física. Reserva e consulta pública representam ocupação planejada; devolução não cancela nem libera períodos confirmados. Dados de custódia internos, não informados a professores ou ao público.

## Implementação
- Menu Retirada e devolução: recortes Hoje, Pendentes de devolução (inclusive de datas anteriores) e Histórico por data da reserva; formulário de retirada, seleção opcional de códigos, formulário de devolução com condição e observação. Seleção e edição da reserva continuam separadas.
- Migration 20261117180935_educart_equipment_movements.sql criada via CLI no PC, nova tabela com RLS, SELECT apenas TI, sem escrita direta de clientes; duas RPCs com verificação admin e search_path fixo, timestamp do servidor e UUID do agente de registro.
- Chaves de idempotência por retirada/devolução; repetição com mesma chave e payload retorna o registro existente, sem novo evento. Alteração de payload ou nova chave após conclusão é rejeitada.
- Lock de reserva/carrinho/período na retirada e do carrinho na devolução. Impedir quantidade em custódia superior à capacidade nominal, códigos duplicados ou em outro carrinho, código pendente em outra movimentação ou reservado a outro período do mesmo turno. Impedir alteração de período com histórico, redução de capacidade abaixo da quantidade pendente e transferência/desativação de notebook identificado ainda em custódia. Histórico de reserva preservado; não cancelar automaticamente.
- Manifesto de recuperação ampliado para a nova tabela. Nenhuma migration aplicada remotamente.

## Validação no PC CQP-KAINA-72 (17/11/2026)
Clone em C:\programacao\Educart; operação sem GitHub Actions por esgotamento de cota. Node 24 e Chromium Playwright locais.
- Build de produção aprovado.
- 74 testes unitários aprovados.
- 47 testes de navegador com backend simulado aprovados; 2 skips legados do 3D. Novo caso: quantidade menor que reservada, código conferido, envio, condição com ressalva exigindo observação e devolução integral.
- 11/11 migrations executadas em PostgreSQL embarcado (PGlite). Suite verificar-sql-local.mjs: teste de F3.1/F3.2 e F3.3 com identidades simuladas; valida data futura, quantidade, código duplicado, nota obrigatória, retry idempotente, disputa sequencial por código/capacidade, bloqueio de inativação/edição, RLS, saldo planejado, retorno e nova retirada.
- Teste adicional homologacao-movimentacoes.mjs preparado para Supabase isolado, Auth real, duas sessões TI concorrentes, repetição de devolução e privacidade. Não executado devido à ausência de Docker/WSL neste PC. Não substituir evidência de concorrência por SQL sequencial.
- F2.6/F3.1/F3.2 ainda pendentes de integração; auditoria picomatch anterior continua bloqueando release até tratamento. Nenhum deploy nem alteração de produção.
- Próximo incremento F3.4: dashboard operacional (agenda de hoje, próximas utilizações, retiradas/devoluções pendentes, manutenção e solicitações).

## Reprodução
`npm.cmd test -- --run`, `npm.cmd run build`, `npm.cmd run test:e2e`, `node scripts/verificar-sql-local.mjs` (PGlite instalado conforme F3.2).
Para Auth/concorrência, com stack local em ambiente descartável e status JSON criado: `node scripts/homologacao-movimentacoes.mjs`. A suíte pula o teste de retirada em fim de semana, conforme a regra vigente.

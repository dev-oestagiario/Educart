# F3.6 — Notificações opcionais por e-mail

## Especificação / decisões
O e-mail complementa os avisos internos sem substituí-los. Opt-in individual de TI/professor com e-mail confirmado, revogável a qualquer momento. Por padrão o canal externo fica desativado, mesmo com preferência salva. Não selecionar ou contratar provedor, cadastrar credenciais, enviar mensagens reais ou agendar jobs externos sem aprovação. Eventos novos apenas; sem backfill de avisos antigos. Opt-out cancela pendências e é reavaliado antes do envio; mensagem já aceita pelo provedor não pode ser retirada.

## Implementação
- Tela Notificações, seção Preferências de e-mail, estado persistido, carregamento e erro. A preferência não altera a caixa interna.
- Migration 20261117190439_educart_email_outbox.sql: preferências, configuração global e outbox transacional; RLS nas três tabelas, nenhuma leitura/escrita direta por clientes anon/authenticated. RPCs de preferências limitadas à própria conta habilitada; fila e processamento acessíveis somente pelo serviço autorizado. Migração não aplicada remotamente.
- Eventos de criação/desistência de pedido (TI), decisão (professor), retirada/devolução (professor vinculado). Inserção junto ao evento de negócio, chave única por destinatário e evento. Nenhum endereço, nome, observação, localização ou texto livre armazenado na fila; endereço confirmado obtido no momento da autorização e mensagem genérica. Notificações internas de pedidos permanecem como antes; retirada/devolução geram eventos de e-mail opcionais.
- Worker server-side em scripts/email-worker.mjs, sem transporte concreto nem scheduler, habilitação explícita e interface para RPC/transport. Claim em lote com FOR UPDATE SKIP LOCKED, lease de 15 minutos, token por tentativa, confirmação, máximo de cinco tentativas com backoff (5, 10, 20, 40 min para novas tentativas). Pendência com mais de sete dias descartada. Retentar apenas falha definitiva de aceitação; timeout, perda de confirmação ou lease expirado vão à revisão manual, não a reenvio automático. Chave idempotente estável por evento. Logs apenas agregados; sem endereços, tokens ou mensagens. Não há garantia de exactly-once entre banco e provedor; adapter escolhido deve oferecer idempotência quando disponível.
- Recuperação inclui três tabelas; manter canal global e worker desabilitados durante restauração e até revisão da fila, evitando reenvio de notificações de snapshot antigo.

## Aceite local
PC CQP-KAINA-72, C:\programacao\Educart. Sem GitHub Actions, sem novos pacotes.
Build aprovado; 85 testes Vitest e 5 testes Node do worker (transporte simulado). Doze migrations aplicadas com PGlite em memória e claims simuladas. Teste SQL: opt-in, canal desativado, eventos de pedido/decisão e retirada/devolução, duplicidade, permissões, claims, retry, opt-out e lease expirado. Navegador: 53 testes aprovados, 2 skips legados. Preferência mobile, status de canal desativado, caixa interna e regressão dos fluxos anteriores. Corrigido título da nova seção para evitar ambiguidade com o cabeçalho principal.

## Antes da ativação
1. Aprovar provedor, custo/cota, domínio remetente e tratamento de dados. Não compartilhar service role no frontend.
2. Implementar adapter server-side específico, timeout menor que lease e tratamento explícito de rejeição definitiva/aceitação incerta, idempotência e limite de volume. Usar segredos exclusivamente no ambiente servidor.
3. Homologar com Auth/PostgREST reais, concorrência real, recuperação da fila, envio para caixas de teste autorizadas, SPF/DKIM/DMARC, bounce e supressão, métricas agregadas e política de retenção/purga. Configurar agendador server-side autorizado; não depender de Actions nem da página aberta.
4. Habilitar globalmente somente após aceite; rollback desabilitando worker e canal, sem alterar avisos internos. Definir política sobre pendências durante desligamento, limpar/revisar fila antes de religar; resultado incerto exige revisão humana.
Não há integração SMTP/HTTP de provedor, agendamento ou envio real nesta entrega. Auditoria picomatch, integração #44–49 e homologação real continuam pendentes. Nenhuma alteração em produção. Próxima fase F4.1 — design system e coerência visual.

## Reprodução
npm.cmd test -- --run
node --test scripts/email-worker.test.mjs
npm.cmd run build
npm.cmd run test:e2e
node scripts/verificar-sql-local.mjs

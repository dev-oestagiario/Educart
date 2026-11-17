# Educart — Fase 7: notificações internas

**Escopo:** comunicação de estado entre o professor e a TI dentro do próprio Educart.  
**Branch:** `feat/fase-7-notificacoes-internas` · **Issue:** #17.  
**Dependência:** PR #16 (Fase 6), que depende das Fases 1 a 5.

## Fluxo e regra funcional

- Ao enviar um pedido (`CRIACAO`) a TI recebe aviso de nova solicitação, sem reservar equipamentos.
- Ao retirar um pedido (`DESISTENCIA`) a TI recebe aviso da retirada.
- Ao aprovar ou rejeitar (`APROVACAO` / `REJEICAO`) o professor autor recebe aviso; só a aprovação altera a capacidade, pela RPC transacional da Fase 6.
- Avisos são gerados pelo **mesmo evento SQL** gravado pelas RPCs e, portanto, não dependem de uma requisição adicional do navegador.
- Não há reenvio dos eventos históricos anteriores à migração, para evitar duplicações e surpresa ao usuário.
- Notificações são consultadas periodicamente a cada 30 segundos enquanto o usuário está no site. Não há serviço de e-mail, push, WebSocket ou envio em segundo plano nesta fase.

## Modelagem e segurança

Arquivo: `supabase/migrations/20261115220000_phase7_notifications.sql`.

A tabela `public.user_notifications` guarda destinatário do aviso, solicitação, evento gerador, categoria, título, corpo, leitura e criação. Existe uma chave única entre evento e destinatário para evitar repetição. Os campos de texto são **genéricos**, sem copiar notas, senhas, e-mails ou dados pessoais do professor.

- RLS: somente `recipient_user_id = auth.uid()` permite SELECT.
- `authenticated` tem apenas SELECT na tabela. Não há INSERT, UPDATE ou DELETE direto.
- `app_private.notify_request_event` é trigger privilegiado para notificações transacionais.
- `public.mark_notification_read(uuid)` marca apenas um aviso do próprio destinatário.
- `public.mark_all_notifications_read()` marca apenas os avisos não lidos da própria conta.
- Um professor não vê notificações de outros professores, e a TI não recebe cópias das decisões destinadas ao professor.
- As RPCs verificam identidade autenticada no banco e retornam informação mínima.

## Padrões front-end e UX

Planejamento conforme `.agents/skills/educart-frontend/SKILL.md`:

1. **Topo**: botão de sino com área de toque de 44px e contador visível de não lidas.
2. **TI**: item “Notificações” no menu lateral e sino no cabeçalho; cada aviso oferece “Abrir solicitações”.
3. **Professor**: sino no topo do portal e retorno para “Minhas solicitações”.
4. **Leitura**: avisos mais recentes primeiro, distinção visual e textual de “Nova”, data/hora, ações “Marcar como lida” e “Marcar todas como lidas”.
5. **Estados**: carregando, vazio, falha de rede e sucesso. Nenhuma indicação falsa de “zero” durante uma falha de consulta.
6. **Responsividade**: conteúdo sem overflow a 320, 360, 390, 768 e 1280px; ações acessíveis por teclado e rótulos ARIA no sino.
7. **Arquitetura**: `TanStack Query` para consultas compartilhadas, invalidação após mutação, carregamento sob demanda da página de avisos.

## Aceite técnico

- [x] Migração idempotente quanto a pares evento/destinatário no disparo por trigger, com RLS restrita.
- [x] Página compartilhada por ambos os perfis e sino com contador.
- [x] Testes unitários do contador e E2E com Supabase simulado de marcação e isolamento.
- [x] Compilação, 43 testes Vitest e 21 testes Playwright aprovados no PR #18. Publicação do commit final em validação.
- [x] Migração educart_phase7_notifications aplicada somente ao projeto Educart; RLS por destinatário verificada, SELECT somente para authenticated, sem grants de INSERT/UPDATE/DELETE ou SELECT anônimo; trigger ativado.
- [ ] Testes reais com pelo menos duas contas de professor distintas e uma conta administrativa, incluindo geração de evento pelas RPCs.
- [ ] Revisão visual e de teclado em celular físico e revisão do PR #18 antes de integração à main.

## Fora do escopo

Alertas por e-mail, WhatsApp ou push, configuração de preferências e horários de recebimento, notificações sobre cancelamento de reservas previamente confirmadas, histórico de leitura auditável por administrador e notificações retroativas.

## Verificações da entrega

- [CI com 43 testes unitários e 21 E2E](https://github.com/dev-oestagiario/Educart/actions/runs/43761765335).
- Supabase Educart: `user_notifications` tem `relrowsecurity=true` e política `recipient_user_id = auth.uid()`; sem acesso `anon`; sem mutações diretas de `authenticated`.
- Identidade autenticada não autorizada, em transação somente leitura, não enxergou notificações de terceiros.
- `mark_notification_read` é executável apenas por `authenticated` e verifica destinatário na RPC; o gatilho `reservation_request_event_notification` está ativo.
- O Security Advisor sinaliza RPCs intencionais `SECURITY DEFINER` e proteção contra senhas vazadas desativada: revisar os limites dessas funções e habilitar a proteção no Supabase antes da homologação de produção.
- Ainda pendente: criar eventos reais de solicitação/aprovação com duas contas de professor e uma da TI, conferir geração e isolamento das notificações sem compartilhamento de senhas, e validar a interface em dispositivo físico.

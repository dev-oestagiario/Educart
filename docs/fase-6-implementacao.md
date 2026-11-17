# Educart — Fase 6: solicitações dos professores

**Branch:** `feat/fase-6-portal-professores` · **PR:** #16 · **Issue:** #15  
**Dependências:** #10 → #11 → #12 → #13 → #14 → #16.

## Política aprovada para implementação

- **Solicitação pendente não ocupa capacidade.** Somente uma aprovação da TI cria a reserva.
- A função `review_teacher_request` chama `create_reservation` dentro da mesma transação PostgreSQL, preservando o bloqueio do carrinho e a verificação por data/turno.
- Se o carrinho ficou indisponível, a aprovação falha e o pedido permanece pendente. Não há aprovação parcial silenciosa.
- O professor pode retirar apenas pedidos pendentes. Reserva confirmada é gerenciada pela TI conforme as regras de edição/cancelamento das fases anteriores.
- A TI controla o vínculo entre a conta Supabase Auth com e-mail confirmado e um professor previamente cadastrado; contas novas não recebem permissão automaticamente.

## Esquema

Migração aditiva `supabase/migrations/20261115212000_phase6_teacher_requests.sql`:

- `teacher_account_links`: ligação autenticada e autorizada pela TI, com apenas um professor ativo por conta e um vínculo ativo por professor.
- `reservation_requests`: quantidade/modo/carrinho, datas e turnos, observações, mouse, status, reserva criada após aprovação e dados do revisor.
- `reservation_request_events`: eventos de criação, aprovação, rejeição e desistência, com autoria e horários.

Todas as tabelas possuem **RLS ativado** e **somente SELECT concedido** ao papel `authenticated`. Não há grants de INSERT/UPDATE/DELETE: todas as alterações acontecem por RPCs com verificação da identidade no servidor.

### RPCs

| Função | Autorização | Ação |
|---|---|---|
| `link_teacher_account` | TI | Vincular usuário verificado ao professor cadastrado |
| `unlink_teacher_account` | TI | Desativar vínculo |
| `list_teacher_accounts` | TI | Listar vínculos, nomes e e-mails |
| `submit_teacher_request` | Professor vinculado ativo | Enviar solicitação, sem reservar saldo |
| `review_teacher_request` | TI | Aprovar atomicamente ou rejeitar |
| `withdraw_teacher_request` | Autor do pedido pendente | Retirar pedido não aprovado |

Além disso, a RLS de `carts` permite ler apenas carrinhos **ativos** para professores autorizados; a de `requesters` permite ao professor ler **apenas seu próprio** cadastro.

## Front-end e UX

Baseado na skill local `.agents/skills/educart-frontend/SKILL.md`:

1. Login comum para TI e professores. Conta sem vínculo permanece na tela de autorização pendente.
2. Portal de professor com campos de quantidade ou carrinho completo, datas contínuas/avulsas de segunda a sexta, turnos, mouse, observações e prévia de quantos períodos serão solicitados.
3. Lista com histórico e status, permitindo desistência de pedido pendente somente após confirmação.
4. Painel de TI **Solicitações** com fila pendente, justificativa opcional, aprovação/rejeição e vinculação de contas.
5. Responsividade mobile, feedback explícito, navegação por teclado, sem compartilhar contas ou senhas.

## Testes de aceitação

- [x] Compilação TypeScript/Vite e 41 testes Vitest aprovados.
- [x] 18 testes Playwright com dados simulados: conta não autorizada, professor vinculado, solicitação, retirada, vínculo TI, aprovação e conflito com carrinho lotado.
- [x] Migração aplicada somente ao projeto **Educart** e advisor de RLS revisado.
- [ ] Testes de RLS com identidade simulada em transação read-only e, antes de produção, contas JWT reais em ambiente controlado.
- [x] Site publicado no GitHub Pages após CI.\n- [ ] Teste de aceitação em celular físico com contas reais.
- [ ] Fases 1–5 revisadas e integradas em ordem antes de mesclar o PR #16 à `main`.

## Observações importantes

- O cenário atual é de **uma instituição**. Multiunidade, notificações e regras de cancelamento pelo professor após aprovação permanecem fora de escopo.
- Ao mudar a capacidade ou cancelar reservas, os pedidos pendentes **não** ficam automaticamente aprovados.
- O vínculo é baseado no e-mail confirmado do Supabase Auth e é habilitado pela TI. O sistema não oferece escolha autodeclarada do identificador de professor.
- Atualizações de RLS e RPC devem ser avaliadas em ambiente de teste antes de habilitar o portal para uso geral.

## Verificações registradas em 15/11/2026

- GitHub Actions: [verificação aprovada](https://github.com/dev-oestagiario/Educart/actions/runs/43757640266) com 41 testes unitários e 18 cenários Playwright; [deploy aprovado](https://github.com/dev-oestagiario/Educart/actions/runs/43757635985).
- Supabase Educart: migração `educart_phase6_teacher_requests` aplicada e registrada. RLS habilitado nas 3 novas tabelas, cada uma com 2 políticas SELECT. Permissões diretas INSERT e UPDATE para `authenticated`: **não**.
- Consulta de autenticação em transação read-only: identidade sem autorização não foi reconhecida como administrador ou professor; identidade administrativa conhecida foi reconhecida como administradora. **As tabelas ainda estão vazias:** estes resultados não substituem testes de isolamento de dados entre dois professores reais.
- Security Advisor: alerta de funções `SECURITY DEFINER` invocáveis por `authenticated`; trata-se de RPCs intencionalmente expostas que possuem guarda de papel dentro das funções. Recomenda-se revisão de código e teste de acesso real antes de produção. Alerta pré-existente sobre [proteção contra senhas vazadas desabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Homologação pendente

1. Cadastrar contas de teste de **dois** professores com e-mails verificados, vinculá-las pela TI e confirmar isolamento RLS em sessões JWT reais.
2. Verificar aprovação concorrente de solicitações para o mesmo carrinho (bloqueio transacional) em ambiente controlado.
3. Verificar interface em celular real e habilitar proteção contra senhas comprometidas.
4. Revisar e integrar PRs #10–#16, sequencialmente, antes de liberar oficialmente a Fase 6 em produção.

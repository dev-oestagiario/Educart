# F1.1 — Auditoria RLS e privilégio mínimo

Data: 17/11/2026. Roadmap #33. Base: main após F0.

## Escopo e resultado
Verificar permissões reais do projeto Educart (sem enumerar dados pessoais), revisar políticas/RPCs e remover grants desnecessários. Não alterar regras de reserva, papéis, contas, dados ou consulta pública. Autenticação por JWT real e concorrência pertencem à homologação.

## Achados
- 12 tabelas públicas com RLS habilitado, nenhuma view exposta. Sem grant direto de leitura/escrita de tabelas ao anon.
- 24 políticas analisadas: admin via app_private.is_admin(); professor ativo lê carrinhos ativos, próprio solicitante/vínculo/solicitações/eventos; notificações restritas ao destinatário. Conta desvinculada pode ler o próprio vínculo e notificações antigas, se existirem; decidir política de retenção/revogação na F1/F2.
- As quatro tabelas de fundação tinham grants de DELETE, TRUNCATE, REFERENCES e TRIGGER ao authenticated, além dos grants necessários. admin_users também tinha INSERT/UPDATE, apesar de provisionamento restrito ao painel administrativo do banco. TRUNCATE não é filtrado por RLS; não há evidência de exploração ou endpoint REST direto para essa operação. Classificação: privilégio excessivo, corrigido.
- Três funções de trigger privadas tinham EXECUTE residual para anon/authenticated; não eram RPCs expostas. Correção: revogação.
- 14 RPCs públicas SECURITY DEFINER: 13 restritas a authenticated e uma para anon/authenticated (public_cart_availability). A última é intencional, retorna apenas agregados por carrinho/dia/turno, limita janela a 35 dias e não retorna solicitantes. Funções administrativas verificam is_admin; solicitações verificam vínculo ativo e, para retirada, propriedade da solicitação; notificações filtram auth.uid(). search_path vazio em todas as rotinas analisadas. Não mover ou revogar RPCs necessárias cegamente.
- Advisor após correção: 1 alerta de RPC anon, 14 de RPC authenticated (inclui a pública) e 1 de proteção de senha vazada desabilitada. Nenhum outro alerta retornado nessa execução. Alertas RPC permanecem para revisão contínua e testes E2E reais; senha vazada na F1.3.
- Sete migrations históricas registradas no remoto antes da correção, com timestamps diferentes dos nomes locais; reconciliar na F2.6 sem reaplicar migrations já realizadas.

## Mudança aplicada
Migration 20261117144930_educart_f1_1_least_privilege.sql, aplicada no projeto Educart e versionada com o timestamp real do registro remoto. Apenas ACL; não mudou RLS nem dados. Sem ambiente de homologação separado disponível nesta fase; a mudança é restrita aos privilégios que a aplicação não usa, com assertions transacionais. Preservados SELECT em admin_users; SELECT/INSERT/UPDATE em carts, requesters e notebook_codes; SELECT nas outras tabelas, com RLS. Escritas de reserva continuam via RPC. EXECUTE das funções de trigger revogado dos papéis API, mantendo triggers existentes.

## Matriz de autorização esperada
| Recurso | anon | sem vínculo | professor ativo | TI |
|---|---|---|---|---|
| Disponibilidade pública agregada | Sim | Sim | Sim | Sim |
| Catálogo de carrinhos | Não | Não | ativos | todos |
| Cadastro de solicitantes | Não | Não | próprio ativo | leitura e edição |
| Códigos/ reservas/ auditoria administrativa | Não | Não | Não | leitura; mutações por fluxos autorizados |
| Solicitações e seus eventos | Não | Não | próprias | todas |
| Notificações | Não | próprias se existirem | próprias | próprias |
| Vincular, revogar, aprovar/rejeitar | Não | Não | Não | RPC autorizada |
| Provisionar administradores via API | Não | Não | Não | Não (provisionamento privilegiado separado) |

## Evidências verificadas no banco
- Migration registrada; grants confirmados por information_schema; 3 rotinas privadas sem EXECUTE para anon/authenticated.
- Consultando como anon: 3 linhas agregadas, saldo válido; demais RPCs não executáveis por anon.
- Script supabase/tests/f1_1_rls_read_only.sql executado com sucesso em transação read-only/rollback: verifica RLS, ausência de grants anon, visibilidade zero nas 12 tabelas sob identidade simulada sem vínculo, rejeição da listagem de contas e leitura da autorização do admin ativo sob claims simuladas. Nenhuma informação pessoal retornada.
- Testes não usam JWT emitido pelo Auth nem simulação de sessões no navegador; não equivalem a autorização end-to-end.
- Ambiente consultado tem 1 admin ativo, 0 professores ativos vinculados, 0 solicitações e 0 notificações. Não é possível provar isolamento A/B com esses dados. Necessário ambiente de homologação com duas contas professor e uma TI, dados controlados e tokens reais. Não criar contas fictícias em produção.
- Conferir proteção de senha, dependências, limitação de abuso de RPC e política de revogação/retensão em F1.3/F1.4.
- Links: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [advisor anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [advisor authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [senha comprometida](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Aceite
- [x] Inventário de tabelas, grants, políticas e rotinas.
- [x] Remoção de privilégios excessivos e verificação SQL.
- [x] Smoke de disponibilidade pública e testes de leitura sem vínculo/admin simulado.
- [ ] JWT real e isolamento entre professores, teste de escrita autorizada e revogação de vínculo.
- [ ] Revisão de segurança completa da F1 e aceite em ambiente de homologação.

Próxima implementação: F1.2 — recuperação e redefinição de senha.
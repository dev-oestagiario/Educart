# Catálogo de migrations e atualização do schema

Uso exclusivo de mantenedores. Não há instalação ou configuração do banco pelo professor/administrador usuário. A fonte de verdade são os arquivos SQL versionados em [supabase/migrations](../supabase/migrations/). Ordem cronológica do repositório; a tabela não comprova quais migrations foram aplicadas em produção.

| Arquivo | Escopo |
|---|---|
| [20261115145429_educart_phase1_foundation.sql](../supabase/migrations/20261115145429_educart_phase1_foundation.sql) | Fundação Auth, cadastros, reservas e políticas |
| [20261115170352_phase2_reservations.sql](../supabase/migrations/20261115170352_phase2_reservations.sql) | Regras/RPCs de reserva e disponibilidade |
| [20261115172228_phase3_management.sql](../supabase/migrations/20261115172228_phase3_management.sql) | Gestão, edição e cancelamento |
| [20261115202313_educart_phase6_teacher_requests.sql](../supabase/migrations/20261115202313_educart_phase6_teacher_requests.sql) | Vínculos e solicitações de professores |
| [20261115210806_educart_phase7_notifications.sql](../supabase/migrations/20261115210806_educart_phase7_notifications.sql) | Notificações |
| [20261115214535_educart_phase8_teacher_availability.sql](../supabase/migrations/20261115214535_educart_phase8_teacher_availability.sql) | Prévia de disponibilidade do professor |
| [20261116134002_educart_public_cart_availability.sql](../supabase/migrations/20261116134002_educart_public_cart_availability.sql) | Consulta pública agregada |
| [20261117144930_educart_f1_1_least_privilege.sql](../supabase/migrations/20261117144930_educart_f1_1_least_privilege.sql) | Menor privilégio, RLS e grants |
| [20261117173000_educart_operational_locations.sql](../supabase/migrations/20261117173000_educart_operational_locations.sql) | Campus, blocos, salas, guarda e destino |
| [20261117174739_educart_maintenance.sql](../supabase/migrations/20261117174739_educart_maintenance.sql) | Janelas de manutenção e bloqueio de capacidade |
| [20261117180935_educart_equipment_movements.sql](../supabase/migrations/20261117180935_educart_equipment_movements.sql) | Retirada, devolução, condição e histórico |
| [20261117190439_educart_email_outbox.sql](../supabase/migrations/20261117190439_educart_email_outbox.sql) | Preferência e outbox de e-mail opcional |
| [20261117224356_educart_spatial_foundation.sql](../supabase/migrations/20261117224356_educart_spatial_foundation.sql) | Modelos/poses/slots, auditoria e RPCs 3D |

## Procedimento controlado
1. Confirmar projeto e versão do PostgreSQL, histórico de migrations e versão da CLI. Nunca presumir estado remoto pela branch. Não usar dados reais para desenvolvimento.
2. Conferir dependências, backup recuperável, plano de reversão e scripts em ambiente isolado segundo [F1.4](f1-4-homologacao.md) e [F6.1](f6-1-backup-recuperacao.md). Aprovar esquema, dados, FKs, funções, grants, RLS, índices e concorrência.
3. Validar instalação limpa e atualização a partir da versão realmente implantada. Executar casos da aplicação (admin/professor/anon/sem vínculo) e verificar contagens/invariantes. Os testes PGlite já existentes simulam claims; Auth e PostgREST precisam de stack completa.
4. Somente com autorização, aplicar em ordem as migrations pendentes pelo procedimento institucional e ferramenta compatível, em janela planejada. Registrar commits, histórico e resultado sem imprimir credenciais. Não executar reset destrutivo no remoto.
5. Conferir disponibilidade, reserva, manutenção, retirada/devolução, relatório e consulta pública. Se falhar, conter escritas, seguir runbook e usar migration corretiva ou restauração autorizada. Reverter frontend não desfaz alterações do banco.

## Evidências e limites
F5.6 e F6.1 aprovaram as 13 migrations em PGlite; não confirmam produção. Sem novas migrations na F6.3. A equipe deve repetir a homologação real e comparar histórico antes de F6.4.

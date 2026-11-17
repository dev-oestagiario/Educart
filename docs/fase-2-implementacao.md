# Fase 2 — Reserva e disponibilidade (implementação)

As reservas são registradas exclusivamente por **administradores ativos** por meio da função PostgreSQL transacional \`public.create_reservation\`.

## Regras

- Reserva completa ocupa toda a capacidade de cada data e turno, impedindo qualquer reserva concorrente no mesmo período.
- Reserva parcial ocupa a quantidade informada; outros professores podem usar o restante no mesmo turno.
- Apenas seg–sex (feriados continuam permitidos); intervalos excluem fins de semana; datas avulsas e turnos podem ser combinados.
- \`needs_mouse\` é apenas indicação logística.
- Códigos de notebooks podem ser selecionados quando conhecidos, mas não são obrigatórios para reservar a capacidade.
- A confirmação é **atômica**: um único conflito impede o registro de todo o conjunto.
- O bloqueio de linha do carrinho (\`SELECT ... FOR UPDATE\`) serializa confirmações para o mesmo carrinho, inclusive enquanto sua capacidade é alterada.
- Cada reserva grava cabeçalho, períodos, identificações opcionais e evento de criação.
- Para reduzir a capacidade, o trigger verifica tanto identificadores ativos quanto a maior ocupação em qualquer turno.
- Não é permitida a criação de reservas retroativas. Edição/cancelamento ficam para a Fase 3.

## Ordem de deploy

1. Aplicar \`supabase/migrations/20261115183000_phase2_reservations.sql\` no projeto Educart.
2. Conferir as quatro tabelas novas e as permissões RLS.
3. Publicar o front-end da branch \`feat/fase-2-reservas\`.
4. Validar concorrência, autorização real e fluxos ponta a ponta **antes** de integrar qualquer PR.

A Fase 2 é construída sobre a branch da Fase 1, que ainda possui PR em revisão. Não fazer merge direto na \`main\`.

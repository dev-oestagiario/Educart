# Educart — Fase 8: prévia de disponibilidade do professor

**Branch:** `feat/fase-8-disponibilidade-professores` · **Issue:** #19 · **Base:** Fase 7 / PR #18.

## Visão funcional

Uma pessoa autorizada como professor escolhe carrinho, datas e turnos no portal. A tela consulta o saldo dos períodos correspondentes e informa se a **quantidade solicitada** cabe no saldo **no momento da consulta**. A prévia não altera reservas e não garante aprovação futura; a decisão definitiva continua na Fase 6.

## Fonte da verdade

- **Capacidade = `carts.capacity`**, nunca a quantidade de códigos cadastrados.
- **Reservados = soma de `reservation_periods.quantity`** com mesmo carrinho, data e turno e `active=true`.
- **Disponíveis = máximo entre zero e capacidade menos reservados**.
- Solicitações com `status='PENDENTE'` não são `reservation_periods` e não comprometem capacidade.
- Reserva cancelada deixa `reservation_periods.active=false` e não é contabilizada.
- O professor não recebe o nome de quem reservou, e-mail, observações, códigos físicos ou identidade da reserva.

## Segurança e consultas

Arquivo `supabase/migrations/20261115233000_phase8_teacher_availability.sql` cria RPC `public.preview_teacher_availability(uuid,date[],text[])`:

1. Disponível apenas a contas autenticadas que sejam professor vinculado e ativo ou administrador autorizado.
2. Rejeita carrinho inativo, datas não úteis/passadas/duplicadas, turnos inválidos/duplicados e mais de 93 datas.
3. Retorna exclusivamente `usage_date`, `shift`, `capacity`, `reserved` e `remaining` por período.
4. É uma função **STABLE** e de leitura, não bloqueia a tabela nem executa INSERT, UPDATE ou DELETE.
5. O grant EXECUTE é exclusivo de `authenticated`; `anon` e `public` são revogados.

## Front-end

Componente `src/components/TeacherAvailabilityPreview.tsx` conforme a skill `.agents/skills/educart-frontend/SKILL.md`:

- Integração ao formulário existente sem criar outra etapa de solicitação.
- Requisição TanStack Query por carrinho, datas e turnos; expiração de cache em 15 s, atualização a cada 60 s enquanto aberto e revalidação em foco.
- Resumo visível por leitores de tela, aviso de períodos insuficientes e tabela expansível com todos os períodos.
- Estados de carregamento e erro. Se a prévia falhar, o botão de enviar pedido **permanece disponível**; nada é assumido sobre a ocupação.
- A faixa de datas continua limitada pelo formulário original; a API limita 93 dias úteis e três turnos.
- A lista de incompatibilidades destaca até oito datas antes da tabela expansível para não ocupar a tela inteira.
- Layout adaptado a celular com rolagem **interna apenas na tabela**, não na página.

## Critérios de aceite

- [x] RPC SQL de leitura e acesso por papel.
- [x] Prévia do saldo e detalhamento por dia/turno no portal do professor.
- [x] Testes unitários de cálculo, capacidades e consistência de dados.
- [x] Testes Playwright de saldo, dados agregados, pendências, falha de consulta e 360 px.
- [x] Build e 48 testes Vitest e 24 Playwright aprovados; GitHub Pages publicado após testes.
- [x] Migração `educart_phase8_teacher_availability` aplicada somente ao projeto Supabase Educart. `authenticated` pode executar; `anon` não.
- [ ] Homologação com professor/admin real, RLS e concorrência antes da integração em `main`.

## Limitações explícitas

A informação é **estimativa**. Se outro administrador confirmar uma reserva entre a prévia e a aprovação, a RPC `review_teacher_request` continua responsável por rejeitar ou permitir a operação atomicamente. Essa etapa não oferece garantia de disponibilidade, não fornece lista de professores com reserva e não modifica políticas de cancelamento.

## Evidências verificadas em 15/11/2026

- [CI: 48 testes unitários e 24 Playwright](https://github.com/dev-oestagiario/Educart/actions/runs/43765292926) — aprovado.
- [GitHub Pages: deploy após testes](https://github.com/dev-oestagiario/Educart/actions/runs/43765288021) — aprovado.
- No Supabase Educart, a migração `educart_phase8_teacher_availability` está aplicada.
- `has_function_privilege('authenticated', ..., 'EXECUTE') = true` e `has_function_privilege('anon', ..., 'EXECUTE') = false`.
- Em transação de leitura, o perfil administrativo reconhecido consultou a capacidade e o saldo sem consultar dados pessoais; uma identidade não vinculada recebeu erro SQL 42501 ('Conta não autorizada a consultar disponibilidade').
- Os testes E2E de fluxo usam backend simulado, e a consulta SQL usa perfil simulado: exigem homologação com JWT real de professor e confirmação posterior da reserva, antes do merge.

**Observação:** os dados agregados reais não são reproduzidos nesta documentação. Não foram alterados carrinhos, reservas, solicitações nem professores durante a auditoria SQL.

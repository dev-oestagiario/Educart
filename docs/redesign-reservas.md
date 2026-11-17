# Educart — Redesign da área de reservas

**Branch:** `feat/ux-reservas-calendario` · **Issue:** #21 · **Base:** `feat/fase-8-disponibilidade-professores`.

## Fluxo de trabalho para a TI

1. **Reservas:** a seção principal abre a listagem de reservas, não o formulário. Exibe pesquisador, filtro por situação (todas/confirmadas/canceladas), cards de reservas, ações de editar e cancelar.
2. **Nova reserva:** botão visível na parte superior. Abre uma página de formulário limpa, com botão **Voltar para reservas**.
3. **Editar reserva:** ação em cada item da lista. Preenche o formulário e permite alterar sem perder a identidade da reserva.
4. **Histórico:** botão **Ver histórico** na listagem. O histórico de auditoria está separado do cadastro. Há retorno para a lista.
5. **Após salvar:** retorno à lista com mensagem de confirmação; os dados são invalidados no TanStack Query.

## Calendário visual

- O campo de datas abre um popover semelhante ao seletor de passagens aéreas. Não existe combo box para escolher o tipo de data.
- Opções no próprio calendário: **Um dia**, **Período** (clique inicial e final), **Dias avulsos** (seleção/desseleção).
- Atalhos: **1 dia**, **1 semana** (7 dias corridos, selecionados somente dias úteis) e **1 mês** (mês de calendário a partir da data inicial).
- Fins de semana e dias passados aparecem desabilitados, mantendo feriados disponíveis.
- A mesma função `expandReservationDates` fornece os dias úteis para a reserva, respeitando 93 dias úteis por operação.
- Há descrição textual da escolha e controle por botões acessíveis. Escape fecha o calendário, e a seleção é navegável por teclado.
- No celular o calendário entra no fluxo do formulário, evitando popover cortado e rolagem horizontal.

## Campos condicionais

- **Carrinho completo:** reserva a capacidade configurada em cada turno, não exige nem mostra a seção de notebooks identificados.
- **Notebooks avulsos:** mostra quantidade e a seção opcional de códigos individuais. Códigos selecionados são apagados ao trocar para carrinho completo e não são enviados à RPC nesta modalidade.
- A consulta de disponibilidade permanece dentro do formulário em seção compacta expansível, sem os antigos cards laterais de gestão/histórico.

## Segurança e persistência

Essa mudança altera somente React/TypeScript/CSS/testes. **Não cria tabelas, não altera dados e não modifica RPCs ou RLS do Supabase**. A validação de capacidade, concorrência e dias úteis continua no banco.

## Critérios de aceite

- [x] A listagem é a tela inicial e permite buscar/filtrar as reservas.
- [x] Novas reservas e edições têm formulário dedicado e retorno à lista.
- [x] Calendário visual com dia, semana, mês e datas avulsas.
- [x] Seção de códigos condicional à modalidade notebooks avulsos.
- [x] Histórico separado do cadastro.
- [x] Testes Vitest da lógica de calendário e Playwright dos fluxos de gestão e mobile adicionados.
- [x] CI aprovado: 53 testes unitários e 26 Playwright; GitHub Pages publicado após testes. Capturas automáticas disponíveis no GitHub Actions.
- [ ] Revisão manual em celular físico e homologação com administrador real.
- [ ] Aprovação de PR e integração ordenada após as fases anteriores.

## Evidências

- [GitHub Actions — 53 testes unitários e 26 Playwright](https://github.com/dev-oestagiario/Educart/actions/runs/43767895853).
- [GitHub Pages — publicação após testes](https://github.com/dev-oestagiario/Educart/actions/runs/43767890438).
- Os Playwright usam Supabase simulado; fluxos reais com administrador e revisão visual em celular físico continuam pendentes.
- Migrações/RLS/RPCs não foram alteradas nesta revisão de interface.

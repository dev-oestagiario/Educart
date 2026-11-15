# Disponibilidade por data, turno e equipamento

Status: aceito

O Educart determinará conflitos de reserva considerando a identidade de cada notebook, cada data e cada turno (matutino, vespertino ou noturno). A mesma unidade não poderá pertencer a duas reservas ativas que compartilhem uma data e um turno; diferentes notebooks do mesmo carrinho poderão ser reservados simultaneamente, e um notebook poderá voltar a ser utilizado em outro turno sem conflito.

## Alternativas consideradas

- **Bloqueio do carrinho inteiro no mesmo dia:** simples, mas impede o aproveitamento dos notebooks não reservados e de turnos diferentes.
- **Verificação por notebook, data e turno (adotada):** respeita as reservas parciais e a seleção de vários turnos ou dias.

## Consequências

- Uma reserva de vários dias e/ou turnos deve ser validada em todas as combinações selecionadas antes de ser confirmada.
- A reserva completa somente é válida quando todos os notebooks daquele carrinho estiverem livres em todos os períodos solicitados; caso contrário, o administrador poderá escolher outro carrinho ou reservar apenas os equipamentos livres.
- A confirmação deve garantir exclusividade mesmo quando duas pessoas tentarem reservar simultaneamente; não basta conferir disponibilidade somente na interface.
- O cancelamento de uma reserva deve retirar o bloqueio dos equipamentos nos períodos correspondentes, preservando o registro histórico. O limite temporal para cancelamentos é tratado na especificação funcional.

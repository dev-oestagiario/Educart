# Disponibilidade por data, turno e equipamento

Status: aceito

O Educart determinará conflitos principalmente pela **capacidade configurada do carrinho, pela soma de quantidades reservadas e por cada data e turno** (matutino, vespertino ou noturno). Quando a reserva atribuir códigos individuais, o mesmo notebook identificado também não poderá ser atribuído a duas reservas ativas no mesmo período. Um carrinho pode ser compartilhado por vários professores enquanto o saldo for suficiente.

## Alternativas consideradas

- **Bloqueio do carrinho inteiro no mesmo dia:** simples, mas impede o aproveitamento dos notebooks não reservados e de turnos diferentes.
- **Verificação por capacidade e quantidades reservadas, data e turno (adotada):** respeita reservas parciais sem exigir cadastro prévio de todos os identificadores. A checagem de códigos individuais é adicional para notebooks efetivamente identificados.

## Consequências

- Uma reserva de vários dias e/ou turnos deve ser validada em todas as combinações selecionadas antes de ser confirmada.
- A reserva completa somente é válida quando a **quantidade reservada é zero** para o carrinho em todos os períodos solicitados; nesse caso, compromete toda a capacidade configurada. Caso contrário, o administrador poderá escolher outro carrinho ou reservar parcialmente a quantidade restante.
- A confirmação deve garantir de forma transacional que a **soma das quantidades reservadas não exceda a capacidade configurada**, mesmo com administradores operando simultaneamente, e que nenhum identificador conhecido seja reservado duas vezes no mesmo período; não basta conferir disponibilidade na interface.
- O cancelamento de uma reserva deve retirar o bloqueio dos equipamentos nos períodos correspondentes, preservando o registro histórico. O limite temporal para cancelamentos é tratado na especificação funcional.

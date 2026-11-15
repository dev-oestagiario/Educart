# Educart

Vocabulário do domínio de empréstimo e reserva de equipamentos de informática da instituição. Os termos abaixo descrevem conceitos do negócio, sem estabelecer tecnologias ou regras de implementação.

## Pessoas

**Solicitante**:
Pessoa que pede a utilização de equipamentos, normalmente um professor, e que fica identificada como responsável pela reserva.
_Avoid_: Registrante; "responsável" sem qualificação.

**Administrador**:
Professor da equipe de TI autorizado a registrar, gerenciar e cancelar reservas em nome dos solicitantes.

**Registrante**:
Administrador que efetivamente cadastra uma reserva no Educart; pode ser uma pessoa diferente do solicitante.
_Avoid_: Solicitante.

## Equipamentos

**Laboratório móvel**:
Conjunto móvel de notebooks organizado em um carrinho identificado, que pode ser reservado por inteiro ou ter seus notebooks reservados separadamente.
_Avoid_: "laboratório" isolado, que pode significar um espaço físico.

**Identificador do laboratório móvel**:
Referência que distingue um carrinho dos demais na instituição.

**Notebook**:
Equipamento individual associado a um laboratório móvel, passível de reserva específica ou como parte da reserva completa do laboratório.

**Identificador do notebook**:
Referência individual que permite distinguir e selecionar um notebook específico para uma reserva.

**Capacidade do laboratório móvel**:
Quantidade total de notebooks definida para um laboratório móvel, independentemente de quantos equipamentos tenham identificadores individuais cadastrados.

**Mouse**:
Acessório opcional solicitado junto ao uso do laboratório móvel ou de notebooks, cuja necessidade é registrada separadamente dos notebooks.

## Reservas

**Reserva**:
Registro da utilização prevista de um laboratório móvel completo ou de notebooks selecionados, associado a um solicitante, a uma ou mais datas e a um ou mais turnos.

**Reserva completa**:
Reserva de todos os notebooks que compõem um laboratório móvel para os períodos selecionados.
_Avoid_: Reserva parcial.

**Reserva parcial**:
Reserva de apenas parte dos notebooks de um laboratório móvel, com seleção dos identificadores dos equipamentos utilizados.
_Avoid_: Reserva completa.

**Turno**:
Faixa escolar de utilização indicada como matutino, vespertino ou noturno; uma reserva pode abranger mais de um turno na mesma data.

**Disponibilidade**:
Condição de um notebook ou laboratório móvel para determinada data e turno, considerando os equipamentos já comprometidos por outras reservas.

**Cancelamento**:
Encerramento de uma reserva antes de sua utilização, fazendo com que seus equipamentos deixem de estar comprometidos nos períodos correspondentes.

**Observação da reserva**:
Informação complementar registrada pelo administrador para contextualizar a utilização dos equipamentos.

**Solicitação de reserva**:
Pedido iniciado pelo próprio usuário para análise de um administrador, distinto da reserva já registrada e efetivada; previsto para uma etapa futura do Educart.

# Notebooks identificados individualmente nas reservas

Status: aceito

O Educart permitirá rastrear notebooks por identificador e pela associação a um laboratório móvel, mas **os códigos individuais não determinam a quantidade disponível**. A capacidade configurada do carrinho é o total reservável; as quantidades de reservas ativas são descontadas desse total por data e turno. Os identificadores dos equipamentos efetivamente atribuídos são registrados para rastreabilidade, sem exigir cadastro prévio de todos os códigos.

## Alternativas consideradas

- **Controle somente por quantidade por carrinho:** mais simples de cadastrar, mas não identifica quais notebooks foram separados.
- **Identificação individual combinada com controle de capacidade por quantidade (adotado):** mantém rastreabilidade dos códigos conhecidos sem obrigar o cadastro individual de toda a capacidade antes de permitir reservas.

## Consequências

- Reservas parciais informam quantidade e identificadores dos notebooks selecionados.
- Reservas completas ocupam toda a **capacidade numérica configurada** do laboratório móvel para o período reservado.
- O identificador pode ser um código próprio da equipe de TI, não necessariamente um número de patrimônio. O cadastro admite informação manual, importação de planilha ou geração automática com edição antes de salvar; em todos os casos, os códigos precisam ser únicos.
- A capacidade do carrinho pode ser maior que a contagem de identificadores cadastrados; isso **não reduz o saldo de disponibilidade**. Quando houver códigos associados a reservas, impedir atribuição duplicada do mesmo código na mesma data e turno. O procedimento para identificar equipamentos cujo código ainda não foi registrado será detalhado no fluxo de separação.

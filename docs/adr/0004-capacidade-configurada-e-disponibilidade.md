# Capacidade configurada como fonte da disponibilidade

Status: aceito

No Educart, **a quantidade cadastrada no laboratório móvel é sua capacidade reservável por data e turno**, mesmo quando nem todos os notebooks tiverem identificadores individuais cadastrados. O saldo disponível é **capacidade configurada menos a soma das quantidades em reservas ativas** daquele carrinho, data e turno. A identificação individual é usada para rastrear os notebooks conhecidos e impedir que o mesmo código seja atribuído a duas reservas no mesmo período, mas **não reduz o estoque disponível** por faltar códigos no catálogo.

## Alternativas consideradas

- **Capacidade derivada da contagem de notebooks com código cadastrado (rejeitada):** obrigaria o administrador a cadastrar individualmente todos os notebooks antes de poder reservar a capacidade declarada.
- **Capacidade configurada com reservas por quantidade (adotada):** reflete a regra operacional da equipe de TI e permite registrar códigos individuais quando conhecidos, sem impedir reservas pelo cadastro incompleto.

## Consequências

- Um carrinho com capacidade **30**, **28 códigos individuais** cadastrados e nenhuma reserva tem **30 notebooks disponíveis**.
- Ao registrar reserva parcial de **10** no período matutino, o saldo desse período passa a **20**, independentemente de quantos códigos estão cadastrados.
- Reserva completa ocupa a capacidade **30** e exige disponibilidade total no período.
- A confirmação deve validar de modo transacional que a soma das quantidades reservadas nunca ultrapasse a capacidade. Identificadores informados também não podem conflitar no mesmo período.
- A visualização 3D pode representar a capacidade por 30 posições, sem inventar códigos físicos para posições sem identificação cadastrada.
- A identificação de notebooks ainda sem código registrado durante a separação física continua sendo um detalhe de fluxo a esclarecer.

Esta decisão complementa a [ADR 0001](0001-notebooks-identificados-individualmente.md) e ajusta a interpretação da disponibilidade descrita na [ADR 0002](0002-disponibilidade-por-data-turno-e-equipamento.md).

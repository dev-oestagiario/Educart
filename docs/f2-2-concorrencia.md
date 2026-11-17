# F2.2 — Homologação da concorrência de reservas

## Escopo
A F2.1 foi aprovada no run 44125438728, incluindo os testes de cadastros, CSV/XLSX, reservas, edição/cancelamento e auditoria em Chromium com Supabase local. PR #39 integrado em main (fc43413).
A F2.2 avalia integridade sob operações concorrentes, utilizando exclusivamente stack descartável e quatro contas Auth sintéticas: dois administradores e dois professores. Nenhuma alteração de dados, permissões ou migrations de produção.

## Casos de teste
| ID | Disputa | Resultado exigido |
|---|---|---|
| F22-01 | Duas reservas de 6 para capacidade 10 | Uma confirma; outra falha; saldo 4 |
| F22-02 | Reservas completas em turnos independentes | Ambas confirmam |
| F22-03 | Grupo de dois dias e reserva conflitante no segundo dia | Apenas uma operação confirma; nenhuma gravação parcial |
| F22-04 | Edição simultânea de duas reservas de 3 para 7 | Uma edição confirma; total 10 |
| F22-05 | Edição de 4 para 7 versus criação de 4 | Somente uma confirma; estado anterior preservado na falha |
| F22-06 | Redução de capacidade de 10 para 5 versus reserva de 6 | Uma operação confirma; capacidade nunca abaixo da ocupação |
| F22-07 | Dois códigos iguais, variando maiúsculas | Código único; uma inserção rejeitada |
| F22-08 | Dois códigos distintos para capacidade 1 | Apenas um código registrado |
| F22-09 | Mesmo notebook em duas reservas, com saldo numérico restante | Uma atribuição ativa |
| F22-10 | Aprovação de dois pedidos incompatíveis | Uma aprovada; outra permanece pendente, sem reserva parcial |
| F22-11 | Dois administradores aprovam o mesmo pedido | Uma reserva, um evento de aprovação e uma notificação ao professor |

Cada cenário executado três vezes, totalizando 33 pares (66 operações submetidas simultaneamente), além das consultas e preparações de dados. Validação de saldos públicos versus períodos ativos, cabeçalhos, eventos e notificações. As falhas precisam ser de negócio/constraint, não arbitrariamente erros de rede. Não dependemos da ordem em que cada operação ganha a disputa.

## Execução
Com o Supabase local F1.4 iniciado: `node scripts/homologacao-concorrencia.mjs`. A suíte recebe exclusivamente o status JSON do stack local, valida loopback, cria dados exclusivos e usa credencial privilegiada somente para criar contas e provisionar os administradores. As operações testadas passam pela API com JWTs dos respectivos usuários.

A CI adiciona esta etapa após as suítes F1.4/F2.1, mantendo os testes unitários, browser simulado e browser real. Sem benchmark de throughput nem garantia formal de ausência de todas as condições de corrida: a submissão paralela não mede a sobreposição exata dentro do servidor. Testes de carga e latência de produção permanecem fora deste escopo.

## Aceite
- Todos os 33 pares devem apresentar os resultados exigidos.
- Nenhum saldo negativo, operação parcial, dupla atribuição ou duplicidade de aprovação.
- Testes anteriores continuam aprovados.
- Merge condicionado à CI. Se houver falha, investigar e corrigir em branch antes da integração.
- Próxima fase: F2.3 — professores, TI e notificações.

# F2.1 — Homologação dos cadastros e reservas

## Escopo
A F1.4 foi confirmada no run 44121530023: quatro identidades de Auth real, isolamento entre professores, saldo, notificações e revogação. PR #38 integrado em main (fa3218f).
Nesta fase, ampliar a verificação de negócio no mesmo Supabase local descartável. Nenhum dado real, sem migração remota. As regras vigentes são referência; concorrência simultânea será tratada na F2.2.

## Casos de teste
| ID | Cenário | Aceite |
|---|---|---|
| F21-01 | TI autenticada cadastra e edita carrinho e solicitante | Dados persistidos e consistentes |
| F21-02 | Código/referência duplicados e capacidade zero | Rejeição pela constraint |
| F21-03 | Cadastro em lote de códigos | Todos persistidos |
| F21-04 | Lote duplicado ou acima da capacidade | Nenhum item parcial persistido |
| F21-05 | Reduzir capacidade abaixo dos códigos | Bloqueado |
| F21-06 | Capacidade maior que quantidade identificada | Saldo usa capacidade nominal |
| F21-07 | Reserva inválida (datas, turnos, quantidade, códigos) | Rejeitada sem cabeçalho |
| F21-08 | Carrinho ou solicitante inativo | Reserva bloqueada |
| F21-09 | Reserva parcial em duas datas e dois turnos | Quatro períodos e saldo correto |
| F21-10 | Conflito em parte do grupo e notebook já associado | Grupo rejeitado; saldo inalterado |
| F21-11 | Reduzir capacidade abaixo da ocupação | Bloqueado |
| F21-12 | Reserva completa sem códigos físicos | Saldo zero no turno |
| F21-13 | Edição com conflito | Reserva e períodos anteriores preservados |
| F21-14 | Edição válida | Saldo e períodos atualizados |
| F21-15 | Cancelamento parcial e total | Saldo liberado, status correto, histórico preservado |
| F21-16 | Auditoria | Autor e eventos de criação, edição e cancelamento |
| F21-17 | Reserva no dia atual | Edição que preserva data aceita, cancelamento proibido (somente dia útil) |

## Execução
`node scripts/homologacao-cadastros-reservas.mjs` após iniciar o stack local descrito em f1-4-homologacao.md. A CI homologacao.yml roda a suíte real em conjunto com a F1.4. Os casos criam dados sintéticos com identificadores exclusivos e não dependem de credenciais institucionais.

A suíte scripts/homologacao-browser.mjs roda Chromium sem mock contra Vite em modo homologacao e Supabase local: login, cadastros, importação CSV e XLSX com revisão de prévia, persistência de códigos, criação/edição/cancelamento de reserva e consulta de auditoria. Confere os registros também pela API autenticada. Executar primeiro em stack local limpo; o runner começa com banco descartável. Instalar Chromium previamente. O script restringe as requisições de navegador à aplicação e ao backend locais; senhas e chaves não são registradas. A suíte de banco verifica também a atomicidade da inserção em lote. Não afirmar homologação institucional ou utilização de dados reais.

## Pendências / próximo passo
CI aprovada no run 44125438728 (job 134187937632), incluindo navegador real, 17 cenários principais de banco e regras do próprio dia. PR #39 integrado em main. F2.2: concorrência simultânea de criação, edição, aprovação e capacidade com JWTs reais. F2.3: fluxos adicionais do professor e recuperação de senha. F2.4: impressão/PDF, F2.5: dispositivos reais, F2.6: restauração e migrations.

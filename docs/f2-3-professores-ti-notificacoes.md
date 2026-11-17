# F2.3 — Homologação dos professores, TI e notificações

## Escopo
F2.2 aprovada no run 44126463029, job 134191508645: 33 pares concorrentes, sem sobre-reserva nem gravação parcial. PR #40 integrado em main (16d290b).
A F2.3 complementa as suites anteriores com um fluxo de Chromium sem backend simulado, usando Supabase local, contas sintéticas e sessões separadas de TI, professor A e professor B. Uma quarta conta não confirmada serve ao teste de vinculação. Nenhum dado institucional é copiado.

## Casos e aceite
| ID | Cenário | Resultado exigido |
|---|---|---|
| F23-01 | Conta confirmada sem vínculo | Acesso aguardando autorização; prévia privada negada |
| F23-02 | Conta sem e-mail confirmado | Vinculação rejeitada |
| F23-03 | TI vincula A/B no navegador | Cada professor acessa seu portal, sem funções administrativas |
| F23-04 | Prévia e carrinho inativo | Apenas ativos; saldo agregado sem detalhes privados |
| F23-05 | Dois pedidos para mesmo turno | Pendências não consomem saldo; TI recebe dois avisos próprios |
| F23-06 | Isolamento | Cada professor lê somente pedidos/eventos próprios e não altera pedido alheio |
| F23-07 | Avisos TI | Leitura individual e em lote, contador atualizado e acesso à fila |
| F23-08 | Aprovação A | Reserva de 6, mouse e observação preservados; saldo 4 de 10 |
| F23-09 | Aprovação B sem capacidade | Rejeição pela RPC, pedido ainda pendente e sem reserva |
| F23-10 | Rejeição B com justificativa | Saldo inalterado, ausência de reserva e decisão no portal |
| F23-11 | Avisos dos professores | A só vê aprovação; B só vê rejeição; leitura persistida e aviso alheio protegido |
| F23-12 | Retirada do pedido B | Status desistência, notificação TI, saldo intacto |
| F23-13 | Revogar B pela TI | Token anterior não pode ler pedidos nem criar novos; após recarga retorna à autorização |
| F23-14 | Interface de professores em 390px | Sem overflow horizontal no fluxo de avisos |

## Execução
No stack Supabase local iniciado, com Chromium instalado: `node scripts/homologacao-professores.mjs`. O script rejeita endpoints remotos, inicia Vite no modo homologacao em loopback, restringe requisições de navegador ao app/backend local, gera credenciais aleatórias em memória, usa chave privilegiada local somente para criar contas e provisionar TI. Cada perfil tem seu próprio contexto de navegador e sua sessão independente de Auth para verificação via PostgREST/RPC. A CI executa a suíte após as anteriores, encerra o servidor e descarta o banco.

## Limites
Os testes incluem recarga para obter mudanças entre sessões; não provam entrega instantânea nem polling durante toda a sessão. A política atual admite leitura de avisos antigos pelo destinatário após revogar vínculo; não altera essa regra. Não testar contra produção, não registrar tokens/senhas. A conta não confirmada é criada sem confirmação pelo administrador local; isso não é um teste de recebimento de e-mail. Recuperação por e-mail, redirect/SMTP hospedado, aceite institucional e dispositivos físicos permanecem pendentes. Próxima etapa F2.4: relatórios e impressão. Merge condicionado à aprovação da CI.

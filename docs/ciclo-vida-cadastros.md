# Feedback e ciclo de vida dos cadastros

- Operações exibem toasts no canto inferior direito, fora do layout. Sucesso expira após 6,5 segundos; avisos e erros podem ser fechados pelo usuário. Indicadores de carregamento e instruções permanentes continuam no contexto da tela.
- Carrinhos, professores, notebooks, campus, blocos e salas: inativação lógica, com confirmação e reativação. Listagem inicial mostra ativos; situação Inativos/Todos recupera registros históricos. Códigos e identificadores permanecem únicos.
- Carrinhos e professores não podem ser inativados com reservas atuais/futuras, solicitações pendentes ou equipamentos pendentes de devolução; manutenção vigente/futura também bloqueia o carrinho. Notebook com atribuição atual/futura ou retirada pendente não pode ser inativado. O banco verifica essas regras; a UI não apaga linhas.
- O cadastro de locais continua preservando referências históricas: inativar campus/bloco restringe novas escolhas dos descendentes conforme a hierarquia. Remover local de guarda significa editar a associação para Não informada.
- Reservas, solicitações, manutenções e devoluções preservam seus fluxos existentes de cancelamento, retirada de pedido, encerramento e devolução. Não excluir eventos históricos, autorizações ou movimentações como se fossem cadastros.
- A migration catalog_lifecycle deve ser homologada em ambiente isolado e aplicada somente na promoção aprovada à produção. Nenhum DELETE novo, ampliação de grants ou RPC pública.

# F4.4 — Revisão dos fluxos completos e desempenho

## Diagnóstico e implementação
- Reservas: a listagem carregava todos os períodos históricos independentemente da página de reservas. Agora consulta períodos dos IDs carregados, em lotes de 50 IDs e páginas de 250 linhas, com ordenação estável e agrupamento em Map. Não consulta períodos quando não há reservas ou quando histórico está aberto. A busca continua limitada às reservas carregadas; indicação explícita e botão de carregar mais. Não redesenhar busca global nesta fase.
- Formulário: códigos são consultados somente na modalidade parcial para o carrinho selecionado; prévia de disponibilidade e manutenção só no formulário. Paginação de catálogos elimina truncamento e preserva chaves distintas de cache. Limite visual de códigos selecionados, aviso se quantidade reduzida, bloqueio de confirmação com consultas críticas em erro ou pendentes. Revalida datas no envio, data de Brasília recalculada na renderização. Guard de envio e retorno enquanto salva, sem substituir atomicidade do servidor.
- Professor/TI: os limites de 100/200 pedidos podiam ocultar pendências antigas. Consultas paginadas, listagem incremental em 50 itens, contagem total; cadastro de contas usa professores ativos, mas pedidos históricos conservam nomes de inativos. Corrige contagens falsas após falha. Preview do professor continua informativa: não ocupa capacidade nem bloqueia solicitação por falta de saldo.
- Cache: invalidateReservationViews centraliza chaves explícitas; invalida reservas, períodos, histórico, relatórios, dashboard, movimentações planejadas e prévia docente após salvar/cancelar/aprovar. Corrige chave ['calendar-'] que não correspondia aos recortes reais.
- Relatórios: mapas de professor/carrinho/admin e agrupamento por data evitam buscas repetidas; detecção de reserva referenciada mas ausente bloqueia totais e exportação. Atualização manual e bloqueio durante refetch; dados ausentes não representados como zero. CSV/PDF continuam usando o recorte selecionado e os formatos anteriores.
- Sem dependências novas, sem migration. Manter lazy loading existente; não alterar arbitrariamente estratégia de chunks. Evidências de desempenho são escopo de consultas e volume renderizado, não benchmark de latência de produção.

## Validação local
PC CQP-KAINA-72, C:\programacao\Educart; sem GitHub Actions.
- Três novos testes unitários: paginação, falha em página intermediária e invalidação de cache.
- Quatro novos E2E: 251 pedidos com pendência antiga; recorte incompleto bloqueia CSV/PDF e atualização recupera; aprovação invalida calendário e dashboard; requisições de períodos por ID e códigos sob demanda.
- Mock PostgREST ampliado para paginação, filtros por ID e relações de reserva; cenário de integração inicialmente não reproduzia join real, corrigido no fixture. Testes de regressão pré-existentes incluem fluxos de TI/professor, cancelamento, recorrência, relatórios, acessibilidade e consulta pública.
- Build aprovado; 88 testes Vitest, 5 testes Node worker, 63 Playwright aprovados e 2 skips legados de 3D. Regressão integral final passou no PC; 38 auditorias axe nas configurações avaliadas continuam sem violações reportadas.

## Pendências / limites
F4 implementada localmente, aceite de produção ainda não concluído. Validação com Supabase real, concorrência, impressora, leitores de tela/dispositivos físicos e integração dos PRs anteriores pendentes. Auditoria picomatch anterior continua como gate de release. Sem benchmark de tempo de resposta em produção; busca de reservas considera páginas carregadas, listas de pedidos carregam todos os dados em páginas antes da renderização incremental, e relatório não é snapshot transacional. Não alterado banco remoto.
Próxima F5.0 — especificação visual, referências autorizadas, protótipo de cena multi-carrinhos e orçamento de desempenho.

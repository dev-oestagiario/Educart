# F3.4 — Dashboard operacional

## Especificação
Transformar a tela Visão geral em um painel administrativo de trabalho, sem misturar disponibilidade planejada com custódia física registrada. Reutilizar as tabelas das fases anteriores e suas políticas RLS, sem nova migration ou escrita no banco.

## Entrega
- Seis indicadores: períodos confirmados de hoje, aguardando retirada, pendentes de devolução (inclusive datas anteriores), devolvidas relativas à agenda de hoje, janelas de manutenção de hoje e solicitações pendentes.
- Agenda de hoje com estado de retirada/devolução, professor, carrinho, turno, quantidade e destino da reserva quando informado. Próximas utilizações ordenadas cronologicamente, com horizonte padrão de 7 dias (alternativas 14 e 30).
- Listas de devoluções pendentes, manutenção vigente/programada e fila de solicitações. Cinco itens iniciais por seção, com expansão para todos. Atalhos para os módulos existentes, mantendo a navegação administrativa.
- Filtros de carrinho e turno nas listas operacionais. O horizonte afeta somente próximas utilizações e manutenção; não oculta solicitações pendentes ou equipamentos ainda sob custódia. Indicadores de cadastro: capacidade nominal dos carrinhos ativos, carrinhos cadastrados, notebooks identificados e total geral de professores; o turno não altera totais cadastrais.
- Consultas paginadas (250 linhas, ordenação estável), campos mínimos para movimentações e manutenção, união deduplicada entre registros de hoje e pendências antigas. Não carregar responsáveis e motivos internos desnecessários.
- Atualização manual e refetch a cada minuto com a janela em foco, horário da consulta, recomputação da data em Brasília. Erro explícito; não substituir falha por contagem zero. Se houver cache anterior, sinalizar que os valores são da última consulta.
- Layout responsivo, tokens claro/escuro existentes e alvos touch. Sem rastreamento em tempo real ou alteração das regras de reserva.

## Validação
No PC CQP-KAINA-72, pasta C:\programacao\Educart. Node/npm e Playwright locais, sem execução de GitHub Actions.
- Testes unitários: quatro novos casos de filtros, datas, estados de movimentação, pendências antigas, manutenção encerrada e capacidade nominal.
- Dois testes novos de navegador: indicadores, filtros, navegação e ausência de overflow horizontal em 320/390/1280 px; falha de API e atualização.
- Build aprovado, 78 testes unitários e 49 Playwright aprovados (2 skips legados). Regressão com backend simulado. Ajustados seletores acessíveis, fixture de movimentação e estado hover no teste legado do menu; a reexecução integral passou. Homologação com Supabase real ainda pendente (Docker/WSL indisponíveis no PC). Não aplicar migrations nem publicar versão em produção.
- As consultas do painel não formam uma transação de snapshot; atualização simultânea pode produzir pequena divergência temporária entre listas. O painel não autoriza ou bloqueia operações: as RPCs de negócio continuam sendo a fonte de validação.
- Sem novos pacotes. Gate de auditoria picomatch anterior e integração dos PRs empilhados continuam pendentes.

## Reprodução
`npm.cmd test -- --run`, `npm.cmd run build`, `npm.cmd run test:e2e`. Próxima F3.5: reservas recorrentes (padrão semanal e término).

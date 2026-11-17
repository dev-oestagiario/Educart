# F4.2 — Padronização de cadastros e navegação

## Especificação e decisões
Aplicar às telas operacionais recentes o fluxo listagem → detalhes → formulário. Preservar a navegação principal e as rotas de consulta pública/recuperação de senha existentes. As subtelas utilizam estado local do módulo, assim como os cadastros atuais; não introduzir links profundos ou histórico próprio no navegador. Os dados e as permissões permanecem nas RPCs/tabelas existentes. Não duplicar ações custódia/encerramento na listagem.

## Implementação
- Componente RecordTrail para caminho de navegação, RecordDetail com foco programático no título e DetailFields com lista semântica de descrição. Layout usa tokens F4.1 e quebra de texto nos detalhes, uma coluna em mobile.
- Localizações: listagem por campus/blocos/salas/local de guarda, busca e situação, detalhe com hierarquia e disponibilidade efetiva da sala, edição e cadastro separados. Local de guarda passa a listar carrinhos e associação atual; alteração em formulário específico, preserva seleção de sala ativa/inativa existente e regras atuais. Consulta paginada de vínculos. Ao cancelar edição volta aos detalhes sem salvar; ao salvar, atualiza listagem e detalhes. Cadastro novo retorna à lista.
- Manutenção: busca por carrinho/motivo e filtro de situação, resumo de janelas e detalhe com motivo e encerramento. Encerramento em formulário próprio, cancela para detalhe; estado atualizado após persistência. Não oferece edição/exclusão de histórico.
- Movimentações: filtros Hoje/Pendentes/Histórico, busca por carrinho/solicitante, detalhe da reserva aguardando retirada ou movimentação registrada (inclui condições, responsáveis, códigos e observações); formulários separados de retirada/devolução. Cancela para detalhe e confirma para recorte da listagem anterior, inclusive retorno de data anterior que deixa de estar pendente.
- Preserva filtros e recorte ao navegar de volta dentro do módulo; limpa busca quando muda a categoria de localização. Ações de retorno/edição bloqueadas durante as mutations; nenhuma mudança nas regras de negócio. A consulta pública mantém dia inicial e data final opcional, inclusive limpeza da data final e retorno à consulta de dia único.

## Validação local
PC CQP-KAINA-72, C:\programacao\Educart. Build aprovado, 85 testes Vitest e 5 worker. Quatro testes Playwright direcionados aprovados (manutenção, movimentações, F4.1, fluxo localizações: busca, navegação, cancelamento sem persistência, vínculo de guarda, 320/390/768/1440 px).
Regressão integral: 55 Playwright aprovados, 2 skips legados do 3D, executada localmente sem GitHub Actions (inclui consulta pública e seus filtros). Testes com backend simulado; sem alteração de produção, sem novos pacotes ou migrations. Auditoria completa de teclado/leitor de tela/zoom e dispositivos físicos permanece para F4.3. Integração dos PRs anteriores, auditoria picomatch e homologação Supabase real continuam pendentes.
Próxima: F4.3 — acessibilidade e responsividade.

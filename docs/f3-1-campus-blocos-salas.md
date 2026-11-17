# F3.1 — Campus, blocos e salas

## Constituição / especificação
Organizar um catálogo administrativo de ambientes para múltiplos campi. Local de guarda cadastral do carrinho é independente da sala de utilização de uma reserva. Não representar telemetria, rastreamento ou localização em tempo real. Não publicar planta, coordenadas internas, guarda de equipamentos ou detalhes reais de infraestrutura. As duas unidades SENAI Cascavel poderão ser cadastradas pela TI autorizada; nenhuma sala ou planta real é presumida. Modelagem 3D fica para F5.

## Implementação
- Novo menu Localizações, abas Campus, Blocos, Salas e Local de guarda. Cadastro, edição, listagem e desativação; sem exclusão física. Unicidade de nomes sem distinguir caixa por hierarquia, FKs e status efetivo nos três níveis.
- Quatro tabelas novas com RLS e menor privilégio: somente TI lê/escreve, sem DELETE/TRUNCATE. Guarda em tabela independente, não incorporada ao catálogo de carrinhos acessível aos professores. Nenhum dado espacial no RPC público.
- Sala de utilização opcional na criação/edição de reserva e na aprovação pela TI. Três RPCs compatíveis com APIs anteriores, verificando autorização admin e destino ativo, executando operação original e persistindo snapshot do nome do destino/auditoria na mesma transação. Sem alteração da regra de capacidade nem reserva de sala como recurso exclusivo. Edições que mantêm a sala preservam o rótulo histórico; novo destino exige hierarquia ativa. Sem sala, continua API original.
- Relatório PDF e CSV incluem sala de utilização. Reservas históricas sem destino mantêm Não informada. Não confundir destino com local de guarda. Professores não recebem o catálogo interno de localizações nesta entrega; seleção é atribuída pela TI.
- Migration aditiva 20261117173000_educart_operational_locations.sql (CLI não disponível no ambiente de edição; arquivo versionado manualmente, sujeito à execução em CI). Não aplicada na produção. Antes do merge e deploy, validar recuperação, CI, segurança e aplicar somente a nova migration de forma controlada após backup autorizado. Alterações em schema não dependem de plantas.
- Suite local de recuperação ampliada para contemplar as quatro tabelas novas. Testes unitários de seleção de salas e PDF/CSV, e script de homologação local real para cadastro, isolamento, unicidade, guarda versus destino, inativação, histórico, edição, aprovação e saldo agregado. Testes de interface completos do novo módulo ainda necessários.

## Dependências anteriores
F2.5 (#43) integrada na main no commit 0711bce: cinco perfis aprovados no run 44134426833, dispositivos físicos pendentes.
F2.6 (#44), recuperação aprovada no run 44135919621 após ajuste de restauração: 14 tabelas verificadas, tempo local 42 s. CI de homologação 44135919768 aprovada; CI de verificação 44135919636 falhou em nova auditoria npm de picomatch (GHSA-fc5q-39xc-vjpf), cinco entradas altas transitivas, faixa '*' reportada. Não desativar o gate nem usar downgrade cego que reintroduza vulnerabilidades. PR permanece pendente; F3.1 empilhado nele.
## Aceite pendente
- CI e testes de autorização/funcionalidade da F3.1, incluindo integração de migration limpa e ensaio de recuperação ampliado.
- Inspeção visual do cadastro e testes físicos móveis.
- Tratar alerta de dependências e integrar PR #44 antes de F3.1; homologar migration no banco isolado antes de aplicação remota controlada.
- Cadastro efetivo dos locais reais apenas com dados autorizados da instituição. Transferência histórica e manutenção são fases posteriores; não modelar planta real sem documentação autorizada.
Próxima etapa: F3.2 — manutenção dos equipamentos.

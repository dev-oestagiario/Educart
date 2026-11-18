# Manual do administrador — Educart

A TI usa o mesmo site que os professores, por navegador. Não há instalação no computador de uso diário. O acesso administrativo depende de autorização concedida pela equipe responsável pelo ambiente, não de cadastro livre.

## 1. Início da operação
Entre em [Educart](https://dev-oestagiario.github.io/Educart/). Use **Visão geral** para conferir o contexto operacional. No desktop, abra a seção pela barra lateral; no celular, use o botão do menu lateral. Havendo erro de acesso, consulte o suporte institucional.

## 2. Cadastros
| Menu | Procedimento | Conferência |
|---|---|---|
| Carrinhos | Abra o cadastro, informe código, nome e capacidade; use **Cadastrar carrinho**. Para mudanças, **Editar** e **Salvar alterações**. | Capacidade real configurada e estado ativo. Não deduza capacidade pela quantidade de códigos cadastrados. |
| Localizações | Cadastre campus, bloco e sala nessa ordem. Associe a sala de guarda ao carrinho quando confirmada. | Local de guarda não é sala de utilização nem posição em tempo real. |
| Professores | Cadastre nome completo e identificador interno opcional. | Confira duplicidade e vínculo com a pessoa correta. |
| Notebooks | Escolha o laboratório móvel, digite um código por linha, gere códigos ou importe CSV/XLSX com coluna **codigo**; confira a prévia e use **Salvar códigos revisados**. | Confirme patrimônio/identificação; não atribua códigos fictícios a equipamentos reais. |

Inativação e alteração devem obedecer às restrições do sistema; se houver reserva ou movimentação impeditiva, resolva a pendência antes de tentar novamente.

## 3. Autorizar professores
Em **Solicitações > Contas de professores > Vincular conta**, escolha o cadastro do professor e o e-mail da conta confirmada. Use **Vincular professor**. Confirme identidade pelos canais institucionais. Para revogar, escolha o vínculo correto e confirme a revogação. Não crie uma segunda identidade para contornar bloqueios. A concessão/revogação administrativa é tarefa do responsável técnico autorizado, conforme política de acesso.

## 4. Gerir reservas
Em **Reservas > Nova reserva**, selecione professor, carrinho, modalidade completa ou parcial, quantidade, turnos e datas. Use dia, intervalo, dias avulsos ou recorrência semanal. Selecione notebooks identificados quando necessário e disponível (opcional na modalidade parcial), mouse, sala de utilização e observações. Confira cada período e clique **Confirmar reserva**. A validação no banco confirma a operação inteira; sem saldo ou com bloqueio, não insista alterando capacidade.

Na lista, abra a reserva correta para consultar, editar ou cancelar segundo as regras vigentes. Confirme o agrupamento e os períodos afetados; reservas utilizadas não devem ser simplesmente reescritas. O cancelamento libera saldo quando permitido, não apaga o histórico.

## 5. Aprovação de solicitações
Em **Solicitações > Analisar solicitações**, filtre pendentes, revise a necessidade, a disponibilidade e o destino. Informe sala/justificativa se aplicável. Use **Aprovar e confirmar reserva** ou **Rejeitar solicitação**. Pedidos pendentes não reservam equipamentos; a aprovação revalida o saldo. Se ocorrer conflito, consulte o calendário antes de responder ao professor. Verifique a reserva criada e a notificação.

## 6. Manutenção
Em **Manutenção**, abra o cadastro, selecione carrinho, data inicial/final, turnos afetados e motivo interno; use **Programar manutenção**. A janela bloqueia a capacidade do carrinho nos períodos afetados, conforme as regras do backend, sem apagar reservas existentes silenciosamente. Verifique conflitos e resolva-os pelos fluxos autorizados. Para finalizar, abra a janela correta, escolha **Encerrar** e registre o motivo quando solicitado.

## 7. Retirada e devolução
Em **Retirada e devolução**, consulte **Hoje**, selecione o período confirmado e use **Registrar retirada**. Informe quantidade entregue, códigos realmente identificados quando aplicável, responsável e condição. Ressalva exige observação. Confirme. Em **Pendentes de devolução**, abra a movimentação e escolha **Registrar devolução**; confira quantidade, responsável e condição e confirme. Consulte **Histórico** para conferir os registros. Não marque como entregue ou devolvido sem confirmação física.

## 8. Calendário e relatórios
Abra **Calendário**, selecione semana ou mês e filtre por carrinho/professor. Escolha se deseja incluir canceladas. Atualize o relatório e use as opções de exportação PDF/CSV conforme a tela. Confira os filtros e as quantidades antes de encaminhar; relatórios administrativos podem conter dados pessoais e não devem ser publicados na consulta pública.

## 9. Saúde, notificações e suporte
Em **Notificações**, acompanhe os avisos. Em **Saúde da aplicação**, consulte resultados de requisições, falhas e P95 dos últimos 15 minutos nesta aba. A ausência de alerta não garante disponibilidade global. Não há monitor externo ativo nesta entrega; a TI deve consultar evidências independentes. Se uma operação falhar, confira o registro antes de repetir; abra chamado conforme o [guia de suporte](guia-acesso-suporte.md).

## 10. Ambiente 3D
O ambiente 3D V2 permanece desativado em produção até homologação. Em ambiente de desenvolvimento autorizado, a TI pode avaliar a visão ilustrativa, lista alternativa, inspeção virtual e metadados espaciais. Não há controle físico do equipamento, telemetria ou atribuição automática de patrimônio a slots do modelo. Consulte [F5.6](f5-6-homologacao-3d.md).

Este manual descreve a versão em preparação, não comprova publicação/aceite. Nenhuma instalação é necessária para usar a aplicação web.

# Educart — Especificação funcional (primeira versão)

**Estado:** requisitos consolidados das entrevistas; questões em aberto identificadas ao final.
**Escopo inicial:** uso pelos administradores da TI. A auto-solicitação pelos professores é uma evolução futura.

## Objetivo e atores

O Educart organiza a reserva de laboratórios móveis (carrinhos) e notebooks para uso por professores e demais solicitantes da instituição, incluindo consultas, relatórios e visualização 3D.

- **Solicitante:** professor ou outra pessoa que utilizará os equipamentos.
- **Registrante/administrador:** integrante autorizado da equipe de TI que registra e cancela a reserva.
- **Usuário solicitante (futuro):** poderá solicitar reserva sujeita à aprovação administrativa.

## Cadastro de equipamentos

- Cada laboratório móvel possui identificador próprio e **capacidade numérica configurável**, que é a referência para calcular quantos notebooks podem ser reservados em cada data e turno. Exemplo: capacidade 30, sem reservas no período = 30 disponíveis, ainda que nem todos os códigos individuais tenham sido cadastrados.
- Cada notebook que for identificado individualmente possui código próprio e associação a um laboratório móvel. Identificadores podem ser códigos da equipe de TI; não é obrigatório utilizar número de patrimônio. **A ausência de cadastro individual de alguns notebooks não diminui a capacidade disponível do carrinho.**
- O administrador pode informar identificadores manualmente, importar identificadores por planilha ou solicitar geração automática de códigos para diversos notebooks, com possibilidade de editar os códigos gerados antes de concluir o cadastro.
- Em reserva parcial, a quantidade reservada reduz a disponibilidade do carrinho em cada data e turno; os identificadores dos equipamentos efetivamente selecionados são registrados para rastreabilidade, sem exigir cadastro prévio de todos os notebooks que compõem a capacidade.
- A disponibilidade de cada carrinho é calculada por **data e turno**, usando **capacidade configurada menos a soma de quantidades ativas reservadas no período**. Quando um notebook tiver código identificado, esse mesmo código também não poderá ser destinado duas vezes no período.
- Mouse é uma necessidade/acessório informado separadamente da seleção do laboratório móvel ou notebooks, por meio de uma marcação simples **Precisa de mouse: sim/não**. A marcação serve para orientar a equipe de TI na preparação dos equipamentos; não há cadastro, quantidade, identificação ou controle de estoque de mouses.

## RF-08 — Cadastrar notebooks por código manual ou automático

O administrador pode cadastrar notebooks individualmente ou em lote para um laboratório móvel, com estas alternativas:
- Informar manualmente os códigos existentes, inclusive em cadastro em lote.
- Importar uma planilha contendo os códigos existentes (formato exato da planilha a definir).
- Solicitar geração automática de identificadores para uma quantidade indicada e editar os códigos gerados antes de salvar.

O identificador de cada notebook deve ser único entre os notebooks cadastrados, independentemente de ter sido digitado, importado ou gerado. O sistema não substituirá automaticamente os códigos informados pelo administrador. Todos os registros criados devem ficar associados ao carrinho escolhido.

**Critérios de aceitação:**
- Dado um carrinho, quando o administrador informar cinco identificadores válidos, o sistema cadastra cinco notebooks associados a ele.
- Ao solicitar a geração de cinco códigos, o sistema apresenta cinco identificadores distintos, editáveis antes da confirmação.
- Ao importar planilha com identificadores, o administrador revisa e valida os dados antes do registro.
- Identificadores duplicados ou vazios impedem a confirmação dos respectivos cadastros e a tela indica o problema.
- A quantidade de notebooks cadastrados no carrinho é consultável após concluir a operação.

## RF-01 — Registrar reserva administrativamente

O administrador informa:
1. Solicitante/responsável pela utilização.
2. Tipo: laboratório móvel completo ou notebooks individuais (reserva parcial).
3. Identificador do laboratório móvel.
4. Em reserva parcial, quantidade e identificadores dos notebooks escolhidos.
5. Uma ou mais datas da utilização, selecionadas por **intervalo contínuo** (por exemplo, semana inteira ou mês inteiro) ou por **datas específicas** (por exemplo, somente segunda, quarta e sexta-feira).
6. Turnos: matutino, vespertino e/ou noturno (qualquer combinação, inclusive três).
7. Necessidade de mouse (sim/não), sem seleção de quantidade.
8. Observação opcional.

O registrante fica registrado automaticamente, separado do solicitante.

**Critérios de aceitação:**
- Uma reserva parcial somente é confirmada se sua quantidade couber no saldo de todos os períodos solicitados e nenhum identificador individual selecionado conflitar com outra reserva ativa.
- A reserva completa compromete **toda a capacidade configurada do carrinho** em todos os períodos selecionados, mesmo se o cadastro individual tiver menos identificadores.
- É possível selecionar mais de um turno na mesma data.
- Nenhuma reserva é confirmada com notebook, período ou solicitante obrigatório ausente.
- Marcar ou desmarcar **Precisa de mouse** registra a preferência sem alterar disponibilidade de notebooks e sem impedir a confirmação por falta de mouses.

## RF-02 — Verificar conflitos e disponibilidade

- Um turno é a menor unidade de reserva: o total de quantidades ativas reservadas no carrinho não pode superar sua capacidade naquele dia e turno. Quando houver notebooks identificados, **o mesmo identificador** não pode ser associado a duas reservas ativas no mesmo dia e turno.
- Outros notebooks livres do mesmo carrinho continuam reserváveis naquele turno.
- A reserva completa somente é permitida se **nenhuma quantidade estiver reservada** naquele carrinho em cada data e turno escolhidos, de modo que toda a capacidade configurada esteja disponível.
- Se houver conflito, o sistema detalha datas, turnos e equipamentos indisponíveis e permite rever a seleção ou escolher outro carrinho.
- A verificação também deve ocorrer na confirmação, evitando que duas operações simultâneas comprometam o mesmo notebook.

**Critérios de aceitação:**
- Notebook A reservado segunda/matutino não pode ser reservado novamente segunda/matutino; pode ser reservado segunda/vespertino, se livre.
- Notebook B do mesmo carrinho continua disponível segunda/matutino, se não tiver reserva.
- Um carrinho parcialmente ocupado não pode ser reservado **por completo** no mesmo turno, mas a quantidade restante da capacidade configurada pode ser reservada parcialmente.
- A escolha de datas e turnos múltiplos não gera reservas parciais silenciosamente quando algum período está indisponível.

## RF-03 — Agrupar reservas de múltiplos dias

Uma única reserva administrativa pode agrupar vários dias, mantendo registros de ocupação por data e turno. O administrador dispõe de duas formas de seleção: **intervalo de datas** (início e fim, para uma semana ou mês inteiros) ou **datas avulsas** (um dia ou dias não consecutivos). **Somente segunda a sexta-feira são datas de reserva permitidas**: ao selecionar um intervalo, o sistema exclui sábados e domingos automaticamente; no calendário avulso, não permite selecionar esses dias. Antes da confirmação, deve ser possível revisar a relação exata das datas selecionadas. Feriados e outros dias sem aula que caiam de segunda a sexta-feira continuam sendo datas reserváveis, sem cadastro de calendário escolar e sem exclusão automática. Reservas nesses dias seguem ocupando os notebooks selecionados, mesmo que não haja aula.

**Critérios de aceitação:**
- Um cadastro de segunda a quarta/matutino aparece como uma reserva agrupada, mas ocupa os notebooks em três datas distintas.
- O administrador pode escolher um período contínuo de uma semana ou mês, uma data única ou vários dias avulsos, sem repetir todo o formulário.
- O intervalo de segunda a domingo gera ocupação apenas de segunda a sexta, sem comprometer notebooks no sábado ou domingo.
- A seleção avulsa não permite sábado ou domingo; o sistema sinaliza por que o dia está indisponível.
- Um feriado em uma terça-feira é incluído normalmente em um intervalo de reservas e pode ser selecionado como data avulsa. Se reservado, ocupa os notebooks naquele turno, independentemente da realização de aulas.
- O sistema apresenta explicitamente todas as datas que serão reservadas, e permite revisá-las antes de confirmar.
- O sistema aponta conflitos específicos antes de confirmar todo o conjunto.
- É possível cancelar uma data selecionada sem cancelar automaticamente as demais datas válidas.
- Relatórios e disponibilidade consideram os períodos efetivos, não apenas o cabeçalho da reserva agrupada.

## RF-04 — Cancelar reservas

- O cancelamento é realizado pelo administrador, inclusive quando solicitado pelo professor.
- O prazo informado é **até o dia anterior** à data da utilização; não há cancelamento normal no próprio dia segundo a regra atual.
- É possível cancelar a reserva completa ou uma data específica de uma reserva de vários dias, respeitando o prazo daquela data.
- O cancelamento libera imediatamente a disponibilidade correspondente e preserva o histórico e a identificação de quem registrou a reserva.

**Critérios de aceitação:**
- Ao cancelar um período elegível, os notebooks ficam disponíveis novamente naquele dia/turno.
- Períodos não cancelados mantêm seus bloqueios.
- A consulta e os relatórios mostram a situação correta após cancelar.
- Tentativa de cancelamento fora do prazo é bloqueada com mensagem clara.

## RF-05 — Consultar reservas e relatórios

- O administrador visualiza as reservas na tela e filtra por **semana** ou **mês**.
- A consulta apresenta solicitante, registrante, carrinho, notebooks identificados, quantidade, data(s), turno(s), necessidade de mouse, observação e situação.
- Permite exportação digital em **PDF** e **planilha** (formato concreto a definir).
- Os resumos gerenciais diferenciam quantidade de reservas e utilização por período, para não duplicar ou subcontar reservas agrupadas.

**Critérios de aceitação:**
- O filtro semanal e mensal altera a lista e o recorte da exportação.
- Cancelamentos permanecem rastreáveis, mas não ocupam disponibilidade.
- A exportação contém os mesmos dados aplicáveis ao recorte selecionado.

## RF-06 — Consultar visualização 3D

- Um carrinho genérico em 3D representa **uma posição visual por unidade da capacidade configurada**, mesmo que não existam identificadores individuais cadastrados para todas elas. Posições de equipamentos com código conhecido mostram seu identificador, e posições sem código permanecem sem identificação específica.
- A seleção de data e turno determina quais notebooks aparecem disponíveis ou reservados.
- Ao clicar em notebook reservado, o administrador consulta solicitante, data, turno, necessidade de mouse e observações, além do identificador.
- Ao clicar na estrutura do carrinho, consulta capacidade, disponíveis, reservados e contexto das reservas parciais/completas.
- O modelo 3D **não determina nem grava a disponibilidade**; ele apresenta os dados do sistema.
- Deve existir consulta textual equivalente para acessibilidade e situações nas quais o 3D não carrega.

**Critérios de aceitação:**
- O total de posições de notebooks exibidas corresponde à **capacidade configurada do carrinho** e não à contagem de identificadores previamente cadastrados; a ocupação reflete quantidades reservadas no período.
- A legenda/indicação visual distingue disponibilidade e reserva e há informação acessível sem depender somente de cores.
- Criar ou cancelar uma reserva atualiza o estado consultado no 3D.

## RF-09 — Editar reservas confirmadas

O administrador pode editar uma reserva já confirmada para corrigir ou alterar o **solicitante**, o laboratório móvel/notebooks selecionados, as **datas** e os **turnos**, sem precisar recriar a reserva. A interface também poderá atualizar a indicação de mouse e as observações. O registrante original permanece identificado, e o sistema registra quem realizou cada alteração.

**Regras:**
- Antes de salvar, verificar novamente a disponibilidade dos notebooks para todas as combinações de datas e turnos resultantes. Na validação, não considerar a própria reserva como conflito consigo mesma, mas manter os bloqueios de outras reservas.
- Se houver conflito, informar o(s) notebook(s), data(s) e turno(s) afetado(s), preservar a reserva anterior e permitir que o administrador revise a edição.
- Aplicar alterações de equipamentos/períodos e seus bloqueios de forma indivisível: em sucesso, liberar apenas as ocupações antigas que não permaneceram e criar as novas; em erro, manter a reserva original intacta.
- Registrar no histórico **administrador que alterou**, momento da edição e diferenças entre valores anteriores e novos (solicitante, carrinho/notebooks, datas/turnos, mouse e observações conforme aplicável).
- Atualizar detalhes, painel, relatórios e visualização 3D após a edição bem-sucedida.
- **Edições administrativas são permitidas no próprio dia da utilização**, inclusive correções no solicitante, nos notebooks, no carrinho, nos turnos, no indicador de mouse e nas observações, desde que a disponibilidade seja revalidada e o histórico seja preservado. A edição não é bloqueada apenas por ocorrer na data reservada.
- **Cancelamento total segue permitido somente até o dia anterior** à utilização. A ação de editar não pode ser usada para encerrar integralmente uma reserva do próprio dia como forma de contornar essa restrição; uma troca ou correção de equipamentos no próprio dia permanece permitida, com trilha de auditoria.
- **Pendente:** tratamento de alterações retroativas de datas já transcorridas, que não foi definido na entrevista.

**Critérios de aceitação:**
- Alterar o solicitante sem mudar equipamentos e períodos preserva a ocupação e registra a mudança no histórico.
- Trocar notebook, data ou turno para opção disponível atualiza a disponibilidade e o 3D sem criar duplicidade.
- Tentar trocar para notebook já reservado por outra pessoa no mesmo dia/turno bloqueia a edição e mantém a versão anterior.
- Ao editar uma reserva agrupada, a verificação abrange todos os dias e turnos resultantes.
- O histórico permite identificar quem alterou e quais informações foram modificadas.
- No próprio dia da reserva, o administrador consegue trocar o notebook por outro disponível e corrigir o professor responsável; o sistema registra o antes/depois e não permite conflito.
- No próprio dia, cancelar a reserva inteira continua bloqueado pela regra específica de cancelamento.

## RF-07 — Solicitações diretas pelos professores (futuro, fora da primeira entrega)

Um usuário poderá solicitar uma reserva, que ficará pendente de análise. O administrador poderá aprovar ou rejeitar. Ao aprovar, o pedido passará a uma reserva efetiva mediante validação de disponibilidade. Fluxos de notificações, prioridade e bloqueio de estoque enquanto pendente ainda não estão definidos.

## Regras e questões a detalhar antes da implementação

1. **Capacidade (decidido):** a capacidade numérica configurada no carrinho é a referência da disponibilidade, independentemente da quantidade de identificadores cadastrados. Disponíveis = capacidade − quantidades ativas reservadas para a data e turno. **A detalhar:** como atribuir códigos específicos a posições ainda sem identificação quando for necessário separar fisicamente os aparelhos.
2. **Mouse (decidido):** somente sinalização sim/não para a equipe de TI; não existe controle de quantidade, identificação ou disponibilidade de mouses nesta versão.
3. **Seleção de dias (decidido):** oferecer intervalo contínuo e datas avulsas, inclusive um único dia, **apenas de segunda a sexta-feira**. Sábados e domingos são excluídos dos intervalos e não podem ser selecionados individualmente. **Feriados e dias sem aula (decidido):** não precisam de cadastro ou tratamento especial; se ocorrerem de segunda a sexta, continuam incluídos normalmente na reserva e no controle de disponibilidade.
4. **Cancelamentos excepcionais:** o prazo até o dia anterior está definido; eventuais exceções administrativas ainda não.
5. **Situações de reserva:** está decidido que administradores podem editar reservas confirmadas inclusive no próprio dia da utilização, sempre com revalidação e histórico. O cancelamento total do próprio dia permanece bloqueado. Ainda faltam nomes exatos dos estados, tratamento de edição retroativa após a data de uso e regras de manutenção dos equipamentos.
6. **Acesso e autenticação:** mecanismo técnico e permissões detalhadas além da responsabilidade dos dois administradores da TI ainda não definidos.

## Decisões arquiteturais relacionadas

- [ADR 0001 — Notebooks identificados individualmente](adr/0001-notebooks-identificados-individualmente.md)
- [ADR 0002 — Disponibilidade por data, turno e equipamento](adr/0002-disponibilidade-por-data-turno-e-equipamento.md)
- [ADR 0003 — Visualização 3D como projeção das reservas](adr/0003-visualizacao-3d-como-projecao-das-reservas.md)
- [ADR 0004 — Capacidade configurada como fonte da disponibilidade](adr/0004-capacidade-configurada-e-disponibilidade.md)

Termos do domínio: [GLOSSARY.md](../GLOSSARY.md).

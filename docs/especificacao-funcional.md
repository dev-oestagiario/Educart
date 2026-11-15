# Educart — Especificação funcional (primeira versão)

**Estado:** requisitos consolidados das entrevistas; questões em aberto identificadas ao final.
**Escopo inicial:** uso pelos administradores da TI. A auto-solicitação pelos professores é uma evolução futura.

## Objetivo e atores

O Educart organiza a reserva de laboratórios móveis (carrinhos) e notebooks para uso por professores e demais solicitantes da instituição, incluindo consultas, relatórios e visualização 3D.

- **Solicitante:** professor ou outra pessoa que utilizará os equipamentos.
- **Registrante/administrador:** integrante autorizado da equipe de TI que registra e cancela a reserva.
- **Usuário solicitante (futuro):** poderá solicitar reserva sujeita à aprovação administrativa.

## Cadastro de equipamentos

- Cada laboratório móvel possui identificador próprio e capacidade configurável, pois carrinhos podem ter quantidades distintas de notebooks.
- Cada notebook possui identificador individual e associação a um laboratório móvel. Identificadores podem ser códigos próprios da equipe de TI; não é obrigatório utilizar número de patrimônio.
- O administrador pode informar identificadores manualmente, importar identificadores por planilha ou solicitar geração automática de códigos para diversos notebooks, com possibilidade de editar os códigos gerados antes de concluir o cadastro.
- A quantidade reservada em modalidade parcial corresponde aos notebooks efetivamente selecionados por identificador.
- A disponibilidade de cada notebook é consultada para cada **data e turno**, não somente por carrinho ou dia.
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
- Uma reserva parcial somente é confirmada com todos os notebooks selecionados disponíveis em todos os períodos solicitados.
- A reserva completa compromete todos os notebooks daquele laboratório móvel em todos os períodos selecionados.
- É possível selecionar mais de um turno na mesma data.
- Nenhuma reserva é confirmada com notebook, período ou solicitante obrigatório ausente.
- Marcar ou desmarcar **Precisa de mouse** registra a preferência sem alterar disponibilidade de notebooks e sem impedir a confirmação por falta de mouses.

## RF-02 — Verificar conflitos e disponibilidade

- Um turno é a menor unidade de reserva: qualquer reserva de um notebook impede nova reserva **do mesmo notebook** naquele turno e data, independentemente da hora dentro do turno.
- Outros notebooks livres do mesmo carrinho continuam reserváveis naquele turno.
- A reserva completa somente é permitida se **todos** os notebooks do carrinho estiverem livres em cada data e turno escolhidos.
- Se houver conflito, o sistema detalha datas, turnos e equipamentos indisponíveis e permite rever a seleção ou escolher outro carrinho.
- A verificação também deve ocorrer na confirmação, evitando que duas operações simultâneas comprometam o mesmo notebook.

**Critérios de aceitação:**
- Notebook A reservado segunda/matutino não pode ser reservado novamente segunda/matutino; pode ser reservado segunda/vespertino, se livre.
- Notebook B do mesmo carrinho continua disponível segunda/matutino, se não tiver reserva.
- Um carrinho parcialmente ocupado não pode ser reservado **por completo** no mesmo turno, mas seus notebooks livres podem ser reservados parcialmente.
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

- Um carrinho genérico em 3D representa cada notebook cadastrado individualmente.
- A seleção de data e turno determina quais notebooks aparecem disponíveis ou reservados.
- Ao clicar em notebook reservado, o administrador consulta solicitante, data, turno, necessidade de mouse e observações, além do identificador.
- Ao clicar na estrutura do carrinho, consulta capacidade, disponíveis, reservados e contexto das reservas parciais/completas.
- O modelo 3D **não determina nem grava a disponibilidade**; ele apresenta os dados do sistema.
- Deve existir consulta textual equivalente para acessibilidade e situações nas quais o 3D não carrega.

**Critérios de aceitação:**
- O total de notebooks exibidos corresponde aos cadastrados no carrinho.
- A legenda/indicação visual distingue disponibilidade e reserva e há informação acessível sem depender somente de cores.
- Criar ou cancelar uma reserva atualiza o estado consultado no 3D.

## RF-07 — Solicitações diretas pelos professores (futuro, fora da primeira entrega)

Um usuário poderá solicitar uma reserva, que ficará pendente de análise. O administrador poderá aprovar ou rejeitar. Ao aprovar, o pedido passará a uma reserva efetiva mediante validação de disponibilidade. Fluxos de notificações, prioridade e bloqueio de estoque enquanto pendente ainda não estão definidos.

## Regras e questões a detalhar antes da implementação

1. **Cadastro versus capacidade:** como tratar divergência entre a capacidade informada do carrinho e a lista de notebooks cadastrados; não assumir um valor fixo.
2. **Mouse (decidido):** somente sinalização sim/não para a equipe de TI; não existe controle de quantidade, identificação ou disponibilidade de mouses nesta versão.
3. **Seleção de dias (decidido):** oferecer intervalo contínuo e datas avulsas, inclusive um único dia, **apenas de segunda a sexta-feira**. Sábados e domingos são excluídos dos intervalos e não podem ser selecionados individualmente. **Feriados e dias sem aula (decidido):** não precisam de cadastro ou tratamento especial; se ocorrerem de segunda a sexta, continuam incluídos normalmente na reserva e no controle de disponibilidade.
4. **Cancelamentos excepcionais:** o prazo até o dia anterior está definido; eventuais exceções administrativas ainda não.
5. **Situações de reserva:** nomes exatos dos estados, permissões de edição, regras de alterações e eventual manutenção de equipamento ainda não definidos.
6. **Acesso e autenticação:** mecanismo técnico e permissões detalhadas além da responsabilidade dos dois administradores da TI ainda não definidos.

## Decisões arquiteturais relacionadas

- [ADR 0001 — Notebooks identificados individualmente](adr/0001-notebooks-identificados-individualmente.md)
- [ADR 0002 — Disponibilidade por data, turno e equipamento](adr/0002-disponibilidade-por-data-turno-e-equipamento.md)
- [ADR 0003 — Visualização 3D como projeção das reservas](adr/0003-visualizacao-3d-como-projecao-das-reservas.md)

Termos do domínio: [GLOSSARY.md](../GLOSSARY.md).

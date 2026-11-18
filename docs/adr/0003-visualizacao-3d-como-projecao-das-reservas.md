# Visualização 3D como projeção das reservas

Status: aceito

A representação 3D do laboratório móvel será uma interface de consulta derivada dos cadastros e reservas do Educart, não a fonte de verdade para disponibilidade ou estoque. Essa separação permite mostrar cada notebook e seu estado por data e turno, com detalhes do solicitante e de acessórios como mouse, sem criar regras de reserva diferentes das utilizadas pelo restante do sistema.

## Alternativas consideradas

- **Manter o estado de ocupação dentro do modelo 3D:** associa a disponibilidade a um componente visual e aumenta o risco de divergência entre telas.
- **Derivar a ocupação dos dados da aplicação (adotado):** centraliza as verificações e permite outras interfaces e relatórios consistentes.

## Consequências

- O modelo 3D é genérico e representa a **capacidade configurada** de cada carrinho por posições visuais individuais, mesmo quando nem todos os notebooks possuírem identificadores cadastrados. As posições reservadas refletem as quantidades ativas; o código físico só é exibido quando conhecido.
- Selecionar um notebook exibe os dados da sua reserva no período escolhido; selecionar o carrinho apresenta a disponibilidade geral e as reservas parciais ou completas.
- Criação, cancelamento e alterações de reserva atualizam a informação consultada no 3D; a exclusividade e a capacidade são garantidas pela aplicação, independentemente do modelo visual.

## Complemento V2 (F5.6)

A quantidade de exemplos visuais no GLB não é a capacidade nominal e não prova presença, reserva ou localização física. Somente vínculos expressos pelo backend entre notebook/slot/período permitem mostrar a atribuição individual; reservar quantidade não atribui código por ordem. Modelos sem referências aprovadas são ilustrativos. Ausência de vínculo ou falha de consulta não significa livre. A interface opera em leitura, sem comando físico de portas. O menu V2 segue restrito a DEV e autorização administrativa até [homologação completa](../f5-6-homologacao-3d.md); não revoga o princípio de projeção derivada.

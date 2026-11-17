# Educart — Especificação para implementação da Fase 1

**Estado:** autorizado e em implementação na branch `feat/fase-1-fundacao` / PR #10.
**Método:** síntese das entrevistas segundo a skill Matt Pocock `to-spec`.
**Referências:** [stack e fases](stack-mvp.md), [especificação funcional](especificacao-funcional.md), [modelo de dados](modelo-de-dados.md), [fluxos de tela](fluxos-de-tela.md) e [ADR de capacidade](adr/0004-capacidade-configurada-e-disponibilidade.md).

## Problem Statement

Dois administradores da TI precisam organizar carrinhos de notebooks, professores solicitantes e códigos individuais dos equipamentos antes de gerenciar reservas. Atualmente o repositório contém documentação e skills, mas nenhuma aplicação web inicial foi identificada. Precisamos de uma base funcional, segura e verificável para evoluir ao motor de reservas na Fase 2.

## Solution

Entregar uma primeira versão **administrativa**, acessível após autenticação, com painel simples, navegação, cadastro e consulta de solicitantes, carrinhos e códigos de notebooks. A capacidade numérica de cada carrinho será mantida independentemente do número de códigos individuais cadastrados. O Supabase servirá como backend do MVP.

A Fase 1 **não** disponibiliza agendamento nem desconta saldos por reservas: enquanto não existir motor de reservas, a quantidade disponível exibida poderá corresponder à capacidade configurada, com comunicação explícita de que o cálculo de reservas ficará para a Fase 2.

## User Stories

1. Como administrador da TI, quero entrar com minha conta, para acessar somente funções autorizadas.
2. Como administrador da TI, quero sair com segurança e manter uma sessão válida, para trabalhar sem credenciais fixas no código.
3. Como administrador da TI, quero visualizar uma tela inicial com as áreas do sistema, para navegar pelos cadastros.
4. Como usuário não autorizado, não devo conseguir ler ou editar dados administrativos, para preservar a segurança.
5. Como administrador da TI, quero cadastrar um laboratório móvel com código e capacidade, para representar cada carrinho.
6. Como administrador da TI, quero listar, pesquisar e corrigir dados de carrinhos, para mantê-los atualizados.
7. Como administrador da TI, quero visualizar a capacidade informada de um carrinho, para conhecer a quantidade de notebooks prevista.
8. Como administrador da TI, quero cadastrar professores solicitantes, para identificá-los quando as reservas forem habilitadas.
9. Como administrador da TI, quero consultar e atualizar os solicitantes cadastrados, para corrigir informações sem criar duplicações.
10. Como administrador da TI, quero cadastrar códigos de notebooks manualmente, para identificar equipamentos específicos.
11. Como administrador da TI, quero gerar vários códigos de notebooks e editá-los antes de salvar, para evitar trabalho repetitivo.
12. Como administrador da TI, quero importar códigos de notebooks por planilha com pré-visualização, para aproveitar cadastros existentes.
13. Como administrador da TI, quero receber mensagens claras para códigos duplicados e dados inválidos, para corrigir erros.
14. Como administrador da TI, quero consultar códigos por carrinho sem que sua contagem altere a capacidade, para distinguir rastreabilidade e disponibilidade.
15. Como administrador da TI, quero usar o sistema com teclado e em telas menores, para operar sem depender de interações difíceis.
16. Como responsável pelo projeto, quero que os fluxos tenham testes automáticos e documentação mínima, para implementar a Fase 2 com segurança.

## Implementation Decisions

- **Front-end:** React com TypeScript, Tailwind CSS e shadcn/ui; ferramenta de build escolhida durante o ticket inicial.
- **Dados e autenticação:** Supabase PostgreSQL, Auth e acesso pelo SDK oficial, sem API Node/Nest separada no MVP.
- **Segurança:** Supabase RLS nas tabelas expostas, usuários administrativos autorizados por fonte confiável no banco, segregação de credenciais e políticas que não dependam apenas da UI. Método de provisionamento dos dois administradores ainda precisa ser definido antes de implementar a autenticação.
- **Validação:** Zod para validação na entrada e mensagens na UI, com validação de integridade também no banco.
- **Consultas remotas:** TanStack Query para listas e mutações; invalidar/refazer consultas após alterações.
- **Estado local:** Zustand para UI/formulários e filtros, caso “Stage” se refira a Zustand, evitando duplicar dados do servidor.
- **Carrinhos:** código identificador único; capacidade configurada como inteiro positivo; mesmo com menos códigos de notebook, o total permanece conforme configuração.
- **Notebooks:** códigos próprios, únicos, vinculados a carrinho; suporte a entrada manual, geração editável e importação revisável. O formato de planilha a escolher no ticket de importação (proposta: CSV ou XLSX); não presumir que códigos autogerados correspondem a etiquetas físicas.
- **Solicitantes:** registro separado das contas administrativas. Campos adicionais não acordados não serão obrigatórios.
- **3D e reservas:** expressamente fora da Fase 1; Three.js e React Three Fiber previstos para fase posterior, conforme stack documentada.
- **Alteração de capacidade:** permitir configuração inicial; política de redução quando existirem reservas será detalhada na Fase 2.
- **Autorização do desenvolvimento:** concedida em 15/11/2026. Manter as alterações no PR #10 até os critérios de aceite e testes serem cumpridos.

## Testing Decisions

- Testar **comportamento externo**, prioritariamente em fluxo ponta a ponta com Playwright: acesso autorizado, acesso negado, cadastro, edição, lista e validação.
- Testar validações de formulário e componentes com Vitest e React Testing Library, priorizando casos observáveis e acessibilidade.
- Testar políticas RLS e integridade do banco contra sessões administrativas e não autorizadas, sem confiar em telas.
- Testar duplicidade de códigos, campos obrigatórios, erros de rede, atualização de cache e que a capacidade cadastrada não depende de quantos códigos foram registrados.
- Testar fluxos de teclado, rótulos de formulário, feedback de erro e layout responsivo.
- Gate de conclusão: build, verificação de tipos, testes automatizados e revisão de segurança sem problemas críticos.
- Como não há código prévio, as suítes surgirão incrementalmente ao longo dos tickets, evitando construir testes sem comportamento associado.

## Acceptance Criteria

- [ ] Administrador autorizado entra, navega e encerra sessão.
- [ ] Usuário não autorizado não vê nem modifica cadastros via interface ou acesso direto à API.
- [ ] Carrinho com capacidade 30 mostra capacidade 30 mesmo com somente 28 notebooks identificados.
- [ ] Administrador cadastra e edita carrinhos e solicitantes.
- [ ] Administrador inclui códigos manualmente, gera códigos editáveis e importa uma planilha de códigos com revisão.
- [ ] Duplicidades e entradas inválidas são impedidas com mensagens compreensíveis.
- [ ] Estado de carregamento, erro, vazio e sucesso tratado nas telas; teclado e dispositivos menores utilizáveis.
- [ ] Testes e documentação de desenvolvimento executados e revisados antes de considerar a fase pronta.

## Out of Scope

Criação, edição e cancelamento de reservas; controle de conflito por turno; histórico de reservas; relatórios PDF/XLSX de reservas; modelo 3D; autorização de solicitações feitas diretamente pelos professores; controle de estoque de mouse.

## Further Notes

Pontos pendentes para resolver **antes do respectivo ticket de implementação**: projeto Supabase a utilizar, forma segura de provisionar os dois administradores, escolha CSV/XLSX na importação, confirmação de “Zustand” como biblioteca mencionada oralmente, e detalhes de manutenção de notebooks. Pendências não autorizam suposições que comprometam dados ou segurança.

A documentação original orientou o planejamento. A implementação da Fase 1 foi posteriormente autorizada; a conclusão depende de testes integrados, provisionamento seguro e revisão.

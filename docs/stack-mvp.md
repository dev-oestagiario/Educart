# Educart — Stack e organização do MVP (planejamento)

**Estado:** planejamento, sem início da implementação. **Decisão de 15/11/2026:** uso de Supabase para o MVP e Three.js para a visualização 3D. O desenvolvimento só terá início após autorização explícita.

## Stack escolhida e responsabilidades

| Camada | Tecnologia | Uso |
|---|---|---|
| Interface web | React + TypeScript | Formulários administrativos, calendário, gestão de carrinhos e notebooks, consultas |
| Componentes e estilos | Tailwind CSS + shadcn/ui | UI responsiva e acessível; proposta aceita como base no diálogo |
| Dados e autenticação | Supabase (PostgreSQL, Auth, Data API) | Persistir cadastros, reservas, históricos e autenticar administradores |
| Integridade operacional | Funções transacionais PostgreSQL | Confirmar/editar reservas sem exceder capacidade do carrinho por data/turno, mesmo com operações concorrentes |
| Validação | Zod | Validar entrada de formulários e contratos de dados; o servidor/banco também validará |
| Consultas/cache | TanStack Query | Consultar, atualizar e invalidar dados remotos do Supabase |
| Estado local da UI | Zustand (interpretação provisória do termo oral “Stage”) | Estados de formulário em etapas, filtros, seleção de carrinho e turno, seleção/visualização 3D; **confirmar nome da biblioteca se necessário** |
| Renderização 3D | **Three.js** | Motor de cena, geometria, iluminação, câmera e interação |
| Integração React/3D | **React Three Fiber** (proposta recomendada) | Criar e atualizar cenas Three.js a partir dos componentes React; não é alternativa ao motor Three.js |
| Utilitários 3D | @react-three/drei (opcional) | Controles de câmera e utilitários para R3F, somente se for útil |
| Testes | Vitest + React Testing Library; Playwright para fluxos E2E (proposta) | Validar regras da UI, fluxos críticos e regressões |

A biblioteca React Three Fiber é um renderizador React para Three.js. A documentação oficial informa que ela utiliza os objetos da biblioteca Three.js; portanto, a stack pode empregar **ambas** sem duplicar motores 3D. Usar versões estáveis compatíveis com a versão de React escolhida quando for implementar; não fixar números de versão prematuramente.

## Divisão de responsabilidades

- **Supabase/PostgreSQL:** fonte de verdade dos cadastros, capacidade por carrinho, reservas, disponibilidade, auditoria e segurança. Não confiar na validação do navegador para impor limites.
- **Zod:** validar campos e formatos antes de enviar; não substitui restrições de banco e autorização.
- **TanStack Query:** estado remoto, cache, revalidação após criar/editar/cancelar reserva e estados de carregamento/erro. Evitar duplicar no Zustand os mesmos dados de servidor.
- **Zustand:** apenas estados locais transitórios (por exemplo, filtros, modo de seleção, interface 3D e etapas do formulário). Não representar o banco de dados como outro estado autoritativo.
- **Three.js + React Three Fiber:** mostrar um carrinho genérico com uma posição para cada unidade da capacidade configurada. Mostrar ocupação por data/turno baseada no Supabase; códigos individuais aparecem quando conhecidos. Não inventar códigos físicos e não decidir disponibilidade com base na cena 3D.
- **Supabase Auth + RLS:** apenas administradores autorizados podem realizar operações administrativas. Segurança na base; nunca colocar chave secreta de servidor no frontend. Regras transacionais para reservas devem verificar autorização e capacidade no banco.

## Etapas propostas

### Fase 1 — Fundação e cadastros administrativos

**Resultado demonstrável:** um administrador autenticado consegue acessar o painel, cadastrar/editar carrinhos com capacidade configurada, cadastrar solicitantes e manter códigos de notebooks (manual, em lote ou por importação simples conforme formato a escolher). Um carrinho com capacidade 30 aparece com saldo 30 se não houver reservas, mesmo com menos de 30 códigos de notebook cadastrados.

**Entregas:** estrutura React/TypeScript, cliente Supabase, autenticação, políticas de acesso, schema inicial, navegação administrativa, design básico responsivo, validações Zod, camada de consultas TanStack Query, estado local Zustand, testes de cadastros e políticas de acesso.

**Critérios de conclusão:** login administrativo funcional; acesso não autorizado bloqueado; códigos duplicados rejeitados; capacidade validada e independente da quantidade de códigos cadastrados; testes automatizados essenciais executados.

### Fase 2 — Reserva e disponibilidade

**Resultado demonstrável:** administrador cria reserva parcial ou completa para um dia, vários dias ou intervalos; a disponibilidade por carrinho/data/turno é descontada corretamente.

**Entregas:** reserva agrupada com períodos, cálculo de saldo no PostgreSQL, função transacional, turnos matutino/vespertino/noturno, seleção segunda a sexta (feriados inclusive), campo “Precisa de mouse”, consulta de conflitos por data e turno, validação Zod, cache invalidado corretamente, testes de concorrência.

**Critérios de conclusão:** não exceder capacidade mesmo com duas confirmações simultâneas; reserva completa bloqueada quando houver ocupação; semana/mês gera períodos corretos; transação não salva parcialmente em caso de conflito.

### Fase 3 — Gestão e auditoria

**Resultado demonstrável:** visualizar e editar reservas inclusive no próprio dia com registro antes/depois e possibilidade de cancelamento por data até o dia anterior.

**Entregas:** detalhamento, edição auditável, histórico, cancelamento parcial e total conforme prazo, atualização de saldo e proteção contra contornar cancelamento integral pela edição.

**Critérios de conclusão:** não perder dados no erro, trilha de auditoria completa e disponibilidade consistente.

### Fase 4 — Calendário e relatórios

**Resultado demonstrável:** consulta semanal/mensal, filtros e exportações PDF e planilha, diferenciando reservas de utilizações por período.

### Fase 5 — Visualização 3D

**Resultado demonstrável:** representação em Three.js de um carrinho escolhido, com posições correspondentes à capacidade; seleção de data/turno; cores e legendas acessíveis de ocupado/livre e detalhes do professor/reserva. O sistema permanece utilizável sem 3D.

**Tecnologia:** Three.js como motor e React Three Fiber como integração proposta com React. Modelagem 3D visual não cria nem modifica bloqueios por conta própria.

### Evolução posterior (fora do MVP inicial)

Solicitação de reserva diretamente pelo professor, com fluxo de aprovação/rejeição do administrador. Política de bloqueio de capacidade por solicitações pendentes ainda não definida.

## Sequência de trabalho sugerida para a fase 1

1. Definir estrutura do repositório e pipeline de testes/qualidade, sem iniciar até autorização.
2. Escolher projeto Supabase e método de criação das contas dos dois administradores, sem contas fixas no código.
3. Elaborar migrations para administradores/perfis, solicitantes, carrinhos e códigos individuais; planejar funções para reserva na fase seguinte.
4. Definir políticas RLS, testes de permissões e chaves públicas/secretas com isolamento correto.
5. Construir layout administrativo, autenticação e navegação com acessibilidade.
6. Implementar fluxo de cadastro de carrinhos, capacidade numérica, solicitantes e notebook com código opcional para o saldo.
7. Criar testes de validação e fluxos E2E, verificar critérios de aceite antes de avançar.

## Pontos que ainda exigem decisão

- A palavra transcrita como “Stage” foi interpretada como **Zustand**; confirmar apenas se esse não for o nome pretendido.
- Método de cadastro de administradores (convite, cadastro fechado etc.) e conexão ao projeto Supabase exato.
- Redução de capacidade do carrinho quando houver reservas futuras; manutenção/transferência de equipamentos.
- Momento de atribuição dos identificadores de notebook ainda desconhecidos na separação física.
- Regras de edição retroativa após data de uso e padrão de arquivo de importação/exportação.
- Definir se a primeira entrega apresentável precisa incluir a visualização 3D ou se a Fase 3 já basta; a ordem acima adia o 3D para acelerar a entrega funcional.

## Referências técnicas

- [Three.js](https://threejs.org/)
- [React Three Fiber — introdução](https://r3f.docs.pmnd.rs/getting-started/introduction)
- [TanStack Query — React](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Zustand — introdução](https://zustand.docs.pmnd.rs/learn/getting-started/introduction.html)
- [Documentação Supabase](https://supabase.com/docs)

Este arquivo documenta uma escolha de stack e um roteiro. **Não significa que dependências, banco ou interface tenham sido implementados.**

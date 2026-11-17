# Educart — padrão de navegação para cadastros

**Issue:** #23 · **Branch:** `feat/ux-cadastros-listagem` · **Dependência:** PR #22 (redesign de Reservas).

## Problema

Antes, as telas de Carrinhos, Professores e Notebooks exibiam simultaneamente o formulário de cadastro e os registros já existentes. Isso deixava a consulta lenta, principalmente no celular, e fazia a listagem ficar abaixo do formulário. O mesmo padrão ocorria no portal de solicitações e na autorização de contas de professores.

## Solução

A tela principal de qualquer cadastro é uma **listagem**. Um botão principal abre um formulário próprio, que substitui temporariamente a listagem. Ao concluir, a pessoa volta à listagem, com atualização dos registros e confirmação de sucesso. A edição reaproveita o mesmo formulário com os valores já preenchidos.

### Carrinhos

- Tela inicial: nomes, códigos, capacidade configurada, busca e ação Editar.
- Ação primária: **Cadastrar carrinho**. Campos Código, Nome e Capacidade ficam apenas no formulário.
- Salvar retorna à listagem e atualiza a consulta TanStack Query.

### Professores

- Tela inicial: nome, identificador interno, busca e ação Editar.
- Ação primária: **Cadastrar professor**, que abre formulário separado.
- Mantém validação de nome e identificador existente; sem alterar RLS.

### Notebooks

- Tela inicial: códigos de notebooks e identificação do carrinho correspondente, filtro por laboratório e busca.
- O filtro exibe capacidade cadastrada, códigos ativos e posições sem código — sem confundir a contagem com saldo disponível para reservas.
- Ação primária: **Cadastrar notebooks**. O formulário permite escolher carrinho, entrada manual, gerar códigos e importar CSV/XLSX, com prévia revisável e verificação de duplicidade/capacidade.
- Ao salvar, retorna à lista filtrada pelo carrinho editado.

### Solicitações do professor

- Tela inicial: **Pedidos de reserva**, com lista de solicitações e estados de aprovação.
- Ação **Nova solicitação** abre formulário próprio. Ao enviar, volta à lista; pedidos pendentes continuam sem ocupar capacidade.
- Contagem de disponibilidade e validação continuam no formulário e no PostgreSQL, respectivamente.

### Autorização de contas pela TI

- A área Solicitações mostra a fila de decisões e a lista de contas vinculadas.
- Ação **Vincular conta** abre formulário separado para escolher o professor e informar o e-mail já confirmado.
- Salvar volta à fila e mantém a lista de contas atualizada. Nenhum usuário recebe autorização automática.

## Critérios técnicos

1. Componentes `CartsPage`, `RequestersPage` e `NotebooksPage` foram separados do `App.tsx`, com carregamento sob demanda.
2. `RecordsHeader` reutiliza o layout do título, descrição, botão Cadastrar e botão Voltar; `catalog.ts` centraliza leitura dos cadastros.
3. Estados locais controlam listagem versus formulário, sem gerar rotas novas, tabelas ou alterações no Supabase.
4. Mutations continuam na SDK Supabase e invalidam as queries; a permissão no backend não muda.
5. Listagem inicial e formulários responsivos em 320/360/390/768/1024/1280px; botões com mínimo de 44px.
6. Usuários não autorizados continuam sem acesso a essas páginas, independente da navegação.

## Validação

- [x] Carrinhos, professores e notebooks: listagem e formulário separados.
- [x] Pedidos do professor e vínculo de contas da TI: listagem e formulário separados.
- [x] Importação, geração e validação dos códigos preservadas.
- [x] Testes Playwright adaptados e novos testes de lista, edição, retorno, filtros e layouts móveis adicionados.
- [ ] TypeScript/Vite, Vitest, Playwright e GitHub Pages aprovados no commit final.
- [ ] Homologar visualmente no celular físico e testar com conta administrativa/professor real.
- [ ] Revisar PR e integrar após dependências #10–#22.

**Sem migrações e sem modificações de dados.**

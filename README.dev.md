# Educart — ambiente de desenvolvimento (Fase 1)

A aplicação administrativa utiliza React, TypeScript, Vite, Tailwind, Zod, Zustand, TanStack Query e Supabase.

## Executar localmente

1. Instale Node.js (versão LTS compatível).
2. Execute `npm install`. No primeiro ambiente com acesso ao registro npm, gere e versione o `package-lock.json`.
3. Copie `.env.example` para `.env` e configure **somente** a chave pública (publishable) do projeto Educart.
4. Execute `npm run dev`.

Projeto Supabase: `tsruibcrvnxiwgrfrecu`, organização Dev da conexão Myhouse. Não reutilize a chave `service_role` nem outras credenciais privadas no frontend.

## Provisionar os administradores

A migração cria a tabela `public.admin_users`, mas **não cria usuários**. O responsável deverá criar/confirmar cada conta pelo Supabase Auth e registrar o UUID real dessas contas em `admin_users` mediante operação administrativa segura, após validar quem são os administradores. Usuários comuns não podem se promover pela interface: RLS restringe leitura e não oferece inserção/edição em `admin_users`.

## Limites da fase

A aplicação já contém base de autenticação e cadastros de carrinhos, solicitantes e notebooks, com geração e importação **CSV/XLSX** com revisão, validação e suporte a colunas com cabeçalho `codigo`/`código`/`code`. A quantidade de códigos não altera a capacidade configurada. A função de reservas e a visualização 3D ainda pertencem a fases posteriores.

**Verificações:** o PR #10 já executou build e testes unitários com sucesso no GitHub Actions; novas alterações devem passar pela mesma CI. O registro npm permanece inacessível no ambiente local utilizado. O administrador inicial foi provisionado após confirmação do e-mail. Testes E2E usam respostas simuladas (sem credenciais reais); a validação de permissões com sessões reais e a aprovação visual em dispositivos continuam necessárias. Não disponibilizar em produção antes disso.

## Importação de planilhas

Na tela Notebooks, selecione um carrinho e importe CSV ou XLSX (primeira aba). A coluna pode se chamar `codigo`, `código` ou `code`; sem esse cabeçalho, a primeira coluna é usada. Revise os códigos importados antes de salvar. O limite é de 2 MB e 1.000 códigos por arquivo; dados duplicados e acima da capacidade são rejeitados. Identificadores com zeros à esquerda devem ser armazenados como texto no Excel.

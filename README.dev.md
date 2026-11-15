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

A aplicação já contém base de autenticação e cadastros de carrinhos, solicitantes e notebooks, com geração e importação **CSV** simples e revisão. A quantidade de códigos não altera a capacidade configurada. A função de reservas e a visualização 3D ainda pertencem a fases posteriores.

**Importante:** este código foi produzido pelo conector GitHub. Não houve execução local de `npm install`, `npm run build` ou testes, porque o ambiente utilizado estava sem acesso ao registro npm. Não considerar pronto para produção sem essas verificações e sem os administradores provisionados.

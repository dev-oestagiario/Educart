# F1.4 — Ambiente isolado de homologação

## Constitution / Specify
Separar completamente dados reais de dados sintéticos, testar Supabase Auth, RLS e RPCs reais com JWT emitidos pelo serviço e validar migrations em banco descartável. Não copiar dados de produção, não usar credenciais cloud, não aplicar migrations no projeto remoto durante homologação. Não contratar serviços sem aprovação de custo.

O inventário remoto confirmou que não existe segundo projeto Educart nem branch de desenvolvimento no Supabase. Foi escolhida a alternativa local/CI com Docker e PostgreSQL 17 (mesma versão major da produção, 17.11); não é um ambiente cloud permanente nem deve ser exposto à internet.

## Plan
- Supabase CLI fixado em 2.79.0 no workflow, configuração local versionada e oito migrations existentes reproduzidas automaticamente no start.
- Auth local com confirmação de e-mail, JWT de 1h e senha mínima de 8 caracteres; banco PostgreSQL 17, capturador local de e-mail Inbucket. Não pressupõe que as configurações de produção estejam iguais.
- Frontend no modo homologacao somente aceita URL loopback na porta 54321; arquivo de exemplo sem chaves. Não usar VITE_ com service_role.
- Workflow homologacao.yml separado do mock Playwright, sem credenciais de produção; runner efêmero, dados sintéticos e teardown.
- Script scripts/homologacao-auth.mjs usa o status JSON da CLI, valida URL local e usa uma chave privilegiada exclusivamente no bootstrap Node do ambiente local. Cria senhas aleatórias em memória, quatro contas confirmadas (TI, professor A, professor B, sem vínculo) e autentica por senha; sem emitir logs com senhas, JWTs e chaves.
- Teste de RLS e RPC contra PostgREST e Auth reais: autoelevação bloqueada; criação autorizada de carrinho e professores; vínculo pela TI; visibilidade própria A/B; leitura e escrita anônimas bloqueadas em tabelas; conta sem vínculo bloqueada; aprovação exclusiva da TI; consulta pública agregada, saldo antes/depois da confirmação; notificação apenas ao destinatário; tentativa de alteração de aviso alheio bloqueada; revogação de vínculo eficaz para acesso às solicitações e novas solicitações.
- Mantém política de notificações antigas consultáveis pelo destinatário após revogação, documentada na F1.1; não promete revogar todo token imediatamente.

## Executar localmente
Pré-requisitos: Docker em execução, Node.js 22, npm e Git. Clone o repositório, entre na pasta do Educart e execute:
```bash
npm ci
npx --yes supabase@2.79.0 start
npx --yes supabase@2.79.0 status -o json > .env.homologacao.status.local
node scripts/homologacao-auth.mjs
```
O status JSON contém chaves **locais**; arquivo ignorado pelo Git. Não compartilhe seu conteúdo. O script não aceita URL remota. Para recomeçar com dados limpos use, exclusivamente no stack local, `npx --yes supabase@2.79.0 db reset --local` (apaga os dados locais); não use em projeto vinculado.

Para testar a interface: copie .env.homologacao.example para .env.homologacao.local e preencha somente com a chave ANON_KEY ou publishable do stack local. Rode:
```bash
npm run dev -- --mode homologacao --host 127.0.0.1 --port 5173 --strictPort
```
Acesse http://127.0.0.1:5173/. Para criar contas manuais, utilize Studio local e dados fictícios; admin_users deve ser provisionada explicitamente pelo administrador local com o user_id correto. Studio: http://127.0.0.1:54323; caixa de e-mail local: http://127.0.0.1:54324. Não publique esses serviços nem exponha portas à rede institucional.

## Tasks / Aceite
- [x] Configuração versionada e migrações locais existentes.
- [x] Ambiente explícito de frontend, bloqueio de URL remota nesse modo e arquivos ignorados.
- [x] Script de testes Auth real com dados sintéticos, workflow isolado e teardown.
- [ ] Confirmar primeira execução completa do workflow e aprovação dos testes.
- [ ] F2: ampliar CRUD completo, concorrência, relatórios e importação; testar recuperação de senha pelo capturador local; ensaiar restauração.
- [ ] Aceite de usuários reais em ambiente autorizado, envio de e-mail e redirect no Supabase hospedado, proteção contra senhas vazadas e rate limits; dependem de configuração não acessível no conector.
- [ ] Avaliar ambiente cloud permanente apenas se necessário; custos e autorização antes da criação.

Não houve alterações ao Supabase remoto. Não vincular o ambiente local ao banco de produção nem usar db push. Documentação oficial: https://supabase.com/docs/guides/local-development/cli-workflows

Próxima fase após validação: F2.1 — homologação de cadastros e reservas.

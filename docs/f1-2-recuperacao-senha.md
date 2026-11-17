# F1.2 — Recuperação e redefinição de senha

**Objetivo:** permitir que professores e TI recuperem acesso pelo Supabase Auth sem concessão automática de privilégios.

## Fluxo
1. Login → Esqueci minha senha → e-mail → enviar instruções.
2. Resposta neutra para endereços cadastrados, desconhecidos ou rejeitados pelo serviço. Não confirmar existência de conta nem prometer envio confirmado.
3. Supabase valida o link de recuperação, redireciona para a raiz da aplicação (sem hash de navegação) e o SDK processa o callback de Auth.
4. A página de redefinição tem prioridade sobre login/admin/professor. O formulário exige evento PASSWORD_RECOVERY e sessão correspondente, não apenas a URL. Link inválido/expirado, rota direta e recarga após consumo não autorizam nova redefinição.
5. Nova senha com mínimo de oito caracteres e confirmação; requisitos adicionais do servidor prevalecem. updateUser valida junto ao Auth. Após sucesso, logout global e retorno ao login. Falha no logout mantém a página isolada e permite repetir o encerramento.
6. O acesso continua sujeito às políticas existentes e aos vínculos administrativos/professor. Nenhuma alteração de tabelas, grants ou dados.

## Configuração / homologação
- Auth → URL Configuration: validar Site URL e Redirect URLs com https://dev-oestagiario.github.io/Educart/ (barra final). Em homologação, cadastrar apenas a origem exata autorizada. Não use wildcard amplo.
- Preservar o template de recuperação padrão que contém ConfirmationURL, apropriado ao SDK cliente atual (implicit flow). Se o projeto usar template customizado com token_hash ou PKCE, adaptar antes de disponibilizar; não assumir compatibilidade.
- Verificar envio de e-mail real, SMTP, quotas, expiração e revogação de sessões. O conector não expõe configurações do Auth URL/SMTP; não foi alterado o ambiente remoto.
- Nunca publicar tokens, senhas, links de recuperação ou e-mails de usuários em logs/prints. Usar contas de teste autorizadas.
- Uma tentativa de recuperação não altera função de acesso do usuário; login e RLS continuam independentes.
- Documentação: https://supabase.com/docs/guides/auth/passwords e https://supabase.com/docs/guides/auth/redirect-urls.

## Testes
- Unitários: reconhecimento de callback/rota, redirect sem parâmetros sensíveis, tamanho e confirmação de senha.
- Playwright com backend simulado: solicitação neutra, mobile, callback válido e inválido, alteração de senha, logout, retorno ao login.
- Pendente: teste ponta a ponta com e-mail real, link recebido, nova senha, revogação e preservação de papéis. O teste simulado não comprova entrega de e-mail nem configuração de redirect.

Próxima etapa: F1.3 — proteção de autenticação e dependências.

# F1.3 — Proteção da autenticação e dependências

## Objetivo e escopo
Aumentar a segurança sem mudar os papéis administrativos e de professor, preservar consulta anônima e registrar evidências. Nenhuma alteração de configuração Auth ou banco nesta fase.

## Auditoria de dependências
CI 44109581410, job 134131187945: npm audit reportou 6 entradas (3 críticas, 2 altas, 1 moderada). Atualizações fixadas: jsPDF 3.0.3 → 4.2.1, Zod 4.1.12 → 4.6.7, Vite 7.1.9 → 7.3.8, Vitest 3.2.4 → 5.1.0. A tentativa Vitest 3.2.7 manteve 3 entradas (2 críticas, 1 moderada); a versão 5.1.0 resolve também os alertas transitivos de mocker e tinypool. CI 44110244073 job 134133655534: zero entradas de vulnerabilidade, build e 68 testes unitários passaram. Lockfile npm gerado no runner e versionado (238 entradas). Verificação final com npm ci e testes E2E necessária antes de integração. CI de PR/main e publicação passam a executar npm run audit, falhando em severidade alta/crítica. Vulnerabilidades novas exigem nova avaliação; zero alertas não equivale a segurança absoluta.

## Auth e frontend
- Novas contas: senha mínima de oito caracteres alinhada à recuperação; não bloquear login de contas existentes.
- Prevenir submissões simultâneas de formulário e configurar autocomplete adequado.
- Limpar cache e navegação em mudança de identidade/logout; revalidar autorização no foco e a cada minuto. O servidor/RLS permanece responsável por autorizar operações.
- Referrer policy no-referrer para evitar propagação de URLs de callbacks.
- Teste adicional de cadastro com senha curta e login existente; manter testes de recuperação.
- A limitação de tentativas no cliente não impediria chamadas diretas à API. Usar limites e CAPTCHA do Auth, conforme necessidade e configuração. Não ativar CAPTCHA sem integração e chaves autorizadas.

## Supabase
Advisor: 1 alerta SECURITY DEFINER anon, 14 authenticated, proteção contra senhas vazadas desativada. As funções intencionais e suas restrições foram revisadas em F1.1. A função pública mantém janela máxima de 35 dias por chamada; isso não representa rate limit por origem. Limites reais de Auth, senha mínima no servidor, proteção contra senhas comprometidas, CAPTCHA, configurações SMTP/redirect e política de limitação de abuso da API precisam ser verificados no painel do projeto. O conector não disponibiliza atualização dessas configurações. Não reduzir limites globalmente sem medir consultas legítimas de até um ano. Não registrar senhas, JWTs ou dados pessoais em logs.

## Aceite pendente em homologação
- Confirmar proteção contra senhas vazadas (se suportada pelo plano), política mínima do servidor, expiração, limites de envio e tentativas, redirecionamentos Auth.
- Validar troca de identidade, revogação de vínculo e isolamento com sessões reais.
- Definir mitigação de abuso da RPC pública no servidor/gateway, com teste de carga autorizado e sem prejudicar o uso institucional.
- F1.4: ambiente de homologação separado e credenciais de testes autorizadas.

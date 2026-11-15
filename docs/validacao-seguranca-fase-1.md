# Educart — validação de segurança da Fase 1

**Data:** 15/11/2026  
**Escopo:** Supabase do Educart, projeto `tsruibcrvnxiwgrfrecu`.  
**Natureza:** leitura e simulação de perfil SQL, sem criar, editar ou excluir cadastros.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| RLS habilitado nas tabelas `admin_users`, `carts`, `requesters` e `notebook_codes` | Confirmado |
| Políticas de seleção definidas para administradores | Confirmado |
| Permissão direta de leitura por `anon` nas quatro tabelas | Não concedida |
| Identidade autenticada fictícia, não administrativa, com `SET LOCAL ROLE authenticated` | Nenhuma linha visível nas quatro tabelas |
| Identidade administrativa existente, com `SET LOCAL ROLE authenticated` | `app_private.is_admin()` retornou verdadeiro; consultas permitidas |
| Alterações permanentes nos dados durante as consultas | Nenhuma (transações somente leitura com rollback) |

Esses testes verificam o comportamento SQL de RLS com perfis simulados e complementam os testes Playwright em backend simulado. **Não equivalem a autenticação real com JWT no navegador.**

## Repetição segura do teste de bloqueio

Execute somente no SQL Editor do projeto Educart, por operador autorizado, em transação de leitura:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000000', true
);
SELECT
 (SELECT COUNT(*) FROM public.admin_users) AS admin_users,
 (SELECT COUNT(*) FROM public.carts) AS carts,
 (SELECT COUNT(*) FROM public.requesters) AS requesters,
 (SELECT COUNT(*) FROM public.notebook_codes) AS notebook_codes;
ROLLBACK;
```

O resultado esperado é zero para as quatro tabelas. Essa consulta não testa o fluxo completo de login e **não deve ser usada para elevar permissões de usuários**.

## Pendências de segurança

- O Security Advisor do Supabase ainda sinaliza **Leaked Password Protection Disabled**. Ativar nas configurações de segurança do Auth, conforme [documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Realizar teste com uma conta não administrativa real e outra administrativa real usando o aplicativo e, separadamente, requisições REST com os próprios tokens de cada conta. Não compartilhar senhas nem tokens em issues, logs ou chats.
- Revisar permissões de inserção/edição/remoção pela API e a expiração de sessão. Uma UI escondida não substitui RLS.
- Validar o menu e cadastros num dispositivo móvel físico e registrar a revisão do PR #10 antes de integrar na `main`.

## Observação

Os testes automatizados existentes usam dados fictícios e não devem fazer alterações no banco de produção. A autorização administrativa tem de continuar sob controle da TI no Supabase.

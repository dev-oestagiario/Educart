## Objetivo

- Issue / especificação:
- Alteração e impacto:

## Git Flow

- [ ] Trabalho normal a partir de develop, PR para develop.
- [ ] Se destino main: branch release/* ou hotfix/*, escopo congelado e autorização explícita.

## Validação

- [ ] Testes de regressão relevantes, typecheck e build.
- [ ] CI, Playwright, homologação isolada e recuperação aplicáveis concluídos.
- [ ] Sem credenciais, dados reais ou mutações em produção.
- [ ] Limitações, riscos, migrations e rollback documentados.

## Apenas promoção

- [ ] Aceite e SHA final verificados; deploy manual separado do merge.
- [ ] Após publicação, smoke e sincronização main → develop.

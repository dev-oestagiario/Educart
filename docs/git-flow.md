# Git Flow — Educart em produção

## Branches

| Branch | Finalidade | Origem | PR de destino |
| --- | --- | --- | --- |
| `main` | Código de produção aprovado | Promoções controladas | — |
| `develop` | Integração e desenvolvimento | Main na adoção | — |
| `feature/*` | Funcionalidades | develop | develop |
| `fix/*`, `bugfix/*` | Correções normais | develop | develop |
| `docs/*`, `chore/*`, `refactor/*`, `test/*` | Documentação, manutenção e testes | develop | develop |
| `release/*` | Congelar candidata, QA e correções de entrega | develop | main, depois sincronizar develop |
| `hotfix/*` | Incidente urgente em produção | Commit realmente publicado, conferir diferença de main | main, depois sincronizar develop |

A criação de uma branch ou merge de desenvolvimento não autoriza publicação, migrations no ambiente hospedado ou alteração de dados reais. A produção é identificada por `version.json` e pelo histórico Pages, não necessariamente pelo último commit da main.

## Desenvolvimento e revisão

1. Atualizar develop, criar branch de trabalho e implementar em escopo pequeno.
2. Executar testes locais relevantes, typecheck/build, revisão e testes de regressão. Abrir PR para develop; exigir CI de verificação, Playwright, homologação real e recuperação, conforme o caso. A regra Git Flow exige origem no mesmo repositório e prefixo autorizado.
3. Não integrar PR com verificação em andamento, falha ou skip indevido. Não usar `[skip ci]` para alterações de aplicação ou para candidatos de release.
4. Integrar por merge de PR, sem force push. Develop não é produção nem pode publicar no GitHub Pages.

## Release

1. Criar `release/<versão>` a partir de develop com escopo congelado. Atualizar changelog e versão quando aplicável. Validar conteúdo, migrations compatíveis, segurança, recuperação e aceite, incluindo riscos operacionais documentados. Não misturar trabalho novo.
2. Abrir PR da release para main. Exigir checks verdes, revisão e autorização expressa do responsável. Não presumir aceite institucional ou backup a partir de teste sintético.
3. Merge na main somente após aprovação. Conferir SHA final e repetir verificação, homologação real e recuperação sintética nesse SHA. Se falhar, corrigir por nova release/hotfix; não publicar.
4. Em [Actions Variables](https://github.com/dev-oestagiario/Educart/settings/variables/actions), configurar `EDUCART_APPROVED_RELEASE_SHA` com SHA exato aprovado. Disparar Pages manualmente em main com `approved_sha` igual ao valor. O workflow exige sucesso dos três pipelines de push no SHA e executa os checks de publicação. Nunca alterar variáveis para promover versão não autorizada.
5. Conferir version.json, saúde, rotas e smoke sem dados de teste em produção. Criar tag/release após publicação e aceite. Sincronizar main em develop por PR antes da próxima release.

## Hotfix

Em incidente real, confirmar o SHA publicado e inventariar diferenças da main. Criar branch do código em produção, corrigir somente o incidente e testar. Se main contiver alterações ainda não publicadas, revisar a composição antes de integrar; nunca promover incidentalmente mudanças não aprovadas. O PR hotfix para main segue as mesmas travas de CI, autorização e Pages. Após publicar, incorporar a correção em develop. Não usar force push nem deploy paralelo.

## Proteção administrativa (necessita configuração por proprietário)

No GitHub, criar rulesets ativos para main e develop, sem bypass de rotina: exigir pull request, aprovação por revisor habilitado quando houver equipe, resolução de conversas, checks obrigatórios e branch atualizada. Bloquear force push e exclusão. Checks: `git-flow`, `verify`, `e2e`, `homologacao` e `recuperacao`. O check Git Flow precisa ter executado antes de ser escolhido. Mantenha os requisitos compatíveis com o tamanho da equipe; não simule aprovação de outro revisor. Definir develop como branch padrão para novos PRs quando autorizado pelo proprietário. Restringir o ambiente github-pages a main e manter aprovação do SHA. O workflow não substitui rulesets: sem proteção administrativa, um proprietário ainda pode efetuar push direto.

Adoção: 18/11/2026. Produção confirmada no SHA `074096360108f119f67b2acb80807b6119bcd06c`. Develop criado a partir da main `ab593a8576cba55f9dafe70cc47ea0a77fb6b236`, que contém o README e a correção de login ainda não publicados. Essa diferença não é autorização de deploy. As convenções e checks novos entram na main apenas na próxima promoção autorizada.

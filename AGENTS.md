# Orientações para agentes — Educart

Este repositório inclui 27 skills de Matt Pocock e uma skill específica de front-end do Educart em `.agents/skills/`. Em tarefas pertinentes, leia o `SKILL.md` da skill relevante e seus documentos auxiliares antes de implementar.

## Fluxo de desenvolvimento

- A partir de 18/11/2026, seguir obrigatoriamente [Git Flow](docs/git-flow.md). `develop` é a base de trabalho; `main` é a referência de produção. Não desenvolver, commitar ou enviar diretamente à `main`.
- Criar `feature/*`, `fix/*`, `docs/*` ou `chore/*` a partir de `develop` e abrir PR para `develop`. Somente `release/*` ou `hotfix/*` revisados podem promover à `main`, com autorização explícita. Sincronizar `main` de volta em `develop` após promoção.
- Não aplicar migrations nem testar com escrita no Supabase de produção a partir de `develop`. Homologação usa stack descartável separado. Publicação Pages permanece manual, vinculada ao SHA aprovado e CI completa.
- Preservar os controles administrativos de proteção de branches; nunca contornar revisão, checks, aceite ou autorização de deploy.

- Verifique primeiro o estado real dos arquivos e do projeto. Não suponha que já exista uma aplicação.
- Use `setup-matt-pocock-skills` quando for configurar convenções da equipe (GitHub Issues, labels e diretório de documentação) e registre as decisões adotadas.
- Para bugs, considere `diagnosing-bugs` e `tdd`; para mudanças grandes, `to-spec`, `to-tickets` e `implement-spec`; antes de integrar, `code-review` e `pr`.
- Evite alterar arquivos não relacionados. Valide testes e documentação aplicáveis antes de concluir.
- Use **apenas um** método de skills por agente: a cópia versionada `.agents/skills/` ou o plugin gerenciado do Codex, para evitar duplicação.

Referência de origem e licença: `.agents/skills/UPSTREAM_SOURCE.md` e `.agents/skills/UPSTREAM_LICENSE`.

## Front-end: planejamento e revisão obrigatórios

- Antes de criar, redesenhar ou alterar uma tela, leia `.agents/skills/educart-frontend/SKILL.md` e consulte `docs/planejamento-frontend.md`.
- Consulte as skills externas de design, boas práticas React e acessibilidade vinculadas na skill local; use-as como critérios de planejamento e revisão, sem substituir os requisitos do Educart.
- No desktop, a navegação é uma sidebar à esquerda; em celular, deve ser uma gaveta lateral acionada pelo cabeçalho, **não** uma navegação horizontal no topo.
- Garanta teclado, foco visível, fechamento com Escape, `prefers-reduced-motion`, estados de formulário e compatibilidade com toque.
- Faça build, testes, e validação visual em tamanhos de tela relevantes; não confunda CI de compilação com teste de layout.

# Educart

Sistema web de reserva e gestão de laboratórios móveis e notebooks. Painel da TI, portal de professores, calendário/relatórios e consulta pública sem autenticação.

- [Aplicação](https://dev-oestagiario.github.io/Educart/)
- [Consulta pública](https://dev-oestagiario.github.io/Educart/#/consulta-publica)
- [Roadmap F0–F6](docs/roadmap-finalizacao-educart.md) · [F0 — integração](docs/f0-integracao-baseline.md) · [Gêmeo digital V2](docs/educart-3d-v2.md)

## Executar localmente

Requer Node.js 22 e npm. Copie `.env.example` para `.env.local` e configure apenas URL e chave **publicável** do projeto Supabase autorizado; use projeto de homologação para testes manuais com escrita. Nunca use chave secreta ou service_role no navegador.

```bash
npm ci
npm run dev
```

Verificação antes de alterações:

```bash
npm run build
npm run test
npx playwright install chromium
npm run test:e2e
```

Playwright usa backend simulado; testes de autorização e concorrência reais são fases F1/F2. Migrations em `supabase/migrations/` devem ser aplicadas de forma controlada, sem repetir operações em produção.

## Fluxo de desenvolvimento e publicação

A baseline de integração está no PR #34. Novas alterações partem da main em branches próprias, com PR, CI e revisão. Não reutilize branches históricas para publicar. O pipeline de produção publica somente a main após testes e build, com metadados em `/Educart/version.json`. Prévias de PR são verificadas no CI, sem substituir produção. Em caso de regressão, reverter por PR preservando histórico. Acesso 3D antigo permanece oculto até a homologação do V2.


## Skills de engenharia

As skills de [Matt Pocock](https://github.com/mattpocock/skills) são mantidas em `.agents/skills/` para uso no projeto, incluindo engenharia de software, TDD, revisão de código, especificação, triagem e produtividade.

Para usar a instalação **gerenciada** como plugin do Codex, em vez da cópia local, execute no seu ambiente:

```bash
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock
```

**Escolha apenas um método por agente** (plugin gerenciado ou cópia local) para evitar skills duplicadas. O plugin gerenciado atualiza automaticamente; os arquivos locais são versionados neste repositório e precisam de atualização manual.

Fonte: [mattpocock/skills](https://github.com/mattpocock/skills). A licença MIT original está em `.agents/skills/UPSTREAM_LICENSE`.

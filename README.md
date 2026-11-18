# Educart

Sistema web de reserva e gestão de laboratórios móveis e notebooks. Painel da TI, portal de professores, calendário/relatórios e consulta pública sem autenticação.

- [Aplicação](https://dev-oestagiario.github.io/Educart/)
- [Consulta pública](https://dev-oestagiario.github.io/Educart/#/consulta-publica)
- [Roadmap F0–F6](docs/roadmap-finalizacao-educart.md) · [F0 — integração](docs/f0-integracao-baseline.md) · [Gêmeo digital V2](docs/educart-3d-v2.md)

## Acesso pelo navegador

Não é necessário instalar o Educart. Acesse o site no computador ou celular, usando navegador atualizado e internet. A consulta pública funciona sem login; professores e administradores precisam de conta e autorização institucional.

Os endereços acima são os previstos para publicação. A versão acumulada em preparação ainda não está homologada nem tem deploy confirmado.

## Manuais de uso

- [Manual do professor](docs/manual-professor.md) — criar conta, consultar disponibilidade, solicitar e acompanhar.
- [Manual do administrador](docs/manual-administrador.md) — cadastros, autorizações, reservas, manutenção, movimentações, calendário e diagnóstico.
- [Guia de acesso e suporte](docs/guia-acesso-suporte.md) — problemas de login e operação, abertura de chamado.

## Documentação exclusiva da equipe técnica

- [Arquitetura e operação](docs/arquitetura-operacional.md) — componentes, fluxo de dados, configuração técnica e homologação isolada.
- [Catálogo de migrations](docs/catalogo-migrations.md) — ordem, escopo e procedimento controlado de atualização.
- [Backup e recuperação](docs/f6-1-backup-recuperacao.md) e [monitoramento](docs/f6-2-operacao-monitoramento.md).
- [Checklist de publicação e reversão](docs/checklist-publicacao.md) e [matriz de aceite F5.6](docs/f5-6-homologacao-3d.md).

A configuração de ambiente ou ferramentas de desenvolvimento é responsabilidade dos mantenedores, não dos usuários. A baseline da integração está no PR #34; o desenvolvimento atual segue PRs encadeados com validação e revisão antes de promover à main. O pipeline Pages exige testes e build e registra versão em version.json. A publicação permanece bloqueada pelos gates de homologação; o ambiente 3D continua restrito ao desenvolvimento administrativo.

## Skills de engenharia (somente mantenedores)

As skills de [Matt Pocock](https://github.com/mattpocock/skills) são mantidas em `.agents/skills/` para uso no projeto, incluindo engenharia de software, TDD, revisão de código, especificação, triagem e produtividade.

Para usar a instalação **gerenciada** como plugin do Codex, em vez da cópia local, execute no seu ambiente:

```bash
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock
```

**Escolha apenas um método por agente** (plugin gerenciado ou cópia local) para evitar skills duplicadas. O plugin gerenciado atualiza automaticamente; os arquivos locais são versionados neste repositório e precisam de atualização manual.

Fonte: [mattpocock/skills](https://github.com/mattpocock/skills). A licença MIT original está em `.agents/skills/UPSTREAM_LICENSE`.

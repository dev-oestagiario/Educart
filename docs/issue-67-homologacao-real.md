# Issue #67 — Homologação real da candidata

Data: 18/11/2026. Base: PR #74. **Status: executor preparado e verificado; homologação Auth/PostgREST real bloqueada por infraestrutura.** Não declarar aceite da release.

## Escopo e critérios

Separar dados, credenciais e histórico de homologação dos de produção. Usar apenas um stack novo, descartável, sem link a projeto hospedado, com contas e registros sintéticos. Não usar dados reais, credenciais do projeto hospedado, migrações remotas ou emissão de e-mail externo. Não contratar serviço nem instalar componentes de sistema (Docker/WSL) sem aprovação.

## Diagnóstico dos executores

| Executor | Evidência | Resultado |
|---|---|---|
| CQP-KAINA-72 (Windows) | Docker/Podman/psql não encontrados, WSL não instalado. Chromium existente. | Suítes locais simuladas e análise do executor viáveis; stack Docker real indisponível. |
| localhost (Termux, Debian 13 ARM64 em PRoot) | Supabase CLI fixado em 3.2.0, help do comando start confirmou runtime native. Worktree isolado. | Falha na inicialização PostgreSQL, antes da API/Auth. |
| PCs kainao-pc e PCman | Offline na consulta. | Não utilizados. |

No localhost, a primeira tentativa nativa recusou a seção inbucket, substituída por local_smtp somente no worktree de teste para a CLI 3.x. A segunda recusou nobody (uid 65534). Com a conta não-root existente no Debian, o runtime baixou artefatos e iniciou initdb, mas falhou com `FATAL: could not create shared memory segment: Input/output error`, chamada shmget, e erros do helper --shm-helper em PRoot. Exit 1; portas loopback 54321/54322 recusaram conexão ao final. Nenhuma migration executada nesse stack. Não insistir no mesmo ambiente nem alterar limites/kernel/privilégios para contornar a falha. Arquivos/configuração experimental isolados no worktree descartável; não versionados. CLI 2.79.0 e config original permanecem no repositório/CI.

## Executor da homologação

`npm run test:homologacao:preflight` verifica regras de entrada e relatório sem rede.

`npm run test:homologacao` agrupa 11 suítes reais de integração (7 API e 4 navegador). `npm run test:homologacao -- api-only` executa as sete suítes API e nunca representa aprovação integral.

- Verifica opt-in explícito EDUCART_DISPOSABLE_HOMOLOGACAO=educart-homologacao; rejeita arquivo de vínculo, credenciais cloud conhecidas e URLs externas/portas alternativas; exige status local API 54321 e DB 54322, e chaves de papéis diferentes.
- Consulta Auth e entidades básicas para recusar stack não vazio/inacessível e verifica canal de e-mail desativado. Esses controles são complementares: o operador deve garantir que o stack loopback seja realmente isolado e descartável, não um proxy/túnel para produção.
- Cada suíte tem timeout e resultado agregado PASS/SKIP/FAIL; qualquer skip ou ausência de PASS impede aceite. Não imprime stdout/stderr dos filhos (assertions podem revelar dados de teste e credenciais).
- Nova suíte real F3.5/F5.1: contas sintéticas autenticadas, recorrência com conflito e rollback, exceções, edição/cancelamento, resumo/detalhe 3D, acesso negado por erro 42501 (não mero RPC ausente), consistência pública, fila de e-mail privada e canal desligado. A execução real ainda não ocorreu.

## Matriz de 11 suítes

| Suíte | Cobertura |
|---|---|
| homologacao-auth | Quatro identidades reais, grants/RLS, isolamento e revogação |
| homologacao-cadastros-reservas | Cadastros, ciclos e saldo |
| homologacao-concorrencia | 33 pares de disputas, criação/edição/aprovação |
| homologacao-localizacoes | Guarda/destino, hierarquia, privacidade |
| homologacao-manutencao | Bloqueio, conflitos e concorrência |
| homologacao-movimentacoes | Retirada/devolução, idempotência, concorrência |
| homologacao-recorrencia-espacial | Série atômica, espaço, permissões e canal opcional |
| homologacao-browser | Login, importação, cadastros, reservas e auditoria |
| homologacao-professores | Professores, decisões, notificações e isolamento |
| homologacao-relatorios | CSV, PDF, volume e filtros |
| homologacao-mobile | Chromium/WebKit em cinco perfis |

## Reprodução futura autorizada (máquina Linux com Docker)

Usar clone novo sem link e sem arquivo .env real. A preparação permanece procedimento de mantenedor, não de usuário final. Confirmar versão/ajuda da CLI, permissões, portas locais livres e capacidade do executor. Instalar dependências pelo lockfile, navegadores de teste e Poppler (PDF). Não utilizar `supabase link`, `db push` ou flags remotas.

```sh
npm ci --no-audit --no-fund
npm run test:homologacao:preflight
npx --yes supabase@2.79.0 start
umask 077
npx --yes supabase@2.79.0 status -o json > .env.homologacao.status.local
npx --yes supabase@2.79.0 migration list --local
EDUCART_DISPOSABLE_HOMOLOGACAO=educart-homologacao npm run test:homologacao
```

Comparar histórico com os 13 arquivos do repositório. Não imprimir status JSON nem chaves. Executar em dia útil para evitar SKIP de movimentações. Encerrar somente o stack descartável identificado com `npx --yes supabase@2.79.0 stop --no-backup` e remover o arquivo de status. Não interromper stacks alheios. Upgrade desde baseline efetiva, teste real do fluxo de recuperação de senha pelo e-mail local e ensaio de restore real mantêm evidência própria (não abrangidos integralmente pelo executor de 11 suítes); o script destrutivo de recuperação existente exige runner efêmero próprio, não fraudar suas guardas. A validação de configuração remota e aceite operacional não decorrem destes testes.

## Evidência obtida no PC

Worktree C:\programacao\Educart-issue67, commit c88d1f8aa1b6ac016ac390bdd4a992f6638a5bd1:
- npm ci limpo, 161 pacotes.
- Seis testes preflight **6/6**, exit 0; sintaxe de todos os scripts homologacao*.mjs aprovada.
- Execução sem configuração local corretamente recusada, exit 1, sem segredos.
- PGlite 0.5.16 em prefixo isolado: verificar-f5-6-sql e verificar-sql-local exit 0, 13 migrations, regras de negócio/RLS com claims simuladas, espaço, movimentos, recorrência e e-mail. Ensaio de recuperação exit 0; 28 tabelas/29 linhas sintéticas, arquivos corrompidos rejeitados, backup 567 ms e restauração 423 ms.
- **0/11 suítes reais executadas nesta rodada**: não há stack disponível. Não equivale a Auth/JWT, PostgREST, transações concorrentes entre conexões ou backup hospedado.
- Sem mudanças na aplicação, migrations ou lockfile; sem alteração de main, banco remoto, configuração do dispositivo, GitHub Actions, deploy ou release.

## Aceite restante

- [ ] Executor real aprovado, stack limpo com 13 migrations e histórico verificado.
- [ ] 11 suítes reais PASS, sem erros/skips; registrar SHA, versões e métricas agregadas.
- [ ] Validar upgrade da baseline efetiva e recuperação de senha com caixa local; restauração real rastreada em #68.
- [ ] Revisar resultados, corrigir divergências e encerrar #67 apenas mediante evidência.
- [ ] Manter #66 e demais bloqueadores P0; #68 pode progredir independentemente com preparação/ensaio controlado.

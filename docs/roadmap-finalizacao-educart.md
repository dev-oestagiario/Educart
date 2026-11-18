# Educart — Roadmap consolidado de finalização e evolução

**Data:** 17/11/2026 | **Estado:** planejado, não implementado por este documento.
**Base:** PR #32, branch `feat/consulta-publica-carrinhos`. Última CI conhecida: 41 testes Playwright aprovados, 2 testes antigos de 3D ignorados intencionalmente, build e unitários aprovados.
**Método:** Spec Kit (constituição → especificação → plano → tasks → implementação → verificação). Uma branch e um PR por fase/subfase entregável; não declarar concluído sem evidências.

Este roadmap substitui o roteiro informal F0–F5 de finalização; F0–F4 são preservadas, F5 passa a ser o gêmeo digital 3D V2, e produção passa a F6. A documentação histórica das fases 1–8 continua válida como evidência do desenvolvimento anterior, não como lista atual de pendências.

## 1. Constituição e limites

- PostgreSQL/Supabase é a fonte de verdade para capacidade, disponibilidade, reservas, manutenção e autorização. O 3D é uma projeção consultiva.
- Preservar a capacidade configurada independente da quantidade de códigos de notebooks conhecidos. Mudança por manutenção será explícita, transacional e auditada; não inferir redução por ausência de cadastro.
- Reservas agrupadas são atômicas; pedidos pendentes não ocupam saldo; fim de semana não é reservável; feriados úteis seguem a regra atual. Manter política vigente de edição e cancelamento; exceções/retroatividade exigem decisão explícita.
- A consulta pública continua anônima e agregada, sem nomes, observações, códigos individuais, localização interna detalhada ou histórico identificável. Nunca tornar dados administrativos públicos para alimentar o 3D.
- Layout responsivo, claro/escuro, acessibilidade, feedback de carregamento/erro/vazio e foco por teclado são requisitos transversais. Não esconder falhas como saldo zero.
- Migrations incrementais, sem apagar dados; verificar em ambiente de homologação e ter plano de reversão. Credenciais de servidor nunca no frontend ou logs.
- Não assumir telemetria, GPS ou inventário físico confirmado a partir de reservas ou objetos renderizados.

## 2. Diagnóstico e decisão de integração

Existem 15 PRs de implementação empilhados e ainda abertos no momento da revisão: #10, #11, #12, #13, #14, #16, #18, #20, #22, #24, #26, #28, #29, #31, #32. A main não possui package.json nem página pública. A branch final reúne as funcionalidades; o histórico de issues ainda não equivale a defeitos abertos. O deploy do último commit não está confirmado. Os testes E2E existentes simulam o backend, não substituem homologação com Supabase real.
 
## 3. Roadmap de execução

| Fase | Resultado | Dependência | Prioridade | Status |
|---|---|---|---|---|
| F0 | Baseline consolidada e CI reproduzível | Código atual | P0 | Pendente |
| F1 | Autenticação e segurança preparadas | F0 | P0 | Pendente |
| F2 | Homologação de ponta a ponta e concorrência | F1 | P0 | Pendente |
| F3 | Operação diária aprimorada e dados espaciais | F2 | P1 | Pendente |
| F4 | UI/UX coerente e acessível | F3 | P1 | Pendente |
| F5 | Gêmeo digital 3D V2 completo | F3.1, F3.2, F4 | P1 | Pendente |
| F6 | Produção, documentação e release v1.0.0 | F0–F5 | P0 | Pendente |

As fases F0–F2 são o caminho crítico para estabilizar a operação atual. O 3D antigo permanece oculto até a homologação do V2. Uma versão operacional estável pode ser publicada antes do V2, sem habilitar funcionalidades experimentais.

### F0 — Integração e organização

- [ ] F0.1 Inventariar PRs, conferir base/head, conflitos, workflows, migrations e diferenças da main. Registrar SHA e evidências.
- [ ] F0.2 Revisar CI do head acumulado; identificar falhas e corrigir regressões. Aprovar a cadeia na ordem de dependência ou consolidar preservando autoria e rastreabilidade dos PRs. Não mesclar cegamente nem duplicar migrations.
- [ ] F0.3 Integrar baseline validada em main, preservar tag/SHA recuperável, definir proteção de branch e verificações obrigatórias. Confirmar lockfile/instalação reproduzível.
- [ ] F0.4 Configurar Pages para publicar main exclusivamente após CI; separar preview/homologação de produção, confirmar hash de versão e rotas públicas. Não mover publicação antes da validação.
- [ ] F0.5 Revisar as 17 issues abertas; fechar apenas requisitos implementados e aceitos, mover pendências reais para o backlog.

**Aceite:** main contém a aplicação integral; build, testes e PRs rastreáveis; edição do README e mapa de versões; rota pública confirmada em navegador sem conta. Nenhuma perda de funcionalidades ou dados.

### F1 — Segurança e autenticação

- [ ] F1.1 Matriz de acesso anon/conta sem vínculo/professor A/professor B/admin; auditar RLS, grants e SECURITY DEFINER, search_path, validação de argumentos e proteção de dados.
- [ ] F1.2 Recuperar senha com fluxo de e-mail, URLs permitidas, expiração e feedback neutro; redefinir senha, preservar separação de papéis, logout e sessão.
- [ ] F1.3 Revisar proteção contra senhas comprometidas se suportada pelo plano, configurações de Auth, limitação de abuso da consulta pública e logs; auditar dependências e secrets sem divulgar valores.
- [ ] F1.4 Definir configuração de homologação e proteção de produção; acesso mínimo a assets e metadados espaciais. Documentar resultados, riscos residuais e procedimento de revogação de vínculo.

**Aceite:** matriz positiva/negativa testada via API com JWTs reais de contas de teste; nenhuma leitura cruzada, escrita anônima ou acesso administrativo de professor; fluxo de recuperação validado. Mitigar achados críticos antes de F2.

### F2 — Homologação funcional (dados controlados)

- [ ] F2.1 Fluxo real login → cadastro carrinho/professor/notebook → importação → reserva → edição/cancelamento → histórico. Validar limites e atomicidade.
- [ ] F2.2 Testes simultâneos de criação, edição, aprovação, redução de capacidade e códigos duplicados; confirmar bloqueios transacionais; nenhuma reserva parcial silenciosa.
- [ ] F2.3 Duas contas professor + TI: vincular, solicitar, prévia, aprovar/rejeitar/retirar, notificação e isolamento. Conferir cancelamentos e consistência pública.
- [ ] F2.4 PDF SENAI multipágina, acentos, impressão, CSV, cancelamentos, contagem, período e células longas; comparar com dados reais de homologação.
- [ ] F2.5 Desktop e celulares físicos: autenticação, consulta sem login, filtros dia→ano, navegação, teclado e contraste. Retestar cenários de erro e rede instável.
- [ ] F2.6 Testes de migration e restauração em ambiente separado; registrar casos, resultados e evidências. Nenhuma escrita destrutiva em produção para testar.

**Aceite:** casos críticos aprovados em ambiente real controlado, zero sobre-reserva/vazamento, CI verde, defeitos críticos resolvidos e aceite operacional da TI. Publicação estável opcional antes da evolução.

### F3 — Evolução operacional e fundação espacial

- [ ] F3.1 Localização: cadastro/edição/lista de campus, blocos e salas/ambientes; referência de local de guarda do carrinho separada de sala de destino da reserva. Setores e localização desconhecida não são inventados. Migração/backfill nullable; PDF e CSV mostram sala real somente quando informada; permitir manter reservas legadas.
- [ ] F3.2 Inventário e manutenção: modelar estado operacional e janelas programadas de indisponibilidade; indicar unidade/carrinho afetado, motivo e período, com auditoria. Rever transações de reserva e capacidade efetiva para todos os consumidores, inclusive disponibilidade pública e 3D. Bloquear conflitos com reservas futuras ou exigir resolução explícita antes de confirmar; preservar reservas existentes. Testes concorrentes e recuperação de saldo.
- [ ] F3.3 Retirada/devolução: registrar horário, responsável, quantidade/identificadores conhecidos, condição e observação; estados de movimentação separados dos estados de reserva; auditoria e operação idempotente. Não declarar localização real sem registro confirmado.
- [ ] F3.4 Dashboard: agenda de hoje, próximos usos, retiradas/devoluções pendentes, manutenção, solicitações; filtros úteis e atalhos existentes.
- [ ] F3.5 Recorrência: seleção de padrão semanal e término, prévia de datas, exceções, regras de dias úteis e validação transacional de todos os períodos; edição/cancelamento do agrupamento conforme regras vigentes.
- [ ] F3.6 E-mail opcional: notificações transacionais de pedido/decisão/entrega, opt-in/configuração e deduplicação; filas/retries idempotentes, logs sem dados sensíveis, custo e provedor aprovados antes de habilitar. Notificações internas permanecem fonte funcional.

**Aceite:** CRUD de localizações conforme restrições, sala exibida no relatório, manutenção jamais causa sobre-reserva, movimentações auditadas e recorrência previsível. F3.1–F3.2 são pré-requisitos de dados do 3D; F3.3–F3.6 podem ser entregues separadamente.

### F4 — UI/UX e coerência

- [ ] F4.1 Revisão de layouts e design tokens, claro/escuro, menus, inputs, botões, filtros, modais e estados.
- [ ] F4.2 Padronizar listagem → detalhe/formulário nos cadastros novos, preservar rotas e consulta pública com data inicial/final opcional.
- [ ] F4.3 Acessibilidade: teclado, foco, rótulos, 200% zoom, contraste, leitores de tela; viewport 320/390/768/1024/1440, altura reduzida e tema persistente.
- [ ] F4.4 Auditoria dos fluxos de reservas, professor e relatórios; revisar consistência visual e desempenho; corrigir defeitos.

**Aceite:** nenhuma rolagem horizontal geral, funcionalidades alcançáveis por teclado, tema coerente, ações sem duplicação e testes visuais/funcionais.

### F5 — Gêmeo digital 3D V2

Especificação técnica e plano de tarefas: [educart-3d-v2.md](educart-3d-v2.md). O requisito central é começar pela cena com **todos os carrinhos visíveis**, incluindo os não posicionados, sem seletor obrigatório de carrinho. Inspecionar cada equipamento pela cena ou lista acessível. O clique abre status e informações; entrar em inspeção revela o interior detalhado.
- [ ] F5.0 [Protótipo implementado e orçamento inicial](f5-0-prototipo-ambiente-3d.md); referências/medidas autorizadas e aceite visual ainda pendentes.
- [x] F5.1 [Modelo espacial persistente e contratos de leitura seguros](f5-1-fundacao-espacial.md). Validados localmente; stack Supabase completa e promoção pendentes.
- [ ] F5.2 [Visão geral multi-carrinhos implementada (validação parcial)](f5-2-visao-geral-3d.md); aguardando build e cenário E2E no PC conectado.
- [ ] F5.3 [Modelos GLB ilustrativos integrados](f5-3-assets-detalhados.md); validação técnica parcial, referência física e aceite visual pendentes.
- [ ] F5.4 [Inspeção interativa implementada](f5-4-inspecao-interativa.md); vínculos reais separados da geometria, validação visual e homologação pendentes.
- [ ] F5.5 [Otimização e responsividade implementadas](f5-5-otimizacao-3d.md); validação visual e GPU pendentes.
- [ ] F5.6 Testes, comparação com inventário físico, aceite visual da TI e reativação do menu somente quando aprovado.

**Aceite:** cena inicial com todos os carrinhos; cada um clicável; ambiente e interior detalhados; dados reais coerentes, posições fictícias identificadas; nenhuma reserva criada pelo renderizador; fallback acessível e desempenho medido.

### F6 — Prontidão de produção e v1.0.0

- [ ] F6.1 Configurar backup/restore conforme plano Supabase; ensaiar recuperação isolada, documentar RPO/RTO com responsáveis.
- [ ] F6.2 Observar erros frontend/RPC, saúde do deploy, desempenho e alertas operacionais; política de retenção/privacidade, não coletar segredos.
- [ ] F6.3 Atualizar README, manual TI/professor, documentação funcional e arquitetura, guia de ambiente, migrations, suporte e checklist de operação.
- [ ] F6.4 Executar regressão completa, validação de release, publicar Pages main, verificar rotas e banco, smoke tests; release/tag v1.0.0 e plano de rollback.
- [ ] F6.5 Encerrar issues aceitas, registrar limitações conhecidas, manter backlog futuro.

**Aceite:** versões e deploy rastreáveis; recuperação testada; aprovação de operação; release estável e documentação atual. Nenhum segredo, dado de professor ou planta interna publicado na rota pública.

## 4. Definições pendentes (não bloquear planejamento)

- Medidas, fotografias autorizadas e plantas das salas/carrinhos reais; escolha dos locais a representar e proprietário dos assets.
- Política para manutenção que colide com reserva futura, exceções de cancelamento e alterações retroativas; especificar antes da implementação correspondente.
- Provedor/custo de e-mail, ambiente de homologação, política de backup e critérios institucionais de privacidade.
- Dispositivos-alvo e escala máxima esperada da cena; metas propostas na especificação 3D precisam ser aferidas.
- Validação humana do nível de similaridade visual. O ambiente genérico não pode ser apresentado como réplica fiel do campus.

## 5. Próxima implementação

Começar por F0.1. Antes de cada subfase: confirmar branch e baseline; especificar regras/aceite; planejar mudanças, escrever tarefas; implementar em PR; executar testes; revisar e registrar evidências. Não executar merges nem migrations a partir deste documento sem iniciar a fase.

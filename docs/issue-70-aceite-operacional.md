# Issue #70 — Aceite operacional e dispositivos

Data: 18/11/2026. Base PR #77. **Validação técnica automatizada da candidata aprovada; aceite institucional e de dispositivos físicos pendentes.** Não representa homologação real do Supabase, certificação WCAG ou autorização de publicação.

## Constituição, escopo e responsáveis
- Preservar identidade violeta, regras de negócio, capacidade, acessibilidade, isolamento por perfil e ausência de exposição de dados. Não testar escritas em produção. Os testes automatizados usam exclusivamente fixtures e respostas Supabase simuladas.
- A TI responsável deve concordar com os critérios e aprovar os dispositivos/navegadores de referência, os modelos e vínculos físicos e a operação. Professores autorizados devem validar a jornada real com dados de homologação, não dados pessoais em evidências públicas. Não presumir aceite de pessoa/instituição nem criar conta real nesta etapa.
- Aprovação do núcleo operacional e autorização de exibir o 3D são gates distintos. Preservar flags exclusivamente administrativas/dev até aceite específico, sem habilitar menu de produção; e-mail opcional continua desligado.
- Para uso web não existe instalação de aplicativo por professor/administrador. Verificar manuais existentes e fluxo de acesso pelo navegador.

## Evidência obtida no PC conectado

Executor CQP-KAINA-72, Windows, Node 24.20.0. Worktree C:\programacao\Educart-issue70; npm ci instalou 161 pacotes, axe-core@4.11.1 instalado somente em prefixo isolado .local-sql-test. Backend simulado, Chromium headless, SwiftShader permitido na configuração de testes, sem certificação GPU física.

| Verificação | Resultado observado |
|---|---|
| Regressão completa no SHA 9eacb3e1797b4f86bece35f4bef02843a3918543 | 71 aprovados, 2 skips legados Fase 5 substituídos pelos testes F5.x, 0 falhas, 55,7 s, exit 0 |
| F4.3 axe-core | Scans de login, administração, formulários, calendário aberto, professor e consulta pública, temas claro/escuro; zero violações nos recortes automatizados |
| F4.3 teclado/reflow | Gaveta, salto de conteúdo, foco, Escape, calendário, 200% CSS e viewport equivalente aprovados |
| Fluxos | Cadastros/importação CSV/XLSX, reservas, manutenção, movimentações, recorrência, portal, notificações, disponibilidade, recuperação de senha simulada, relatórios e exportação |
| 3D integrado | F5.0/F5.1/F5.2, fallback GLB e ausência de WebGL, seleção, detalhe, histórico, porta virtual, qualidade/reflow, conta não autorizada |
| Novo teste #70 no SHA 525b3d2cb1f05c8e306769c1f9cdba2e0d265390 | 1 aprovado, 0 falhas, 6,1 s, exit 0 |
| 3D sintético sob carga | 120/120 carrinhos na cena e no lote instanciado, lista paginada (40), busca do último carrinho, seleção por teclado, qualidade automática econômica, alta manual, 12 detalhes, 570 draw calls, 13.596 triângulos, 4 frames acumulados, zero frames adicionais no intervalo ocioso de 1 s |

Total das duas execuções: 72 testes aprovados, 2 ignorados legados, sem falhas. Não afirmar execução da suíte combinada em uma única rodada. O novo teste adiciona somente cobertura; não altera runtime, dependências ou migrations. Captura PNG e JSON agregado sintéticos anexados ao teste #70 no worktree; não publicados externamente. Medidas são uma observação local da cena específica; não FPS sustentado, memória GPU, raycast físico, nem garantia em qualquer dispositivo.

## Supabase — inventário somente leitura via plugin Myhouse

Projeto Educart: 8 migrations no histórico remoto, 13 na candidata; 12 tabelas públicas, zero sem RLS, 23 políticas. Tabelas de manutenção e movimentações e RPC spatial_cart_summary ausentes no remoto observado. Nenhum branch de homologação separado. A consulta não acessou conteúdo de usuários ou reservas. Não aplicar as cinco migrations pendentes aqui; a #67 exige ambiente real isolado. A cobertura automatizada não comprova RLS/JWT/PostgREST/concorrência da candidata em ambiente real.

## Roteiro de aceite institucional (não executado fisicamente)

| ID | Papel / cenário | Critério para aceite manual | Estado |
|---|---|---|---|
| A70-01 | Público, TI, professor, conta sem vínculo | Consulta sem login, login/recuperação por caixa de teste, acesso por função, sessão encerrada, navegação e manuais corretos | Mock aprovado; Auth real #67 |
| A70-02 | TI cadastros e reservas | CSV/XLSX, busca/edição, reserva parcial/total, aprovação sem sobre-reserva, cancelamento e auditoria | Mock aprovado; #67 |
| A70-03 | TI operação | Local, destino, manutenção, retirada/devolução, idempotência e recorrência, saldo coerente com portal | Mock aprovado; #67 |
| A70-04 | Professor | Vínculo, pedido, consulta de saldo, aprovação/rejeição, notificação própria, revogação | Mock aprovado; #67 |
| A70-05 | Relatórios | Conferir PDF e CSV com filtros, paginação, textos extensos; impressão A4 física sem corte, cabeçalho, rodapé e legibilidade | Mock e PDF automatizado histórico #42; impressão física pendente |
| A70-06 | Desktop físico | Navegador institucional atualizado, resolução de referência, zoom real 200%, tema claro/escuro, mouse/teclado, navegação sem overflow | Headless passou; navegador físico/zoom real pendente |
| A70-07 | Celular físico | Android/Chrome e iOS/Safari se usados, orientação, toque, barra do navegador, teclado virtual, 320/360/390 px quando aplicável, rede instável e retorno de conexão | Viewports desktop simulados passaram; dispositivos reais pendentes |
| A70-08 | Acessibilidade | NVDA ou leitor disponível no desktop, TalkBack/VoiceOver onde aplicável, rótulos, estados, mensagens, ordem de foco, teclado, contraste, movimento reduzido e fluxo completo | Axe/teclado automatizado passou; leitor e usuário reais pendentes |
| A70-09 | Ambiente 3D | Conferir modelo/medidas/posições e vínculos autorizados com patrimônio real; seleção por clique/raycast, teclado e alternativa textual, saldos coerentes, fallback de WebGL e GLB | 120 objetos simulados + teste integrado passaram; validação física, raycast e banco real pendentes |
| A70-10 | Desempenho 3D | Em hardware aprovado, registrar navegador/GPU/resolução, quantidade de objetos, qualidade, amostras de frames durante interação, tempo de resposta, memória e perda de contexto; definir limites com TI e repetir em pelo menos baixa/alta | Métricas estruturais observadas; FPS/memória/gates físicos não certificados |
| A70-11 | Operação e suporte | Conferir disponibilidade, backup verificável e restore isolado, alertas, manuais e contatos aprovados, política de retenção e plano de rollback | #68/#69 e aceite pendentes |

### Registro de execução
Para cada cenário, registrar ID, SHA real, versão do schema, perfil sintético, tipo de dispositivo/navegador e versão, viewport/zoom, tema/rede/tecnologia assistiva quando pertinente, resultado PASS/FAIL/BLOCKED, evidência autorizada e issue da divergência. Não armazenar logins, senhas, e-mails reais, patrimônio identificável, capturas com dados pessoais, identificadores de usuário ou informações não necessárias no repositório. A aprovação nominal institucional fica no registro autorizado de TI, fora do Git público. Não marcar PASS apenas por presença da funcionalidade.

## Reproduzir
```sh
npm ci --no-audit --no-fund
npm install --prefix .local-sql-test --ignore-scripts --save-exact axe-core@4.11.1 --no-audit --no-fund
npm run test:e2e -- --workers=3 --retries=0
npm run test:e2e -- --grep 'Issue #70' --workers=1 --retries=0
```
Executar em clone/worktree isolado, com configuração de mock da Playwright e ambiente sem chaves reais. No Windows, usar node node_modules/@playwright/test/cli.js quando argumentos do shell exigirem. Logs locais educart-70-e2e.log e educart-70-load.log no diretório temporário do PC.

## Pendências e gate
- [ ] Homologação real #67, recuperação operacional #68 e alertas #69.
- [ ] Correção da auditoria completa #66.
- [ ] Aprovação dos requisitos A70-01–A70-11 conforme evidência real e responsáveis.
- [ ] Validação física, impressão, leitor de tela, GPU/FPS/memória, inventário/posição e aceite específico 3D; manter flags DEV.
- [ ] Aprovação explícita de publicação #71, sem alteração de main, deploy, tag/release, produção nem execução deliberada de Actions nesta fase.

A #70 permanece aberta. A #71 pode receber preparação final e conferência dos gates; não executar publicação enquanto bloqueadores P0 persistirem.

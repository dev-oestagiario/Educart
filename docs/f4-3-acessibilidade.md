# F4.3 — Acessibilidade e responsividade

## Escopo
Revisão incremental dos fluxos administrativos, professor e consulta pública, com critérios WCAG 2.1 A/AA automatizáveis. Preservar a marca e os temas, não alterar domínio ou dados.

## Entrega
- Menu móvel: conteúdo de fundo e skip link ficam inertes enquanto o diálogo está aberto; ciclo de Tab/Shift+Tab com controles visíveis, Escape e restauração do foco na abertura ou conteúdo principal.
- Skip links de TI e professor direcionam foco sem substituir o hash de navegação. Cabeçalhos de cadastros recebem foco quando o título muda. Foco visível também em detalhes.
- Calendário: restauração do foco após seleção, preset, conclusão e fechamento; instruções e quantidade selecionada anunciadas com aria-live. Seleção e desativação de fins de semana preservadas.
- Áreas de toque para limpar data final e fechar calendário, margem de rolagem do foco, redução de movimento. Sem ocultar overflow indiscriminadamente para mascarar problemas.
- Auditoria axe-core 4.11.1 instalada em diretório local ignorado, sem dependências novas no aplicativo. Testes axe são explicitamente ignorados em ambiente sem a ferramenta; para aceite, instalar e executar. Nenhuma integração remota ou GitHub Actions utilizada.

## Resultados locais
PC CQP-KAINA-72, C:\programacao\Educart: build aprovado, 85 Vitest, 5 testes worker, 59 Playwright aprovados e 2 skips legados de 3D. Quatro novos cenários: auditoria administrativa, teclado/foco, reflow/zoom, auditoria professor e público. 38 verificações axe sem violações nas configurações testadas: login escuro; 11 módulos administrativos e 4 estados adicionais de formulário/calendário em cada tema; consulta pública desktop clara; professor lista/recorrência e consulta pública mobile em cada tema. Dados sintéticos, backend simulado. Larguras 320/390/768/1024/1440, altura 450; zoom CSS 200% e viewport equivalente 720x450, persistência de tema. Não equivale a zoom nativo de todos os navegadores.

## Reproduzir
```powershell
npm.cmd install --prefix .local-sql-test --no-save --no-package-lock --ignore-scripts --no-fund --no-audit @electric-sql/pglite@0.5.16 axe-core@4.11.1
npm.cmd run build
npm.cmd test -- --run
node --test scripts/email-worker.test.mjs
npm.cmd run test:e2e
```
## Limitações / aceite restante
Axe não certifica conformidade WCAG integral. Teste humano com leitor de tela (NVDA/VoiceOver/TalkBack), zoom nativo, navegadores adicionais, estados/dados reais e dispositivos físicos pendente. Não instalar software assistivo sem autorização. Rótulos, aria-live e foco avaliados por DOM e teclado, não por síntese de voz. Sem novas migrations ou mudanças de produção. PRs anteriores, auditoria picomatch e homologação Supabase real pendentes. Próxima F4.4: revisão de fluxos completos e desempenho.

# F2.5 — Homologação em dispositivos móveis

## Escopo
F2.4 aprovada no run 44132142857, job 134211817515: 1.135 períodos ativos no CSV, agenda A4 com 17 páginas, observações longas, extração de texto, margens, rodapés e relatório vazio. PR #42 integrado na main (913d35c).
F2.5 amplia a homologação real dos fluxos mobile, usando o Supabase local e navegadores Chromium/WebKit com touch, sem copiar dados institucionais.

## Perfis emulados
| Perfil | Motor | Viewport CSS |
|---|---|---|
| Android compacto | Chromium | 320 × 640 |
| Android | Chromium | 360 × 760 |
| iPhone | WebKit | 390 × 844 |
| iPhone paisagem | WebKit | 667 × 375 |
| Tablet retrato | WebKit | 768 × 1024 |

Emulação de viewport, densidade 2 e eventos touch; não representa dispositivos físicos nem versões específicas de Android/iOS. As duas engines são instaladas pelo Playwright no runner Linux.

## Correções
- Controles críticos de tema, limpar data, atualizar e paginação com dimensão mínima de 44 px em telas móveis/touch.
- Campos de formulário de 16 px em mobile estreito para evitar zoom automático no foco em Safari; preservar zoom voluntário.
- Cabeçalho do professor e marca ajustáveis, espaçamento reduzido em telas de 320/360 px, filtro de data final sem truncar o botão de limpeza.
- Quebra do texto do botão de atualizar em tela estreita; manter calendário responsivo.

## Matriz de aceite
- Consulta pública sem sessão, dias selecionados, filtro por carrinho, limpeza de data final, temas e persistência de tema.
- Login e navegação para recuperação de senha, sem disparar e-mail externo.
- Professor autenticado: portal, sino, tema e saída acessíveis, prévia de saldo, formulário e envio.
- TI autenticada: abrir/fechar menu e navegar por carrinhos, professores, notebooks, reservas e relatórios. Calendário de seleção de data, aprovação do pedido.
- Professor recebe decisão, marca aviso como lido e encerra sessão. Estado persistido conferido via API com JWT real; saldo público acompanha aprovações.
- Ausência de rolagem horizontal indesejada no documento e nos contêineres principais; controles críticos no viewport e alvos de toque verificados.
- Capturas de consulta, formulário docente, calendário e avisos em cada perfil. Artefato de CI retido por sete dias; exclusivamente dados sintéticos.

## Execução
Com o stack F1.4 local e as dependências instaladas:
```bash
npx playwright install --with-deps chromium webkit
node scripts/homologacao-mobile.mjs
```
A suíte rejeita URL remota, cria duas contas e um carrinho sintético; após login usa sessões reais independentes. Vite e todas as requisições do navegador limitados ao ambiente local. Senhas e tokens não são registrados. A CI roda após F2.4, com teardown. As capturas não incluem campos de login.

## Pendências
Confirmar a CI e revisar screenshots. Testes em celulares/tablets físicos, teclado virtual, leitores de tela, Safari iOS e Chrome Android reais, condições de rede móvel e impressão física permanecem como aceite manual; não declarar homologação física pela emulação. Nenhuma alteração no Supabase de produção. Próxima etapa F2.6 — migrations e recuperação.

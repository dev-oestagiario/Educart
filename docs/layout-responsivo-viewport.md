# Educart — Ajuste responsivo por largura e altura útil

**Branch:** `feat/ux-layout-responsivo-viewport` · **Dependência:** PR #24 (cadastros separados).

## Objetivo

Manter menu, topo e conteúdo funcional em notebooks, desktops e monitores ultrawide, mesmo quando a altura visível for curta. A interface não deve gerar rolagem horizontal do documento nem esconder ações importantes fora da área rolável.

## Estratégia de layout (skill `educart-frontend`)

- `app-shell` usa a área visível (`100dvh`) e limita sua própria altura. A sidebar ocupa a altura disponível e rola **internamente** se o menu completo não couber.
- O `main` usa coluna flexível: cabeçalho permanece visível e **a área central** rola verticalmente com altura calculada pelo navegador. Não se força uma tabela ou formulário longo a caber inteiro numa tela baixa.
- O conteúdo mantém largura fluida com máximo de leitura de 1320px; formulários e grupos de cards têm `min-width:0` e se reorganizam ao reduzir a largura.
- Em janelas com altura menor que 780px, reduzir espaçamentos, não a legibilidade ou botões importantes. Em alturas menores que 570px, compactar topo e indicadores e permitir scroll adequado.
- No celular, preservar drawer lateral, navegação por teclado e dimensionamento das áreas de toque; a página passa a ter somente uma área principal de scroll.
- O portal do professor recebe a mesma organização: barra superior sempre acessível e `teacher-main` rolável em altura menor.
- Calendário: grade e eventos quebram texto; a grade pode rolar internamente em desktop. O deslocamento inicial do mês só vale para grade de cinco colunas; ao reduzir para 3/2/1, não são criadas colunas extras.
- Visualização 3D: canvas limita a altura pela janela e pela largura, preservando a lista de posições e dados textuais.
- Formulário de reserva: calendário em fluxo normal quando o viewport é baixo, para impedir popover cortado pela borda inferior.
- Tabelas grandes possuem rolagem **dentro de seu contêiner**, quando necessárias, sem aumentar a largura total da página.

## Critérios de aceite

- [x] Layout com largura/altura da janela, sidebar e header permanentes e scroll interno acessível.
- [x] Ajustes para notebooks de pouca altura, telas intermediárias, monitores grandes e portal do professor.
- [x] Calendário não cria colunas implícitas no modo reduzido.
- [x] Playwright acrescentado para 768×600, 820×480, 1024×600, 1280×720, 1366×768, 1440×900, 1920×1080 e 2560×1080.
- [x] Playwright acrescentado para calendário, reservas, 3D, solicitações e portal do professor em diferentes dimensões.
- [ ] Build, Vitest e Playwright aprovados no commit final.
- [ ] Deploy GitHub Pages aprovado para teste.
- [ ] Homologação visual em diferentes computadores físicos e com zoom 125/150% antes do merge.

## Limitação esperada

Uma lista extensa, calendário mensal ou formulário longo não cabe integralmente em 480–600px de altura sem perder legibilidade. Nesses casos o layout permanece dentro da tela, **com rolagem interna e acesso a todos os controles**, sem corte de conteúdo ou rolagem horizontal.

**Nenhuma modificação no banco, RLS, regras de disponibilidade ou reservas.**

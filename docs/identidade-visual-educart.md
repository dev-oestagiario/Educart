# Identidade visual do Educart — conceito A

**Direção selecionada:** monograma E geométrico com uma única barra lilás, sem desenhos literais de carrinho/laptop.  
**Skill consultada:** [logo-design-skill](https://github.com/kaankiziltug/logo-design-skill).  
**Issue:** #27 · **Base:** PR #26 (interface responsiva).

## Conceito

Símbolo com uma estrutura contínua de cantos arredondados, abertura central limpa e uma única peça diagonal lilás. A composição comunica organização sem representar literalmente nenhum hardware. O logotipo horizontal utiliza lettering Inter Bold convertido em contornos SVG (não depende de fonte instalada).

## Paleta

| Uso | HEX |
| --- | --- |
| Fundo escuro | `#17131E` |
| Fundo de cabeçalho | `#1C1726` |
| Painéis | `#241E30` |
| Marca escura | `#201932` |
| Accent lilás | `#A88AF5` |
| Marca clara | `#F6F2FF` |
| Superfícies interativas | `#8058C9` |

A interface usa um tema inspirado em Dracula, reinterpretado com menos cores: quase preto, superfícies roxo-escuro e um acento violeta; sem sombras brilhantes, gradientes ou ícones decorativos.

## Arquivos

- `public/brand/educart-logo.svg` — logotipo horizontal para fundo claro;
- `public/brand/educart-logo-light.svg` — logotipo horizontal reverso para fundo escuro;
- `public/brand/educart-symbol.svg` — símbolo sozinho escuro;
- `public/brand/educart-symbol-light.svg` — símbolo sozinho reverso;
- `public/brand/educart-symbol-mono.svg` — versão monocromática;
- `public/favicon.svg` — desenho simplificado com fundo sólido e área de segurança;
- `public/site.webmanifest` — identidade para navegador;
- `src/components/BrandLogo.tsx` — componente reutilizável de marca;
- `src/brand-theme.css` — cores e contrastes, importado após o CSS estrutural.

## Aplicação

- Login: logotipo reverso, sem o antigo laptop do Lucide.
- Barra lateral e portal do professor: mesmo componente e mesma proporção.
- Navegador: favicon SVG e tema escuro declarado no HTML/manifest.
- Rótulos de “Fase ...” removidos dos locais de UI que exibiam o processo de desenvolvimento.

## Uso correto

Preservar proporção e contraste, deixar pelo menos 1/4 da altura do símbolo como respiro, não adicionar gradientes ou inclinações, não substituir o desenho por um ícone genérico. Logotipo horizontal recomendado a partir de 120 px, favicon com versão simplificada de 16–32 px.

## Checklist de qualidade

- [x] SVG com paths e viewBox, sem `<text>`, filtros ou imagens raster.
- [x] Variantes escura, reversa e monocromática.
- [x] Inspeção visual em 16, 32, 64 e 128 pixels.
- [x] Aplicação consistente nos componentes principais.
- [x] Testes de presença e renderização das marcas adicionados ao Vitest/Playwright.
- [ ] CI, E2E e publicação do último commit aprovados.
- [ ] Revisão visual em dispositivo físico com zoom do navegador e em tema claro/escuro.
- [ ] Revisão de eventual conflito com marcas registradas antes do uso comercial amplo.

**Observação:** aplicar a identidade não altera dados, esquema, funções ou permissões do Supabase. O PR depende do #26 e não será integrado à `main` fora da ordem dos PRs anteriores.

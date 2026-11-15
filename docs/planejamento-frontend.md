# Planejamento de front-end — Educart

**Data da revisão:** 15/11/2026
**Escopo:** painel administrativo da Fase 1 e próximas telas do Educart.
**Fontes:** `.agents/skills/educart-frontend/SKILL.md`; Vercel React Best Practices, Web Interface Guidelines e Frontend Design, vinculadas na skill.

## Objetivo de uso

O administrador de TI precisa cadastrar carrinhos, professores e notebooks com poucas etapas e sem perder o contexto de navegação, tanto no desktop quanto no celular. A solução mantém o design institucional já existente e corrige a posição do menu no celular.

## Direção visual e hierarquia

- **Navegação:** barra lateral azul escuro (`#102033`) persistente no desktop; celular com gaveta esquerda acessível via botão no cabeçalho.
- **Destaque:** azul de ação (`#2169c4`) para a principal operação de cada formulário; superfícies brancas e fundo cinza claro (`#f5f7fa`) para leitura.
- **Tipografia:** fonte sem serifa do projeto, títulos objetivos e campos legíveis em telas estreitas.
- **Estrutura:** título/descrição da área; formulário de cadastro/edição; lista consultável; feedback de erro, sucesso ou vazio.
- **Vocabulário:** manter «laboratório móvel», «professor/solicitante», «identificador» e «capacidade», conforme `GLOSSARY.md`.

## Layout por faixa

| Largura | Navegação | Conteúdo |
| --- | --- | --- |
| 320–690px | Botão no cabeçalho abre drawer lateral esquerdo; backdrop fecha | Uma coluna; cartões empilhados, controles com área de toque adequada |
| 691–1050px | Sidebar fixa à esquerda | Indicadores em duas colunas; formulários e listas empilhados |
| Acima de 1050px | Sidebar fixa à esquerda | Quatro indicadores; formulário e lista lado a lado quando couber |

**Interações da gaveta:** abrir pelo botão; fechar pelo botão, pelo backdrop, pelo Escape ou ao escolher uma página; manter o foco dentro da gaveta quando aberta; retornar foco ao botão ao fechar; travar a rolagem do conteúdo atrás; ocultar a sidebar fechada da ordem de tabulação.

## Critérios de aceitação

- [ ] Em 360px de largura, o menu não ocupa uma faixa horizontal do cabeçalho; abre à esquerda em formato de gaveta.
- [ ] O conteúdo permanece acessível com a gaveta fechada, sem rolagem horizontal indevida.
- [ ] A gaveta funciona por mouse/toque/teclado: abrir, fechar, Escape, backdrop, navegação, foco e redimensionamento.
- [ ] Formulários de carrinhos, professores e notebooks continuam operacionais nas larguras 320, 390, 768 e 1280px.
- [ ] Estados de vazio, carregamento, sucesso e erro são úteis; foco visível; animação reduzida é respeitada.
- [ ] Build, testes automatizados e deploy GitHub Pages confirmados; revisão visual real em mobile antes de considerar o bug encerrado.

## Próximas etapas da Fase 1

1. Validar a navegação e os formulários no celular; registrar regressão E2E com Playwright, incluindo viewport mobile.
2. Importação XLSX em implementação: leitura apenas da primeira aba, lista editável de códigos, limites de tamanho, detecção de duplicação e verificação da capacidade antes de salvar. Aguardar CI e teste no navegador.
3. Completar testes E2E autenticados, verificações de RLS e mensagens de falha de rede.
4. Fazer revisão do PR #10, corrigir pendências e só integrar à `main` depois da validação final.

**Observação:** compilação sem erros não substitui teste visual responsivo. Os critérios só podem ser marcados como cumpridos após verificação efetiva.

## Evidências automatizadas

O `e2e/educart.spec.ts` usa Playwright Chromium com Supabase simulado e verifica quatro jornadas: usuário não autorizado, cadastros, importação/revisão e gaveta mobile (360px, Escape e ausência de overflow). Ainda é necessária verificação com contas reais das políticas RLS e aprovação visual num dispositivo móvel real antes da entrega final.

## Regressões ampliadas (15/11/2026)

- Playwright testa agora os breakpoints 320, 360, 390, 768, 1024 e 1280px.
- Para cada largura, testa o acesso ao menu e a ausência de rolagem horizontal, além de anexar uma captura para revisão visual.
- Testa fechamento por backdrop, Escape e a sequência de foco por teclado.
- Este material é evidência automatizada em Chromium, **não** substitui avaliação em celular físico nem teste com contas Supabase reais.

---
name: educart-frontend
description: Planejar, implementar e revisar o front-end React do Educart com foco em navegação, acessibilidade, responsividade e desempenho.
---

# Skill — Front-end Educart

Utilize esta skill **antes de alterar telas, layout, navegação ou componentes** do Educart.

## Referências de skills externas (consultar quando pertinentes)

- Frontend Design (direção visual e planejamento): https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Vercel React Best Practices (componentes, estado e desempenho): https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md
- Vercel Web Design Guidelines (acessibilidade, formulários, UX e responsividade): https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- Regras web atualizadas: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Não copie instruções externas sem avaliar a licença, e não trate referências externas como substitutas do escopo e dos requisitos do Educart. Combine esta skill com `.agents/skills/diagnosing-bugs/` para bugs e `.agents/skills/code-review/` antes de integrar PRs.

## 1. Planejar antes de implementar

1. Ler `GLOSSARY.md`, `docs/spec-fase-1.md`, `docs/fluxos-de-tela.md` e a tela afetada.
2. Identificar quem realiza a tarefa (administrador da TI), seu objetivo, fluxo principal e estados de erro/vazio/carregamento.
3. Registrar um plano curto: hierarquia visual, navegação, estrutura responsiva, acessibilidade, reutilização de módulos e critérios de aceite.
4. Manter a identidade atual do Educart: superfícies escuras (#17131E, #241E30), acento lilás (#A88AF5), componentes consistentes, contraste adequado e rótulos do domínio. Não reutilizar o azul legado em controles móveis.
5. Validar o plano contra a tarefa real, em vez de redesenhar sem necessidade.

## 2. Layout responsivo obrigatório

- Desktop: sidebar vertical à esquerda, conteúdo principal à direita.
- Celular até 690px: **menu lateral retrátil à esquerda**, aberto por botão no cabeçalho; nunca transformar opções de navegação numa fila horizontal no cabeçalho.
- Sidebar fechada não deve interceptar cliques nem receber foco; aberta deve cobrir o conteúdo com backdrop e bloquear a rolagem do fundo.
- Implementar abrir, fechar, Escape, clicar fora, navegação e rotação/redimensionamento. Restaurar o foco ao botão de abertura ao fechar.
- Verificar larguras de 320, 360, 390, 768, 1024 e 1280px, incluindo campos longos, textos extensos e teclado virtual.
- Respeitar safe areas, zoom do navegador e `prefers-reduced-motion`.

## 3. Padrões de acessibilidade

- Elementos acionáveis reais (`button`, `a`), rotulagem em português, botão de ícone com `aria-label`, foco visível e ordem lógica.
- Formulários com `label`/mensagens úteis; não depender apenas de cor; lidar com sucesso, falha, vazio e carregamento.
- Garantir que todos os fluxos funcionem via teclado. Menu móvel aberto deve limitar o foco à própria navegação.
- Preservar zoom, áreas de toque de ao menos ~44px para controles móveis e indicadores de seleção ativos.
- Usar RLS e regras de autorização no Supabase; esconder uma tela no cliente não é controle de segurança.

## 4. Código React

- Reutilizar `TanStack Query` para dados remotos e `Zustand` para estado local; evitar armazenar dados duplicados em ambos.
- Evitar componentes excessivamente grandes, encadeamentos de requisições sem necessidade e efeitos desnecessários.
- Preferir atualizações funcionais de estado e derivação no render quando apropriado.
- Não expor senhas, tokens privados ou `service_role` no navegador.
- Não quebrar as regras do domínio: a capacidade do carrinho independe de quantos códigos foram cadastrados.

## 5. Verificação e entrega

- Reproduzir o defeito relatado antes da mudança, quando existir ambiente capaz de executar a interface.
- Rodar typecheck, testes, build, e testes visuais e de teclado no viewport afetado quando a infraestrutura permitir.
- Se não houver browser de testes disponível, registrar a lacuna; aprovação de build **não comprova** layout.
- Atualizar documentação e o PR, acompanhar CI e Pages, conferir o endereço final. Não integrar `main` sem os critérios de aceite.

# Padrão visual de dropdowns

Todos os selects simples usam o design system (44 px mínimos, bordas, foco visível, estados inválido/desabilitado e paletas dos temas). No desktop com ponteiro preciso, navegadores compatíveis usam o picker nativo personalizável: menu arredondado, rolagem limitada, destaque da opção selecionada, chevron e opções com espaçamento. Em navegadores sem suporte a CSS base-select, a lista segue a aparência nativa do navegador com campo estilizado; no toque, mantém o seletor do sistema com fonte de pelo menos 16 px. Não substituímos os elementos select, option ou eventos de formulário, nem acrescentamos dependências. Listboxes múltiplas ficam fora da regra.

Referência: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select

Validação: Playwright na consulta pública com dados sintéticos, ambos os temas, seleção real e filtro funcional, abertura/fechamento do menu aprimorado quando suportado e dimensões 320–1440 px.

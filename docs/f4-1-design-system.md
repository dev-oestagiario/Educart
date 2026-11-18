# F4.1 — Design system e coerência visual

## Especificação
Manter identidade violeta (marca e temas persistidos existentes), sem reconstruir rotas ou alterar dados de negócio. Consolidar o contrato visual dos controles comuns e aplicar componentes reutilizáveis aos módulos recentes. A substituição completa dos estilos legados e a homologação de acessibilidade integral serão incrementais (F4.2–F4.4).

## Implementação
- src/design-system.css: tokens semânticos de espaçamento (4/8/12/16/20/24 px), raio de controle/painel (10/14 px), tamanho mínimo de controle (44 px), tipografia (14/13 px), superfícies de input, bordas, foco, ações primária/secundária/ghost e estados neutro/sucesso/erro/atenção. Carregado após os estilos antigos; cores, geometria e estados em um contrato compartilhado. Mantém seletores específicos de marca, calendário, tema e navegação; não remove indiscriminadamente regras legadas.
- Botões e inputs padronizados nos dois temas, foco de 3 px, estados disabled/hover, datas com dimensão correta (corrige seletor de fieldset que aplicava largura de checkbox a campos de data), campos de formulário mobile 16 px, feedback com texto e contraste, popover de datas e confirmação inline coerentes.
- Feedback.tsx: Feedback (erro com role alert, demais status), LoadingState (spinner com texto e reduced-motion), EmptyState (mensagem explícita). Usados em dashboard, manutenção, movimentações, localizações e preferência de e-mail. Não substituir falha por vazio.
- RecordsHeader: actionKind add/back/refresh independente do modo de edição, ícones corretos e busy para evitar troca de formulário durante salvamento. Mantém compatibilidade com cadastros antigos. Grupos de opções e checklists dos módulos operacionais sem estilos inline repetidos.
- Aplicação global aos controles existentes de administração, professor, consulta pública e login. Layouts particulares mantidos; não introduzir biblioteca UI ou novas dependências. Não criar modais novos; revisão de modais futuros e fluxos será F4.2/F4.4.

## Guia para novos componentes
Use .primary para ação principal, .secondary para ações auxiliares e .ghost para voltar/cancelar; use button type=button fora de submit. Feedback deve ter mensagem descritiva, nunca depender só da cor. Use .field com label e input/select/textarea associados, .ds-fieldset para opções relacionadas e .ds-choice-group com aria-pressed para alternância de recorte. Não adicione cores fixas nos novos módulos: use --educart-* para superfícies/texto e --ds-* para controles/estados. Não desabilite foco. Tamanho mínimo 44 px para controles compartilhados e largura que permita quebra de texto.

## Validação local
PC CQP-KAINA-72, pasta C:\programacao\Educart, sem GitHub Actions.
- Build aprovado; 85 testes unitários.
- Suite de regressão completa: 53 Playwright aprovados, 2 skips legados 3D. Novo E2E F4.1 aprovado isoladamente (54 aprovados combinados): tema dark/light, ações de manutenção/localizações/movimentações, campos, foco, contraste >=4.5:1 em botão primário e select avaliados, recorrência e ausência de overflow horizontal em 320/390/768/1440.
- Cinco testes do worker de e-mail preservados (sem alterar o worker). Sem alterações no banco, sem migrations novas ou novas dependências.
- Não declarar conformidade WCAG integral: este incremento não inclui auditoria completa de leitor de tela, zoom 200%, todos os estados interativos e dispositivos físicos. F4.3 trata esses critérios. CSS legado de módulos específicos permanece; consolidar progressivamente, sem reintroduzir regressão.
- Pendências já existentes: integração #44–50, auditoria picomatch, Auth/PostgREST/concorrência reais e provedor de e-mail. Nenhuma alteração em produção.

Próxima fase: F4.2 — padronização listagem → detalhe/formulário nos cadastros recentes e navegação.

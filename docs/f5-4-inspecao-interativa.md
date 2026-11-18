# F5.4 — Inspeção interativa
Base F5.3 (PR #58). DT-017/018/019 implementados no escopo ilustrativo; DT-020 exige homologação da consistência entre telas.

## Implementação
- Foco, retorno à visão geral e saída por Escape. Porta virtual articulada por rotação da dobradiça, sem comando físico; exemplos internos apenas quando aberta. Controles textuais de componentes, indicação selecionada, raycast de partes visíveis. Modo econômico e falha de GLB/WebGL deixam porta indisponível; lista textual permanece.
- Componentes e notebooks ilustrativos não correspondem a patrimônio nem slots físicos. Não inferir vínculo por posição, ordinal, código ou quantidade. Dados reais ficam em painel separado e são obtidos da RPC administrativa já existente.
- Lista de vínculos confirmados, busca, seleção por UUID e associação à reserva apenas pelo período explicitamente retornado. Rejeitar registros duplicados, inconsistentes ou defasados; ausência de vínculo não significa disponibilidade.
- Histórico sob demanda, consulta somente leitura aos dez registros mais recentes que contêm explicitamente UUID do notebook no mesmo carrinho. Condições são as registradas na movimentação como um todo, não diagnóstico individual atual. Nenhuma inferência de localização física.
- Invalidação de consultas espaciais após alterações de carrinhos, notebooks, reservas e movimentações; outros fluxos preservam invalidação já existente. Polling e timestamps mantidos. Navegação para telas de cadastro, reservas, manutenção e histórico. Nenhuma alteração de schema/RLS/Storage.
- Sem alteração de permissões, produção ou modelo físico. Acesso administrativo DEV seguindo F5.3; associação de hotspots a patrimônios reais depende de aprovação de um modelo físico.

## Validação
Dispositivo localhost, Debian 13 via PRoot/Termux ARM64 e runtime Linux Node 24.9.0. Clone existente da F5.3 atualizado via fetch e checkout para testes; commits pela conexão Dev.
- Typecheck aprovado, 108/108 testes Vitest em 23 arquivos (6 novos + 102 existentes), commit 9bbbcb9.
- Após ajustes de disponibilidade dos controles, no commit 01c21ce: 3/3 GLB reproduzidos com SHA-256 e 12/12 testes de layout. Build integral iniciado, ver resultado final no PR.
- E2E ampliado para abertura e fechamento, hotspot ilustrativo, vínculo real, reserva e histórico mockados, isolamento entre carrinhos e fallback. Não executado: Chromium e suas bibliotecas gráficas ausentes; computadores tradicionais offline. Não declarar homologação visual. Validação de RLS/consulta na stack real, integração com dashboard/relatórios/consulta pública e referências/aceite visual pendentes. Sem executar Actions deliberadamente, sem merge/deploy.
- Consultar docs/educart-3d-v2.md e roadmap. Próxima F5.5: otimização de carregamento e renderização, LOD, desempenho e responsividade. F5.6: testes completos e homologação.

Comandos:
    npm run typecheck
    npm test -- --maxWorkers=2
    node scripts/generate-f5-3-assets.mjs --check
    node --test scripts/verificar-f5-2-layout.mjs
    npm run build
    npm run test:e2e -- --grep 'F5.2' --workers=1

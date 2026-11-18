# F5.5 — Otimização e fallback
Base PR #59. Acesso administrativo somente DEV, sem mudanças de banco, permissões, dependências ou significado operacional.

## Implementação
- LOD por tamanho projetado (entrada 36 px, saída 24 px), prioridade de foco e seleção e distância ao alvo como desempate, máximo 12 carrinhos detalhados. Sala detalhada apenas no foco; todos os carrinhos continuam representados.
- Corpos simplificados e indicadores agrupados em dois InstancedMesh, seleção pelo instanceId; modelos detalhados mantêm hotspots. Texturas de rótulos reduzidas de 768×112 para 512×80 (detalhada) e 384×64 (econômica). Geometria e materiais compartilhados dos modelos, descartados de forma deduplicada; buffers de instâncias descartados.
- LOD e render agrupados em requestAnimationFrame sob demanda; sem loop contínuo. Suspender desenho fora do viewport ou em aba oculta; retomada por observer/evento. Falha de contexto/render preserva lista.
- Chave de cena considera atributos visíveis, não timestamps transitórios; alterações de estado/posição ainda reconstroem cena, mas preservam câmera. Cache em memória restrito aos três GLB imutáveis verificados, sem objetos GPU ou dados privados. Hash revalidado e parse novo por cena. Arquivos totalizam 46.360 bytes, não adotada compressão adicional/decoder sem medição de benefício.
- Qualidade automática usa largura, núcleos disponíveis, economia de dados informada e quantidade de carrinhos; escolha explícita prevalece. Mobile inicia em lista textual; 3D opcional. Paginação de 40, busca e acesso a todos os resultados, sem excluir objetos da cena. Controles de toque/foco e reduced-motion.
- Não prometer desempenho uniforme: labels e marcadores ainda crescem com quantidade; render real e seleção por instância precisam validação de navegador.

## Evidências
localhost, Debian 13 PRoot/Termux ARM64, Node 24.9.0; checkout da branch existente apenas para testes. Commits pela conexão Dev.
- Commit 1db2d79: typecheck aprovado, 119/119 Vitest em 24 arquivos, 11 novos (8 políticas + 3 cache/perfil). 
- Perfil estrutural em Node, 120 clones detalhados vs 12: 21.240 vs 2.124 nós de GLB (90% menos nós detalhados, não nós totais da cena). Tempo de construção nesta única execução: 931,48 ms vs 46,58 ms; não generalizar, sem GPU, labels, fallback, rendering ou medição repetida. 
- Commit 647d554: 3/3 hashes GLB e 12/12 testes de layout aprovados; build final em validação.
- E2E ampliado (041b9f0) com falha a frio, recuperação, cache, instâncias e modo automático móvel. Não executado: Chromium indisponível no PRoot e PCs tradicionais offline. Pendências: WebGL real, raycast, FPS, memória, largura/zoom 200%, contraste e rede limitada, consistência funcional e RLS na stack real. Sem execução de Actions deliberada, merge ou publicação.
- DT-021/022/023 mantidos pendentes de aceite integral; F5.6 deve validar o conjunto e só publicar após autorização.

## Reproduzir
    npm run typecheck
    npm test -- --maxWorkers=2
    node scripts/generate-f5-3-assets.mjs --check
    node --test scripts/verificar-f5-2-layout.mjs
    npm run build
    npm run test:e2e -- --grep 'F5.2' --workers=1

# F5.3 — Assets GLB detalhados (ilustrativos)

Base: PR #57 (F5.2). DT-012 a DT-015 implementados no escopo ilustrativo, DT-016 pendente. Sem novas dependências, migrations, Storage, permissões ou deploy. Os modelos são originais gerados por um pipeline procedural GLB 2.0, não fotos, réplicas do campus ou modelos de terceiros. Não há autorização de distribuição de plantas reais implícita neste trabalho.

## Specify / plan
A TI consulta todos os carrinhos na visão geral, focaliza uma unidade e inspeciona a geometria em corte. Usar assets locais versionados e sem dependências externas. Preservar a capacidade, posição e ocupação retornadas pelo backend como estado distinto da geometria. Não associar exemplos a patrimônio, reserva ou disponibilidade. Manter a legenda e alternativa textual sem WebGL. Identidade visual, navegação, estados e responsividade existentes são preservados. F5.4 implementará hotspots interativos e porta operacional no visualizador; ações no objeto não alteram inventário. F5.5 avaliará escala, LOD automático e desempenho.

## Assets
| Asset | Bytes | Conteúdo |
| --- | ---: | --- |
| cart-illustrative-v1.glb | 27596 | estrutura metálica, portas, dobradiças, puxador, ventilação, prateleiras, divisórias, cabos, conectores, rodízios, travas, etiqueta genérica e 30 slots ilustrativos |
| room-illustrative-v1.glb | 10560 | piso, marcações, paredes em corte, rodapés, porta, mesa, monitor e armário genéricos |
| notebook-illustrative-v1.glb | 8204 | chassi, tampa, teclado, trackpad, painel, dobradiça, portas |

Total 46.360 bytes sem compressão. Manifesto versionado em src/features/digitalTwin/assets/manifest.json com SHA-256, autoria, situação de direitos, dimensões, unidades em metros, eixo Y, hotspots. Pipeline original em scripts/generate-f5-3-assets.mjs; não requer Blender para reproduzir os exemplos. Blender permanece opção para futuros modelos reais autorizados. Direitos finais/distribuição sob aprovação do mantenedor (nenhum direito de terceiro é presumido).

## Implementação
- GLTFLoader lê somente os três arquivos empacotados no front. Checa comprimento exato, SHA-256, contêiner GLB, buffer interno, ausência de imagens/extensões/URIs externas e hotspots exigidos. Não lê caminho arbitrário informado pelo banco.
- Material PBR, reutilização de geometria e materiais; descarta recursos compartilhados uma vez. Cancelamento na troca de cena e fallback simplificado. Modo econômico não inicia carga dos GLB.
- Sala dimensionada no plano cadastrado; mobiliário não posicionado fica oculto para não inventar planta nem obstruir um carrinho. Corredores físicos não mapeados. A zona sem localização mantém geometria simples.
- Modelo de carrinho ajustado ao footprint completo incluindo puxador. Altura e proporções verticais ilustrativas. Na qualidade detalhada, focalizar ativa corte visual (não abertura de porta física), mostrando 30 exemplos verticais de notebooks. Fora do foco, interior oculto, exemplos removidos. As chaves do modelo não são chaves de slots físicos. Capacidade/estado/reservas continuam no painel; nenhuma atribuição automática de notebook.
- Renderização de geometria independente de estado do banco; erro de asset não torna carrinho livre. Seleção por ID, raycast desconsidera hierarquias ocultas, lista textual preservada. Matriz F5.3 não homologa performance nem reprodução fiel.
- Acesso continua administrativo em DEV com ?environment3d=1. Sem novo acesso anônimo/professor. Supabase real, planta autorizada, licenças de futuros GLB e revisão de TI pendentes.

## Evidências
Dispositivo localhost (Termux/Android ARM64), Debian 13 via PRoot, workspace /workspace/Educart-f5-3-validation. dev-doctor executado e AGENTS do dispositivo/repositório consultados. Debian tinha Node 20 e instalação dpkg em andamento; não interferimos na instalação. Node Linux ARM64 24.9.0 isolado em /tmp, npm 11.6.0, npm ci com lockfile, 231 pacotes; nenhuma alteração em dependências. Clone integral da branch por GitHub e checkout somente para testes, sem push pelo dispositivo.
- F5.2: commit 96e615e, 12/12 testes Node nativos de layout; build completo aprovado.
- F5.3: reprodução binária e SHA-256 dos três assets conferidos no Node. Typecheck aprovado e 102/102 em 22 arquivos Vitest (95 regressões + 7 novos), no commit 28160b6. Novos testes carregam GLB reais pelo GLTFLoader via fetch simulado, conferem nomes e materiais, recusa HTTP/hash/arquivo truncado, cancelamento, limites, independência do corte, 30 exemplos e mobiliário oculto.
- Build completo aprovado no incremento inicial abb4da2. Build de verificação do último código 47fc139 aprovado (exit 0, Vite em 1m 3s).
- E2E ampliado para verificar modo detalhado, seleção/corte, economia, falha de asset e independência da lista. Chromium indisponível (bibliotecas de sistema ausentes no Debian PRoot, instalação apt já em andamento). Não instalar dependências do sistema concorrentes. E2E, screenshots, raycast visual, toque e WebGL real NÃO executados. SQL/Supabase não executados neste incremento (sem mudanças de banco). Chunks >500kB de índice e Three/OrbitControls e warnings de dependência preexistente/similares permanecem; tratar F5.5.

Reproduzir em checkout com Node 24 e npm ci:
    node scripts/generate-f5-3-assets.mjs --check
    node --test scripts/verificar-f5-2-layout.mjs
    npm run typecheck
    npm test -- --maxWorkers=2
    npm run build
    npm run test:e2e -- --grep 'F5.2' --workers=1

## Próxima
F5.4 — inspeção interativa com porta e hotspots, dados de notebooks vinculados por chaves reais e reservas/histórico. Nunca ligar automaticamente um slot ilustrativo a um identificador real; até aprovação do tipo/posições, somente consulta agregada. Homologação manual e performance permanecem pendentes.

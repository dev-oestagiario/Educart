# F5.2 — Visão geral administrativa 3D

Base incremental: F5.1 (PR #56). DT-008 a DT-010 implementados; DT-011 em validação parcial. A tela fica disponível somente em desenvolvimento, para administrador autorizado, com ?environment3d=1. Sem reativação em produção.

## Entrega
- Consulta paginada do resumo existente por data e turno, todos os carrinhos incluindo inativos e sem posição válida; metadados espaciais projetados, sem carregar slots ou notebooks de todos os carrinhos.
- Layout determinístico de ambientes separados e zona virtual sem localização definida. Usa dimensões e coordenadas cadastradas quando válidas; não representa planta real nem localização instantânea.
- Three.js carregado sob demanda, identificação visual por código/estado, seleção por raycast e lista, foco, órbita, zoom, pan, retorno à visão geral, qualidade visual e descarte dos recursos.
- Painel com capacidade nominal/efetiva, reservas, disponibilidade, manutenções e guarda; detalhe consultado apenas após seleção. Destino de reserva e última movimentação registrada separados do posicionamento cadastrado. Consulta futura não implementada; inspeção física individual permanece F5.4.
- Atualização em foco, manual e polling de 30 segundos; dados com erro ou mais de 120 segundos desde a última consulta bem-sucedida não confirmam saldo. Detalhe divergente não é apresentado como confirmado. O resumo mantém as regras operacionais da RPC F5.1.
- Lista textual acessível, busca sem acentos que não remove elementos da cena, alternativa sem WebGL; layout responsivo previsto. Sem migrations, deps novas, publicação de assets ou alteração de permissões. Geometria genérica; referências autorizadas para ambiente real permanecem pendentes.

## Validação
PCs conectados indisponíveis durante esta execução. Ambiente isolado do assistente sem acesso ao registry npm, usado somente para validação pura de TypeScript. O arquivo overviewLayout.ts (blob 4e66cb1742e7e5ec23f4a5095cdb5b0a8ef640ce) e script (blob c9767d7be32bcc333d8bd0a3e6ede1947c6cdbe3) foram conferidos com GitHub. Compilação isolada strict/noUncheckedIndexedAccess via tsc aprovada. Node 22.16.0: 12/12 testes nativos, incluindo 0/1/N, 30 carrinhos sem posição, zonas separadas, estados, poses inválidas, inativos, determinismo, duplicatas, busca e expiração.
    node --experimental-strip-types --test scripts/verificar-f5-2-layout.mjs

Dois cenários Playwright foram adicionados para administração, data/turno, detalhe sob demanda, erro sem saldo, busca, alternativa textual, mobile e autorização negativa. Não executados. Build integral, Vitest, Playwright, inspeção visual/WebGL (incluindo raycast), medição de desempenho e consulta à stack Supabase local completa pendentes. Não afirmar homologação ou integração com dados reais de produção. Nenhum job Actions iniciado deliberadamente; commits [skip ci]. Nenhum merge na main/deploy.

## Próxima etapa
Concluir a validação pendente da F5.2 no PC conectado; F5.3 — GLB detalhados de ambientes/carrinhos/notebooks com autoria, licenças e referências físicas autorizadas. Na falta de referência, manter rotulagem ilustrativa. Otimização/LOD e homologação permanecem F5.5/F5.6.

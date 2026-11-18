# F5.0 — protótipo do novo ambiente tridimensional

Base: F4.4. Escopo: DT-001 a DT-003 de [Educart 3D V2](educart-3d-v2.md).
Este documento descreve um experimento navegável, não o estado do inventário.

## Constitution e Specify

- Somente o administrador da TI acessa a demonstração dentro do ambiente de desenvolvimento.
- A ADR 0003 permanece: o 3D é projeção de dados, não fonte da verdade. Esta etapa não acessa nem modifica reservas, disponibilidade, posições, inventário ou dados pessoais do Supabase.
- Não usar plantas, fotos, códigos ou dimensões reais sem autorização. A F5.0 usa geometria procedural original do projeto e quatro exemplos fictícios. Os materiais não representam fabricantes reais; nenhuma textura ou modelo externo foi importado.
- Todos os exemplos são apresentados na visão inicial sem seleção e sem filtro de carrinho obrigatório. A busca afeta somente a lista; há uma área explícita para o exemplo sem localização.
- Seleção por clique e por botão textual compartilham o ID; inspeção aproxima a câmera; abrir porta mostra compartimentos e notebooks ilustrativos, sem atribuir posição física.
- Construção em Three.js existente; renderização lazy, sob demanda, qualidade ajustável, descarte de recursos e lista independente de WebGL. Nenhuma migração ou mudança de dependência.

## Wireframes

Desktop (sidebar e header existentes):
```text
┌─────────────────────────────────────────────────────────┐
│ Ambiente 3D · Protótipo                                 │
│ Aviso de dados fictícios                                 │
│ Busca       Qualidade        Exibir 3D      Visão geral  │
├───────────────────────────────────┬─────────────────────┤
│ Sala de TI | legenda              │ Detalhes            │
│                                   │ Código / condição   │
│  [A]  [B]  [C]                    │ Local / capacidade  │
│            [D sem localização]    │ Inspecionar         │
│          CENA ORTOGRÁFICA          │ Abrir/fechar porta  │
├───────────────────────────────────┴─────────────────────┤
│ Lista acessível: A | B | C | D                           │
└─────────────────────────────────────────────────────────┘
```

Mobile: cabeçalho e gaveta lateral preservados; aviso, controles em coluna, cena responsiva, detalhes, lista de quatro exemplos empilhados. Não introduzir menu horizontal. Escape sai da inspeção; nenhuma animação automática.

Storyboard: entrar na visão geral → clicar no carrinho Beta → consultar estado parcial e saldo demonstrativo → inspecionar → abrir porta → voltar à visão geral. O mesmo fluxo de consulta permanece na lista se WebGL indisponível. Sem alteração de regras ou estado real.

## Assets e referência

| Asset | Origem | Estado |
| --- | --- | --- |
| Sala, piso, paredes recortadas, mesa e monitor | Procedural Three.js | Ilustrativo, dimensões arbitrárias |
| Carrinho com prateleiras, rodas, porta e maçaneta | Procedural Three.js | Ilustrativo |
| Notebooks repetidos (instancing) | Procedural Three.js | Geometria simplificada, sem códigos físicos |
| Etiquetas | CanvasTexture local | Códigos DEMO, sem dados pessoais |
| Fotos, dimensões e modelos físicos | Não fornecidos | Pendente autorização e revisão da TI |

DT-002 permanece pendente de imagens e medidas autorizadas; nenhuma coleta externa ou modelagem de réplica realizada. A aprovação do aspecto visual e de referências é necessária antes da F5.3. DT-003 tem implementação de protótipo e evidências de teste, não aceite visual humano.

## Orçamento técnico

| Métrica | Alvo inicial (protótipo 4 carrinhos) | Medição |
| --- | --- | --- |
| Draw calls da cena geral | <200 | 128 |
| Triângulos | <10.000 | 3.382 |
| DPR | <=1.5 padrão; <=1 econômico | Limitado no renderer |
| Renderização quando parada | Sem RAF contínuo | Sob demanda por eventos/resize/seleção |
| FPS desktop com 10/30 carrinhos | >=30 FPS | Não medido; F5.5 |
| Frame time p95, memória e dispositivos móveis físicos | Definir hardware de referência | Pendente F5.5 |

Contagens medidas via renderer.info em Chromium Playwright com SwiftShader disponível; não equivalem a benchmark de FPS/GPU. Sem downloads de GLB nesta fase. O carregamento do canvas ocorre somente após abrir o protótipo; recursos descartados ao sair ou trocar qualidade. Metas propostas para a próxima etapa de modelagem: assets GLB com LOD, orçamento por modelo definido após referências e teste de 10/30 carrinhos.

## Como experimentar

No checkout da branch, configure VITE_SUPABASE_URL/PUBLISHABLE_KEY localmente (sem chave secreta), execute `npm ci` e `npm run dev`. Abra a URL do servidor com `?prototype3d=1`, entre como administrador da TI e escolha **Protótipo 3D** no menu. A flag é exclusiva de DEV; não reativa o menu de produção ou altera o portal público. Os testes Playwright utilizam Supabase simulado.

## Próxima fase

F5.1: revisar schema e RLS, definir persistência espacial e contratos autorizados de resumo/detalhe. Não antecipar migrations nem vincular slots fictícios a notebooks reais. F5.2–F5.6 tratarão agregados, dados da rotina, modelos detalhados, interação, escalabilidade e homologação.

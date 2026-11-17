# ADR 0005 — Persistência espacial administrativa
Status: aceita para F5.1; homologação Supabase real pendente.

A ADR 0003 permanece: a cena não é a fonte da verdade. Reutilizamos campus/bloco/sala, guarda administrativa, destino de reserva, manutenção e inventário existentes. Alterações aditivas criam seis tabelas RLS. Não adicionamos coordenadas nem modelos a carts, pois o catálogo existente é consultado por professores. Somente administradores ativos podem ler/escrever dados espaciais e executar RPCs. As RPCs são SECURITY INVOKER e verificam autorização explicitamente.

- asset_models: metadados versionados de modelos, dimensão final em metros, autoria/licença, caminho relativo GLB e checksum opcionais. O modelo em uso é imutável. Não autoriza upload nem acesso ao Storage nesta fase.
- spatial_scenes: ambiente associado a uma sala cadastrada; dimensões e revisão. Retirar poses antes de alterar a geometria.
- cart_scene_placements: perfil opcional por carrinho e modelo, com uma única pose; NULL significa sem posição. Origem no centro do piso, eixo Y para cima; Y=0, X/Z em metros, yaw em graus no intervalo [0,360). Modelo e dimensões representam a caixa envolvente final; raio conservador evita sobreposições mesmo com rotação, podendo rejeitar alguns encaixes geométricos válidos.
- cart_model_slots: posições de geometria nomeadas; notebook_slot_links: confirmação explícita de notebook pertencente ao carrinho, unicidade do slot e notebook, integridade referencial. Desvincular antes de transferir um notebook vinculado ou mudar seu modelo. Códigos inativos excluídos do detalhe, nunca inferir identificação física de quantidade.
- spatial_events: auditoria de mudanças com ator da sessão, timestamp e registros antes/depois; leitura administrativa, sem escrita direta pela API.

Bloqueio transacional compartilhado serializa edições espaciais em READ COMMITTED; versão da pose permite atualização condicional pela interface. Desativar um ancestral da sala torna a pose indisponível no resumo, sem apagá-la ou alterar guarda/destino. Nenhuma telemetria nem localização instantânea.

Resumo set-based por data/turno considera todos os carrinhos, inclusive inativos e sem posição; usa capacidade configurada e soma de períodos ativos, manutenção e dias úteis. Detalhe por ID só é solicitado após seleção e contém dados autorizados das reservas e vínculos confirmados. A consulta pública existente não recebe novos dados. RLS e GRANT restringem acesso inclusive por REST direto; a flag de desenvolvimento é apenas controle de exposição na interface.

Alternativas rejeitadas: gravar poses em carts, criar inventário paralelo, derivar localização da reserva/guarda, associar automaticamente códigos a slots, introduzir modelos reais sem autorização. Limitações: importação em lote/drag editor, ativos GLB privados, dimensões físicas, sincronização automática e homologação com Supabase Auth/PostgREST real permanecem futuras.

# F5.1 — Fundação de dados espaciais

## Escopo e implementação
DT-004 a DT-007. Base incremental F5.0. A tela de configuração é exclusiva para administrador e desenvolvimento: execute npm run dev, abra a URL com ?spatial3d=1 e selecione Configuração espacial. O menu de produção permanece oculto. Não misturar com ?prototype3d=1 (demonstração fictícia).

1. Cadastro/edição de metadados de modelos (inclui autoria, licença, versão e dimensões), salas e ambientes com pose numérica em metros e rotação em graus.
2. Associar um modelo ao carrinho, posicionar, atualizar ou retirar da cena sem afetar a guarda e as reservas; sem posição permanece explícito no resumo.
3. Cadastrar slots e confirmar/desvincular códigos reais pertencentes ao carrinho. A interface não preenche vínculos automaticamente.
4. Prévia de ocupação por data/turno e detalhe após escolha do carrinho, com mensagem de erro caso a consulta não possa ser confirmada.
5. Migration aditiva, políticas RLS, contratos Zod, auditoria e proteção contra sobreposição concorrente. Veja ADR 0005.

A página usa os componentes/tokens existentes, formulários rotulados, grid fluido, lista textual e estados de carregamento/erro. Editor inicial é numérico; manipulação 3D por arraste e pipeline de assets GLB são etapas posteriores. As dimensões padrão do formulário são sugestões ilustrativas, não medidas reais coletadas. Não há modelos físicos pré-cadastrados.

## Resultados de verificação (kainao-pc)
- 13 migrations aplicadas do zero no PostgreSQL 16 isolado em Docker.
- Cenários SQL: autorização administrativa, professor, conta desvinculada e anon; limites, choque, versão, modelo em uso, vínculo de outro carrinho, duplicidade, trilha de auditoria, saldo parcial/total/manutenção/inativo/fim de semana, mudança de turno e cancelamento, consistência com consulta pública.
- Concorrência real de duas conexões PostgreSQL: um único commit na mesma pose.
- Build e typecheck aprovados; Vitest 95/95; worker 5/5; Playwright F5.0/F5.1 4/4 (inclui cadastro de modelo/ambiente e consulta sob demanda em 390px).
- Reproduzir SQL com bash scripts/verificar-f5-1-espacial.sh. Cria PostgreSQL descartável sem publicar porta, executa fixtures e remove o container. Auth/claims são simuladas, não equivale a validar JWT real, API PostgREST, Storage ou RLS em projeto hospedado.
- Build ainda sinaliza chunks legados maiores que 500 kB; tratar em F5.5.

## Limites e promoção
Migration não aplicada a ambiente hospedado. Revisar em stack Supabase local completa e executar advisors antes de promover. O catálogo de modelos apenas referencia arquivos; nenhum bucket ou asset real publicado. Não marcar a homologação de produção como concluída. A referência física e aceite visual da F5.0 continuam pendentes. Próxima: F5.2, consumir contratos e mostrar todos os carrinhos na cena, incluindo os não posicionados.

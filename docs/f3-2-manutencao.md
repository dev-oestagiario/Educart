# F3.2 — Inventário e manutenção

## Escopo
Janelas de indisponibilidade programada do carrinho inteiro, por intervalo inclusivo de datas (até 366 dias) e turnos. Cadastro administrativo, motivo obrigatório, autor/data de criação e de encerramento, histórico preservado. Estado operacional deriva da janela e do cadastro; não representa telemetria. Manutenção unitária por notebook ou redução parcial da capacidade fica fora deste incremento: não alterar capacidade nominal para simular defeito.

## Regras / implementação
- Administração agenda e encerra janelas; as demais contas não consultam motivo ou histórico. RLS e grant SELECT administrativo; escrita somente pelas RPCs autenticadas com verificação TI.
- Agendamento bloqueia carrinho com reserva confirmada conflitante, sem cancelar nada automaticamente. Janelas sobrepostas no mesmo turno também são rejeitadas.
- Reserva, edição, aprovação e manutenção compartilham lock do carrinho; trigger nos períodos ativos impede criação parcial. Pedidos de professor permanecem pendentes até aprovação; não consomem saldo.
- Capacidade efetiva zero durante a janela, sem mudar capacidade cadastrada. Prévia do professor, saldo público (somente indisponível), prévia admin e 3D legado respeitam bloqueio. A consulta pública não retorna motivo, autor nem ID de manutenção. Encerrar libera imediatamente todos os períodos da janela e mantém registro; não reconstrói saldo histórico no passado.
- Migration 20261117174739_educart_maintenance.sql gerada pela CLI no PC; sem alteração em produção. Sem mudanças nas migrations anteriores.
- Script homologacao-manutencao.mjs cobre RLS, reservas prévias, transação de grupo/edição, aprovação, encerramento e três disputas concorrentes reais. Executar somente no Supabase local com dados sintéticos.
- Recuperação ampliada para incluir a tabela maintenance_windows. Não executar reset de ambientes persistentes.

## Verificação local (PC CQP-KAINA-72)
A partir de F3.2, testes locais substituem CI hospedada quando a cota do GitHub Actions está esgotada. Clone em C:\programacao\Educart, use npm.cmd no PowerShell. Node 24.20.0 e npm 11.19.0 disponíveis; CI histórica usava Node 22. Chromium Playwright instalado. Não instalar Docker/WSL automaticamente.

Comandos:
```powershell
npm.cmd ci
npm.cmd audit --audit-level=high
npm.cmd test -- --run
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Sem Docker, verificação suplementar SQL com PostgreSQL embarcado PGlite, sem modificar dependências do app:
```powershell
npm.cmd install --prefix .local-sql-test --no-save --no-package-lock --ignore-scripts --no-fund --no-audit @electric-sql/pglite@0.5.16
node scripts/verificar-sql-local.mjs
```
Executa as dez migrations exatas em banco em memória, com schema Auth e identidade simulados, role/RLS, guarda/destino, bloqueio, aprovação e encerramento. Não substitui Auth/JWT/PostgREST reais, concorrência do servidor ou backup/restore físico.

Resultados observados: F3.1 build, 71 unitários e 45 E2E aprovados, dois testes 3D legado ignorados. F3.2 build, 74 unitários e SQL 10/10 migrations aprovados; suíte anterior de E2E 45 aprovados/2 ignorados. Novo caso E2E de manutenção aprovado isoladamente (1 teste); total combinado 46 aprovados e 2 ignorados. A auditoria npm local confirmou cinco entradas altas transitivas por picomatch (4.0.7 era a versão mais recente consultada no registro); não há correção indicada que preserve as versões já homologadas. Não usar npm audit fix --force cegamente ou desativar o gate. O PR #44 permanece pendente por esse alerta, apesar de recuperação real aprovada na CI anterior; #45 depende dele.

## Aceite pendente
Homologação transacional com Supabase local real, concorrência, testes em dispositivos físicos e integração das branches após resolução da auditoria. Nenhum dado de produção foi alterado. Próxima: F3.3, retirada e devolução.

# F6.1 — Backup, continuidade e recuperação
Base: PR #61 (F5.6). Estado: ensaio isolado aprovado; configuração e homologação operacional pendentes. Não executar restore, configurar serviços pagos, exportar dados reais ou criar agendamentos em produção sem aprovação da TI. Não desbloqueia gates da F5.6.

## 1. Spec Kit — objetivos e critérios
RF-B01: recuperar banco, vínculos de Auth, reservas, movimentações, manutenção, auditoria, dados espaciais e configurações de autorização de uma cópia verificável.
RF-B02: separar banco, objetos Storage, configurações/segredos de Auth, Edge Functions, SMTP e deploy. Não publicar material sensível.
RF-B03: validar integridade antes de restaurar; testar restauração em destino independente com envio de e-mail e demais integrações desligados.
RF-B04: confirmar saldo e RLS pós-restore; impedir reprocessamento cego de outbox/leases e não misturar registros posteriores com snapshot.
RNF-B01: definir meta de perda de dados (RPO) e tempo até retomada (RTO); medir, documentar e obter aprovação. 
RNF-B02: criptografia em repouso/trânsito, controle de acesso, cópias em domínio de falha independente, retenção e descarte aprovados.

## 2. Metas propostas (não SLA contratado)
| Indicador | Proposta | Validação necessária |
|---|---|---|
| RPO | 24 h | Cópia íntegra diária; monitorar último ponto de recuperação válido. Se a operação exigir menos, avaliar PITR/frequência e custo. |
| RTO | 4 h | Cronometrar incidente até retomada real, incluindo tamanho, reconfiguração, validação e DNS. O ensaio local não comprova a meta. |
| Retenção | 7 cópias diárias + 4 semanais | TI e responsável pelos dados aprovam custo, finalidade, política de retenção e descarte; não tratar como obrigação legal. |
| Ensaio | Mensal e antes de mudanças críticas | Restaurar em ambiente autorizado, separado; evidências sem dados pessoais. |

Responsáveis a designar: operador de backup (execução/alertas), administrador Supabase (acesso/restore e segredos), QA/TI do estabelecimento (teste operacional e aprovação), responsável pelos dados (retenção, acesso e descarte). Nome, contatos de escalonamento e substitutos ficam no registro interno, fora do Git público.

## 3. Estratégia operacional conforme plano
1. No Dashboard do projeto correto, confirmar referência, plano contratado, versão PostgreSQL, tamanho e recuperação disponível em Database > Backups. Não inferir o plano. Em plano sem backups gerenciados utilizáveis, estabelecer exportação lógica diária em executor institucional autorizado; planos com backup gerenciado: conferir janela/retensão e manter cópia independente conforme política. PITR é opção condicionada a plano, custo, RPO e aprovação.
2. Para exportação lógica, seguir procedimento oficial atualizado do Supabase: exportar papéis, esquema e dados; preservar histórico de migrations separadamente e verificar personalizações de auth/storage. Usar CLI compatível e conferir versão/ajuda (mudanças da CLI v3), Docker/psql conforme guia. Não usar dump SQL do PGlite para recuperar instância hospedada. Se necessário, congelar alterações durante exportação de múltiplos componentes ou documentar snapshot consistente segundo ferramenta aprovada. Evitar usar transaction pooler; usar conexão direta ou session pooler conforme rede.
3. Fonte e destino devem ser explicitamente identificados; executar credenciais por canal seguro (cofre ou variável injetada pelo executor; não digitar senha em argumentos/histórico, registrar URI/token ou enviar ao chat). Conta autorizada para backup; acesso mínimo possível e segregação de restauração. Diretório de saída fora da árvore Git, permissões restritas; cifrar antes de enviar à cópia independente. Não usar GitHub Actions nesta fase (cota indisponível); usar agendador institucional com confiabilidade monitorada. Nenhuma rotina agendada foi ativada.
4. Registrar manifestos com data UTC, referência do projeto (em registro interno), versões CLI/PostgreSQL, estado e versão do schema, arquivos esperados, tamanhos e SHA-256. Validar exit code, completude e hashes; só marcar sucesso após armazenamento cifrado e confirmação da segunda cópia. Hash detecta corrupção acidental, não autentica origem; proteger manifesto e chave em domínio de confiança. Alertar TI se idade da última cópia válida superar meta, quando faltar arquivo ou quando cópia/restore falhar. Não eliminar última cópia válida antes de confirmar sucessora.
5. Storage: backup de banco não inclui os bytes dos objetos. Inventariar buckets e objetos efetivamente usados, conteúdo, metadados/versionamento e ACL, restaurar por mecanismo suportado e comparar hashes/contagens. Não assumir que Storage está vazio sem inspeção autorizada. Manter modelos físicos privados e ativos públicos versionados no Git. Configurações Auth (redirects, SMTP, provedores, políticas), Edge Functions, cron, webhooks, cofre/segredos, chaves e Pages devem ter inventário e procedimento próprios; valores secretos apenas em cofre. Backups de roles não recuperam todas as senhas.
6. Retenção: expirar cópias autorizadas, auditar acesso, proteger contra exclusão acidental e limitar dados pessoais aos responsáveis. F6.2 deve receber alertas de idade, sucesso e duração, sem logging de conteúdo.

## 4. Runbook de incidente e restauração
1. TI classifica a perda (corrupção, exclusão, erro de migration ou indisponibilidade) e registra momento e alcance. Preservar evidências e snapshot atual quando seguro. Bloquear novas escritas/worker de e-mail e avisar responsáveis antes de alterar tráfego. Não restaurar sobre produção como primeira ação.
2. Selecionar ponto imediatamente anterior ao erro; validar manifesto, hashes, formato, origem e versão. Se falhar, rejeitar candidato e selecionar anterior; informar perda prevista em relação ao RPO. Chave de recuperação deve estar disponível por custódia separada.
3. Preparar projeto/destino independente, sem credencial de produção, sem integração/cron/webhook de produção, sem e-mail real nem tráfego público. Conferir separação de host/ref e confirmar que está vazio/descartável. Backups podem conter informações pessoais e jobs ativos: usar ambiente com acesso restrito e impedir side effects antes de permitir conexão/execução; quando possível usar restauração lógica revisada. Nunca usar restauração destrutiva em projeto existente sem plano e aceite. Seguir guia apropriado ao tipo de backup, versão e plataforma; restaurar migrations e configuração separadamente quando necessário.
4. Validar contagens e hashes lógico-funcionais em tabelas críticas, integridade de FKs, reserva/período/notebook, manutenção e disponibilidade, vínculos de professor/admin, RLS/anon, logs e Storage. Testar login com identidades sintéticas e cenários de concorrência no ambiente autorizado. Não executar fixtures de escrita na produção. Reconciliar operações posteriores ao ponto restaurado; tratar alterações de inventário físico com TI. Não copiar estados de lease/outbox diretamente para envio: manter worker e canal desligados, revisar PENDING/LEASED/SENT/REVIEW e confirmar efeitos externos para evitar reenvio. Revogar/recriar sessões e segredos conforme incidente e plataforma.
5. QA aprova evidências, DBA registra RPO observado e RTO total, responsável autoriza retorno. Somente mediante autorização explícita: reconfigurar URL/chaves corretas e promover tráfego; smoke test portal, reservas, consulta pública, permissões e notificações. Plano de retorno: manter fonte original isolada, reverter direcionamento se necessário e não apagar evidências. Atualizar contatos e lições aprendidas.

## 5. Ensaio executável (somente sintético)
No clone de teste, Node 24 e dependência fixada no prefixo local, fora do pacote do produto:
    npm install --prefix .local-sql-test --ignore-scripts --save-exact @electric-sql/pglite@0.5.16
    node scripts/ensaiar-f6-1-recuperacao.mjs

O script cria base PGlite em memória, aplica migrations reais, popula registros fictícios e gera snapshot físico gzip em pasta temporária restrita. Não aceita URL de banco, credencial, arquivo externo nem conecta a Supabase. Valida hash/tamanho, simula corrupção e truncamento, cancela reserva na fonte depois do snapshot, restaura instância independente e compara SHA-256 lógico de cada tabela (ordem determinística). Verifica reserva, manutenção, notebook vinculado, destino, auditoria, saldo público, RLS e fila de e-mail desativada, além de executar regressão read-only sobre o destino. Confirma operação autorizada pós-restore e limpa artefatos temporários, sem commitar backup.

### Evidência observada em localhost
Dispositivo Android ARM64, Debian 13 via PRoot/Termux, Node 24.9.0 e PGlite local da F5.6. Checkout 3f3108f7693ccdcd8f2b6cdb4d98889db4f0f6fe; exit 0.
- 13 migrations aplicadas; registros fictícios criados.
- Arquivo: 5.040.920 bytes; SHA-256 90be1f9196c635c1d1e1f6cff7bf33fbb161aea5883ac6dff770b8da30cb1429.
- Backup 3.454 ms; recuperação e validação 3.705 ms; execução completa 21,98 s. Uma execução com dados sintéticos (não representa RPO/RTO de produção).
- 28 tabelas / 29 linhas conferidas por fingerprint; corrupção e truncamento rejeitados.
- 3 equipamentos reservados e 7 livres preservados no destino; fonte sofreu cancelamento após snapshot (10 livres). Manutenção, vínculo, auditoria, administração, professor, usuário sem vínculo, anônimo e saldo público verificados.
- Operação legítima posterior aprovada; fila presente e canal desativado sem envio externo. Nenhuma alteração em banco hospedado, dependências do produto, migrations, main, deploy ou Actions.

## 6. Gate F6.1
[x] Especificação e runbook.
[x] Ensaio sintético de perda/recuperação com arquivo e verificação de integridade.
[x] Verificação funcional e RLS com claims simuladas pós-restore.
[ ] TI aprova responsáveis, metas, política de retenção, plano e agendador.
[ ] Confirmar backups existentes, armazenamento independente cifrado, alertas e acesso ao cofre.
[ ] Restaurar backup real autorizado em homologação segregada (Auth/JWT, PostgREST, Storage, configuração, concorrência e reprocessamento de eventos); medir RPO/RTO real.
[ ] Documentar aceite operacional sem dados sensíveis. F6.4 bloqueada enquanto critérios críticos F5.6/F6.1 abertos.

## Referências oficiais (consultadas em 18/11/2026)
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/clone-project
- https://supabase.com/changelog/supabase-cli-v3

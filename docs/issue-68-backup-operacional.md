# Issue #68 — Preparação operacional de backup e recuperação

Data: 18/11/2026. Base: PR #75. Status: **inventário remoto consultado e verificador de cópias testado; backup/restore operacional ainda não executado**.

## Inventário por conexão Myhouse

Consulta somente leitura ao projeto Educart pela conexão Supabase do plugin:

| Item | Evidência |
|---|---|
| Projeto | ACTIVE_HEALTHY, PostgreSQL 17.11 |
| Organização | Plano Free |
| Histórico aplicado | 8 migrations, última 20261117144930 (least privilege) |
| Candidata do repositório | 13 migrations; cinco não constam no histórico remoto |
| Tabelas de negócio | 12 tabelas public; nenhuma sem RLS; 23 políticas |
| Schema Auth | 27 tabelas internas |
| Storage | 0 buckets e 0 objetos na consulta |
| Homologação | Nenhum branch Supabase separado encontrado |
| Canal de e-mail da candidata | Tabela email_delivery_settings ainda ausente no schema remoto |

A quantidade de tabelas públicas sem RLS não demonstra que todas as políticas são corretas; aceite de permissões e concorrência continua na #67. O inventário não consulta conteúdo de reservas, usuários ou arquivos. O histórico remoto não foi alterado. Storage vazio é uma constatação pontual, não dispensa nova conferência antes de cada backup. Não confundir o snapshot da versão atual com a candidata de 13 migrations.

## Estratégia compatível com o plano contratado

A documentação oficial [Database Backups](https://supabase.com/docs/guides/platform/backups), atualizada em 12/11/2026, informa que backups diários gerenciados acessíveis são previstos para Pro, Team e Enterprise; para Free recomenda exportação lógica periódica e cópias externas ao provedor. Não foi possível consultar o catálogo de backups pelo plugin atual, que não disponibiliza operação de listar, exportar ou baixar backups. A operação restore_project do plugin é retomada de projeto pausado, não restauração de ponto histórico.

Adotar exportação lógica externa, após aceite da TI, segundo o guia [Backup e restore pela CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Não transferir credenciais ou conteúdo real pelo chat, GitHub ou logs. Não habilitar cobrança, PITR, agendamento nem restaurar produção por esta fase.

Metas propostas, **não aprovadas**: RPO 24h, RTO 4h, sete cópias diárias e quatro semanais, ensaio mensal em destino separado. Definir operador, custodiante das chaves, responsável pelos dados, QA e responsável pelo aceite. Cópia cifrada primária e cópia secundária sob domínios de falha separados, acesso restrito e retenção autorizada.

## Verificador entregue

Rotina offline, sem dependências extras, sem acesso à rede, sem ler dados de produção:

- `backup:record`: registra manifesto de um artefato já criado e cifrado por procedimento autorizado. Não exporta ou cifra arquivos, não sobrescreve manifesto preexistente.
- `backup:verify`: valida duas cópias de manifesto e arquivo, referência esperada, versão major PostgreSQL 17, timestamps UTC, histórico ordenado de migrations, escopo declarado e inventário Storage; compara tamanho e SHA-256 em streaming.
- Bloqueia diretórios dentro do repositório, diretórios iguais/aninhados, arquivos redirecionados, links simbólicos/junctions, cópias com o mesmo inode quando detectável, metadados maiores que 16 KiB, formato inválido, corrupção e truncamento. Usar diretório restrito sem escritores concorrentes.
- Calcula idade conservadora desde o início da captura, sem arredondar para decidir a meta de 24h. Resultado inclui cópias verificadas, bytes, número de migrations, idade e fresh. Sai com código 1 se cópia inválida ou vencida.
- Log de erro genérico, sem imprimir caminho, segredo, conteúdo ou manifesto. Nenhuma remoção, decifração ou restauração automática.

### Contrato do pacote

Cada diretório externo protegido deve conter `backup.age` (arquivo age binário cifrado pelo operador autorizado) e `manifest.json`; na primeira cópia, `metadata.json` é utilizado para registrar o manifesto. Dentro do pacote cifrado, incluir exportação de roles, schema, data, histórico de migrations, informações/objetos Auth necessários e inventário de configuração. O inventário de configuração não contém os valores de segredos; recuperação de segredos permanece em cofre separado. Se Storage não estiver vazio, incluir cópias verificadas de objetos e metadados ou adaptar o procedimento antes de aceitar.

Exemplo **sintético** de metadata.json, substituir valores com evidências do backup efetivo sem introduzir informação pessoal:
```json
{
  "schemaVersion": 1,
  "projectRef": "abcdefghijklmnopqrst",
  "startedAt": "2026-11-18T12:00:00.000Z",
  "completedAt": "2026-11-18T12:10:00.000Z",
  "postgresMajor": 17,
  "migrations": ["20261115145429", "20261117144930"],
  "scope": ["roles", "schema", "data", "migration-history", "auth", "configuration-inventory"],
  "storage": "empty-verified",
  "format": "age-binary-v1"
}
```

A lista de migrations deve corresponder integralmente ao histórico do instante de captura; o exemplo abreviado não é o histórico do Educart. Use diretórios externos previamente aprovados. Com o bundle cifrado disponível no primeiro diretório, execute:

```sh
npm run backup:record -- /copia-primaria abcdefghijklmnopqrst
# Copiar backup.age e manifest.json para armazenamento independente autorizado.
npm run backup:verify -- /copia-primaria /copia-secundaria abcdefghijklmnopqrst
npm run test:backup
```

Manifestos e arquivo devem estar sob controle de acesso e confiança. Hash e cabeçalho age detectam inconsistências, **não comprovam autenticidade, segredo de chave, criptografia válida, domínio físico independente, consistência transacional ou completude dos dados**. O escopo é declarado pelo operador; restoreVerified é sempre false. Um manifesto atualizado sozinho não prova cópia válida; não avançar no caso de erro. Verificar decifração, conteúdo, reconciliação e restauração segregada conforme [runbook F6.1](f6-1-backup-recuperacao.md). Não utilizar fixture deste teste como arquivo real.

## Evidência

- Commit 3190ac7c035fb9b343608e63f29251cfcc60ce30, PC CQP-KAINA-72 Node 24.20.0: 10/10 testes Node aprovados, zero skips, exit 0. Casos sintéticos: duas cópias, manifesto exclusivo, idade, alteração de mesmo tamanho, truncamento, formato, projeto/horários/escopo incorretos, divergência, ausência, limite de metadados, junction, hardlink e saída dentro do repo.
- Diff sem alterações em src, supabase e package-lock.json.
- Ensaio F6.1 reexecutado na #67 (c88d1f8): 13 migrations, recuperação sintética de 28 tabelas/29 registros, corrupção/truncamento rejeitados, acesso por RLS simulado; backup 567 ms e recuperação 423 ms. Não equivalem a RPO/RTO operacional. Nenhum snapshot real foi exportado.
- Sem configuração de scheduler, transferência de dados, migrations aplicadas, ativação de serviço pago, restore, merge ou publicação. Sem execução deliberada de GitHub Actions.

## Pendências de aceite

- [ ] Aprovar metas, operadores, cofres e destino independente, custo, política de retenção e horário de execução.
- [ ] Preparar exportação lógica real autorizada, executor e credenciais restritas; confirmar consistência e histórico atual.
- [ ] Gerar duas cópias cifradas, manifestos íntegros e prova de decifração sob custódia.
- [ ] Restaurar em ambiente independente com efeitos externos desativados; validar Auth, RLS, reservas e demais integrações, reconciliar dados e medir RPO/RTO real.
- [ ] Integrar resultado agregado do verificador à política de alertas da #69, sem divulgação de dados/segredos.
- [ ] Fechar #68 somente após aceite operacional. #69 pode avançar na preparação sem afirmar backup ativo.

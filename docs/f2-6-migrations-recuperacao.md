# F2.6 — Validação das migrations e ensaio de recuperação

## Constituição
Nunca restaurar no projeto de produção durante a homologação. Não apagar dados, não aplicar migrations históricas novamente e não publicar dumps, chaves, hashes de senhas ou sessões. Validar recuperação em runner descartável antes de recomendar operação real.

## Reconciliação do histórico
Em 17/11/2026, consulta somente leitura ao histórico remoto verificou oito registros. Comparação exata de statements[1] com o conteúdo UTF-8 de cada arquivo local: **8/8 idênticos**, inclusive espaços e quebras de linha. Cada registro remoto continha um único elemento statements. MD5 remoto abaixo é evidência de identidade de conteúdo, não mecanismo criptográfico de backup. Sete arquivos renomeados em um commit (fcbc442), zero alterações de conteúdo, ordem preservada. Nenhuma execução SQL de escrita, nenhum migration repair, link ou db push remoto.

| Nome anterior | Nome reconciliado | MD5 |
|---|---|---|
| 20261115120000_phase1_foundation.sql | 20261115145429_educart_phase1_foundation.sql | 0c1c12511633cd8c47f44440effdbd73 |
| 20261115183000_phase2_reservations.sql | 20261115170352_phase2_reservations.sql | 5403b860ccd3d6905509749376fa4f3c |
| 20261115192000_phase3_management.sql | 20261115172228_phase3_management.sql | d0bf6d96a5efbdc7717e6333b01680ca |
| 20261115212000_phase6_teacher_requests.sql | 20261115202313_educart_phase6_teacher_requests.sql | 8fae688bb4619a7365d510eda35c352d |
| 20261115220000_phase7_notifications.sql | 20261115210806_educart_phase7_notifications.sql | ae1aa28f5d656d1fe63bf001628d1057 |
| 20261115233000_phase8_teacher_availability.sql | 20261115214535_educart_phase8_teacher_availability.sql | 924f46db04779ced884d6d30e2b25749 |
| 20261116000000_public_cart_availability.sql | 20261116134002_educart_public_cart_availability.sql | 14ccafba78988b26865e2bb524c60dcb |
| 20261117144930_educart_f1_1_least_privilege.sql | sem alteração | cc9d6f5003f8010901b7e59fa3257682 |

Referências antigas em documentos históricos são preservadas enquanto evidências da época. Use os novos nomes ao inspecionar migrations atuais. Desenvolvedores com stack local persistente criado antes da mudança devem preservar seus dados e recriar em ambiente descartável ou reconciliar o histórico de forma controlada; não executar reset em banco com dados necessários.

## Suite de recuperação
Workflow dedicado recuperacao.yml; runner hospedado e stack local separados de produção. Scripts F1.4/F2.1 geram dados de teste usando API/Auth real. Script homologacao-recuperacao.mjs exige sinalizadores de runner descartável, URL de API e banco exclusivamente loopback, ausência de credenciais cloud e container esperado.
1. Conferir que migrations aplicadas correspondem aos nomes versionados e que RLS e grants estão corretos.
2. Criar contas sintéticas, vínculo, solicitação, aprovação e avisos; capturar contagens e digests das 12 tabelas de negócio e auth.users/auth.identities.
3. Gerar arquivo pg_dump custom data-only com essas tabelas, verificar SHA-256 e proteger o arquivo temporário.
4. Recriar banco local descartável com migrations e **verificar destino vazio** antes de restaurar. Nunca executar este procedimento sobre um ambiente persistente.
5. Restaurar dados em transação única no schema recriado, sem restaurar sessões/tokens antigos; comparar contagem e digest de cada tabela.
6. Autenticar novamente TI, professor e conta sem vínculo; conferir reserva, aviso, saldo, isolamento e cancelar a reserva recuperada para comprovar escrita autorizada.
7. Excluir dump temporário; não fazer upload dele; descartar stack.

## Aceite e limites
- [x] Comparação exata dos oito SQLs e alinhamento dos sete nomes no Git.
- [x] Suite automatizada e workflow independente, sem dependência de WebKit.
- [ ] Aprovação do ensaio e registro do tempo efetivamente medido.
- [ ] F2.5: corrigido botão Atualizar disponibilidade que falhou no alvo de toque de 44px; reexecutar CI antes de integrar #43.
- [ ] Integrar F2.6 após aprovação de ambos os PRs.
Este é um ensaio lógico de dados de negócio e contas Auth sobre schema reproduzido por migrations, não um backup completo de plataforma. Roles customizadas, storage blobs, secrets, SMTP, configs de Auth, edge functions e sessões não estão cobertos. PostgreSQL local/CI não representa garantia de RTO/RPO em produção. Não testar restauração produtiva nem alterar retenção nesta etapa.

## Procedimento de produção a preparar na F6.1
1. Responsável autorizado confirma plano Supabase, backups disponíveis, retenção, PITR e janela de manutenção no Dashboard; registrar RPO/RTO acordados, sem presumir cobertura.
2. Antes de mudança, registrar SHA da aplicação, migrations, schema e configuração não secreta; backup cifrado em armazenamento restrito, independente do Git.
3. Em incidente, suspender alterações conflitantes, identificar horário e escopo, restaurar preferencialmente para um projeto separado autorizado conforme documentação oficial; validar contagens, RLS, Auth, reservas, relatórios e disponibilidade antes do cutover.
4. Trocar endpoint/chaves publicáveis apenas após autorização; usuários reautenticam; restaurar separadamente objetos e configuração da plataforma se necessário. Não restaurar sessões antigas. Registrar resultado, duração e perda efetiva de dados.
5. A F6.1 deverá definir frequência, retenção, responsáveis, procedimento de recuperação e verificação recorrente. Custos e acesso a backup hospedado não foram confirmados pelo conector.

Referência: https://supabase.com/docs/guides/self-hosting/restore-from-platform e https://supabase.com/docs/guides/platform/backups.

Próxima etapa: F3.1 — cadastro de campus, blocos e salas, após aceite F2.5/F2.6.

# Issue #69 — Monitoramento institucional e alertas

Data: 18/11/2026. Base: PR #76. **Monitor executável e ensaio aprovados; operação institucional ainda não ativada.**

## Especificação e implementação

O monitor externo executa uma verificação por chamada, em Node, sem dependências adicionais e sem GitHub Actions. Não implanta serviços, não altera bancos, não registra usuários, não envia mensagens por conta própria. Mantém um único estado agregado fora do Git, substituído atomicamente, com bloqueio de execuções concorrentes. A configuração deve permanecer em diretório privado, com permissões restritas ao operador; a assinatura SHA-256 da configuração vincula o estado ao alvo e aos caminhos esperados. Mudança de configuração exige arquivar estado e revalidar; não reutilizar evidência de outra versão. A assinatura não é mecanismo de autenticação do estado.

### Política proposta (pendente de aceite institucional)

| Verificação | Cadência | Alerta |
|---|---|---|
| HTTP do deploy + entrada JavaScript + SHA de version.json | 5 min | Incidente após 3 falhas consecutivas; recuperação após 2 sucessos |
| Evidência de deploy | A cada leitura do estado | Desconhecida após 15 min sem verificação; lacuna reinicia sequência, não encerra incidente |
| Duas cópias de backup (#68) | Diária, após exportação/cópia | Imediato quando integridade falha; idade superior a 24h (desde início da captura) gera alerta |
| Evidência de backup | A cada leitura do estado | Desconhecida se inexistente ou última verificação bem-sucedida há mais de 26h; falha registrada continua inválida |
| Processo monitor | Agendador independente | Falta de execução/exit 2 requer escalonamento; o monitor não detecta sozinho que seu próprio executor parou |

Cadências são propostas, não SLA. Os estados intermediários de falha antes de três ocorrências são degradados, não saudáveis. O SHA esperado deve corresponder à versão autorizada publicada. O teste verifica HTML Educart, asset JS e versão, não execução JS, banco, login, RLS, disponibilidade global ou todas as rotas. O endpoint não recebe credenciais. O monitor não substitui a homologação da #67 nem o painel local F6.2. O backup só comprova integridade de artefatos e escopo declarado, não decifração, consistência transacional ou restore; restoreVerified permanece false. Nenhuma evidência de backup real foi fornecida.

## Operação pelo mantenedor

Criar diretório **fora do repositório** em armazenamento institucional protegido. Exemplo de config.json (todos os valores abaixo fictícios, não constituem autorização para monitorar um alvo):

```json
{
  "deployUrl": "https://example.invalid/Educart/",
  "expectedSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "backupPrimary": "/backup/primario",
  "backupSecondary": "/backup/secundario",
  "projectRef": "abcdefghijklmnopqrst"
}
```

No Windows utilizar caminhos absolutos Windows no JSON, escapados conforme a sintaxe JSON. A URL deve ser HTTPS autorizada, sem credenciais, query ou fragmento, terminada em barra; HTTP permitido apenas em loopback para ensaios. Não registrar chaves Supabase ou credenciais no arquivo. Os diretórios de backup devem apontar para as duas cópias autorizadas verificáveis conforme #68. Não apontar para outros sistemas.

```sh
npm run monitor:check -- deploy /diretorio-privado-monitor
npm run monitor:check -- backup /diretorio-privado-monitor
npm run monitor:check -- status /diretorio-privado-monitor
npm run test:monitor
```

O modo deploy consulta somente o alvo HTTP e o estado agregado do backup; não recalcula checksums do backup a cada 5 min. O modo backup valida os dois artefatos locais e atualiza evidência de idade exata (milissegundos, sem arredondamento na decisão), sem rede. O modo status não gera verificação nova e não modifica estado. Não executar modos em paralelo; o lock impede duas execuções. Se houver interrupção abrupta, conferir que não há execução ativa antes de remover o diretório de lock vazio; nunca remover lock de processo em execução.

Saída JSON agregada: deployment (unknown/degraded/healthy/incident), backup (unknown/invalid/stale/verified), deployIncident, alerts, checkedAt, deployCheckedAt, backupCheckedAt, backupAgeHours, restoreVerified, event (deploy-open, deploy-recovered ou null), mode. Não inclui URL, SHA de release, caminhos, segredo, payload, mensagem de erro remota, dados pessoais, IP ou identificação de usuário.

- Exit 0: sem alerta ativo (pode estar degradado antes do limiar; consultar deployment).
- Exit 1: pelo menos um alerta ativo, inclusive evidência ausente; não significa necessariamente indisponibilidade do servidor.
- Exit 2: configuração, estado inválido, relógio ou lock; saída genérica. Não interpretar como sucesso nem reinicializar estado automaticamente.

O estado persiste o incidente/alertas entre execuções, enquanto eventos de transição aparecem na saída da rodada. A entrega de alertas depende de um agendador e canal aprovados que capturem também eventos de recuperação e saídas não zero. Deduplicar por categoria de incidente; registrar recebimento, responsáveis e resolução; não descartar alerta ativo por perda de evento. Supervisor externo deve detectar ausência de heartbeat. Sem integração de envio implementada nesta fase; não assumir entrega ou disponibilidade 24/7. Se versão/configuração mudar, arquivar evidência anterior e iniciar estado novo sob aprovação; investigar incidente anterior antes de arquivar.

## Privacidade e responsabilidades

O painel local F6.2 mantém métricas efêmeras de RPC/Auth/rede sem identificadores. Para métricas reais, consultar a conexão Myhouse do Supabase e painel autorizado: 429/5xx, limites e latência agregada; não enviar logs com corpos, tokens, cabeçalhos ou identidades. Não inferir métricas institucionais a partir do probe HTTP. Estado local armazena apenas último resultado, contadores limitados, timestamps, idade e hash de configuração; não há histórico crescente. Quando for aprovado capturar stdout em canal/repositório interno de operação, limitar retenção proposta a 30 dias, acesso por função, descarte e auditoria. Não fazer log do config.json ou publicar estado em GitHub Pages. Designar responsáveis por executor, backup, incidente, custódia, alertas e aceite; não presumir nomes, contatos ou custos.

## Evidência

CQP-KAINA-72 (Windows, Node 24.20.0), commit 07202232a7a3a078f3292fa083471902fb4a5b8c:
- 10 testes do monitor, 10 do backup, 4 do probe: **24/24 aprovados**, zero skips/falhas, exit 0.
- Ensaio HTTP real loopback em porta efêmera com HTML/JS/version.json fictícios e duas cópias sintéticas: saudável, três 503 abrem alerta, dois sucessos confirmam recuperação, arquivo secundário alterado gera backup-invalid.
- Testes de SHA incorreto, respostas excessivas, redirecionamento, evidência expirada, lacunas, estado corrompido, execução concorrente, mudança de configuração e não exposição de dados na saída.
- Diff sem alteração em src, supabase e package-lock.json. Não consultado site de produção, não instalado scheduler, não enviado alerta externo, não gerado backup real, não configurado Supabase, não alterado main, não publicado nem deliberadamente acionado Actions.

## Aceite restante

- [ ] Aprovar destino/versão reais, executor independente disponível e configuração protegida, cadências, responsáveis e política de privacidade.
- [ ] #68: disponibilizar cópias reais autorizadas e validar restore; conectar evidências ao monitor sem conteúdo sensível.
- [ ] Agendar verificações, supervisor de heartbeat, canal institucional, deduplicação e confirmação de entrega; testar aviso e recuperação reais em ambiente controlado.
- [ ] Confirmar métricas agregadas de Auth/RPC e latência em ambiente autorizado, limites do plano e política de retenção.
- [ ] Registrar aceite TI, verificar não há dados pessoais ou credenciais e fechar #69 somente após validação operacional. #70 pode avançar na preparação.

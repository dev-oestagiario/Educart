# F6.2 — Operação e monitoramento

Diagnóstico local por aba, restrito à interface administrativa; não é monitoramento centralizado. Janela de 15 minutos, máximo 1.000 amostras; somente categoria fixa, resultado, duração e instante em memória. Descarte por idade e troca de conta, sem exportação ou armazenamento persistente. Não coletar URL, corpo, mensagens, headers, credenciais, IP ou identidade. P95 de respostas 2xx; HTTP 4xx de negócio separado de falhas de transporte; 429, 5xx e rede sinalizados quando pelo menos 3 falhas e taxa >=20%; latência >=2s com ao menos cinco respostas 2xx. Limiares provisórios, sujeitos a aceite TI.

## Operação institucional (pendente de autorização)
- Executor independente: verificar deploy com `node scripts/verificar-saude-deploy.mjs URL_BASE` a cada 5 minutos (proposta). Exit 0 = HTML e bundle JS verificados; 1 = falha; 2 = configuração inválida. Não confirma login, banco ou execução JS. Não seguir redirects nem registrar conteúdo.
- Alertar TI após 3 falhas consecutivas; confirmar recuperação após dois sucessos. Não usar GitHub Actions. Canal institucional, responsáveis e custo a confirmar.
- Conferir diariamente último backup íntegro: idade superior a 24h gera alerta segundo RPO proposto da F6.1; ausência de evidência significa desconhecido, não saudável.
- Em homologação autorizada executar smoke de RPC público, login e consulta autenticada sintética; jamais criar reservas de teste na produção. Consultar métricas Supabase e limites do plano, incluindo 429/5xx. Evitar logs de dados pessoais. Retenção proposta de agregados operacionais 30 dias, sem identificadores; aprovação institucional pendente.
- Escalonamento: TI verifica incidente, rede, deploy e banco; não repetir automaticamente mutações, preservar idempotência e orientar operadores. Registrar somente categoria, janela, severidade, status e ação tomada. Aplicar runbook F6.1 se houver perda de dados.

## Gates
Não ativado monitor externo, agendamento ou envio de alertas. Testes de navegador e homologação Supabase real seguem pendentes; não autorizar publicação nem habilitar 3D. Painel local não comprova SLA ou disponibilidade global.

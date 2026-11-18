# Monitoramento remoto com Sentry

O Educart não depende de computador pessoal ou da TI para executar a captura de falhas no navegador. O SDK fica desativado sem DSN válido, inclusive em desenvolvimento/homologação. O diagnóstico local anônimo permanece disponível.

## Ativação
1. Crie/selecionе um projeto JavaScript/React na organização Sentry autorizada.
2. Em Settings → Projects → Client Keys (DSN), copie a DSN pública.
3. No repositório GitHub, configure uma variável de Actions chamada VITE_SENTRY_DSN. A publicação deve passar pelo fluxo de release vigente. A DSN é pública; jamais use token de API ou outra credencial secreta no bundle.
4. Após publicar, confirme em ambiente autorizado a chegada de um evento controlado, configure alertas por categoria e retenção adequada. Não provoque falhas em produção com dados reais.
5. Para disponibilidade sem tráfego, configure um monitor externo HTTP (Sentry Uptime, se disponível no plano) para a URL pública do Educart. Isso é independente da captura SDK.
6. Para desativar a captura remota, retire a variável e republique.

## Privacidade
Apenas mensagens fixas por categoria, release SHA e timestamp/ID técnico do evento são enviados. Não enviamos conteúdo de erros, e-mails, nomes, URLs, parâmetros, tokens, payloads, trilhas de navegação ou dados de reservas. Sem replay, tracing, sessão automática ou integrações padrão. Limite por categoria de um evento por minuto por instância do aplicativo. O provedor de rede ainda recebe o IP da conexão; revisar processamento, retenção, scrubbing e contrato de tratamento antes de ativar. Não confundir captura de falhas com backup ou prova de disponibilidade contínua.

Monitoramento externo substitui a tarefa agendada local retirada de CQP-KAINA-72. Nenhuma tarefa de segundo plano deve ser instalada no computador de trabalho sem autorização expressa. A tarefa #69 só pode ser encerrada após confirmação real de ingestão, alertas e monitor externo conforme escopo aprovado.

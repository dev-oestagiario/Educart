# Checklist de operação e publicação — F6.4

A F6.3 entrega documentação; não aprova release. Cada item precisa de evidência e responsável, no ambiente autorizado. Não marcar por suposição. Nenhuma publicação automática deve ocorrer nesta fase.

## Preparação e segurança
- [ ] Inventariar PRs empilhados, base/head e conflitos, definir SHA candidato e ordem de integração. Preservar main até aprovação.
- [ ] Instalação de dependências reproduzível, typecheck, build, unitários, audit sem achados altos/críticos não resolvidos; tratar picomatch registrado na F5.6.
- [ ] Revalidar matriz RLS/roles, JWT/PostgREST real, isolamento de professor, recuperação de senha, concorrência, reserva/manutenção/movimentação e dados públicos.
- [ ] Verificar schema/migrations e restore em homologação separada; TI aprova RPO, RTO, retenção e responsáveis. Backup íntegro verificável.
- [ ] Validar frontend e E2E em navegador funcional: login, cadastros, importação, disponibilidade, aprovação, recorrência, relatórios/PDF, mobile, contraste, teclado, zoom e erros.
- [ ] F5.6: concluir validação GPU/FPS, raycast, WebGL fallback, referências físicas e aceite TI. Manter 3D experimental desligado enquanto não aprovado.
- [ ] F6.2: confirmar executor independente, alertas, destinatários, retenção e funcionamento do probe. Sem logs de segredo/dado pessoal.
- [ ] E-mail: manter canal/worker desativados enquanto provedor, adapter, testes, custo e política não aprovados.
- [ ] TI valida manuais e endereços, designa suporte/contatos e aprova operação. Nenhum software para instalar pelos usuários.

## Publicação controlada
- [ ] Responsável autoriza migrações e promoção. Registrar backup/ponto de retorno, versão do banco e configuração.
- [ ] Revisar PRs e integrar somente sequência validada. Workflow Pages depende de main, audit, testes, E2E e build; cota de Actions indisponível deve ser resolvida com caminho autorizado, sem ignorar verificações.
- [ ] Confirmar artefato, destino Pages e version.json correspondentes ao SHA candidato; validar rotas e assets relativos.
- [ ] Smoke no endereço publicado por navegador e probe HTTP. Confirmar consulta pública sem login, ausência de informações privadas, acesso administrativo/professor com contas autorizadas e comportamento em mobile. Não criar dados fictícios em produção.
- [ ] Registrar release/tag v1.0.0 somente após aceite, changelog e versão comprovada. Registrar resultados, limitações e incidentes.

## Reversão
- [ ] Se houver regressão: conter novas escritas quando necessário, desabilitar integrações e feature experimental, preservar logs agregados.
- [ ] Reverter aplicação por PR para SHA validado; verificar compatibilidade com schema. Não presumir que rollback do frontend reverte banco.
- [ ] Restaurar ou corrigir banco apenas por procedimento autorizado descrito em [backup/recuperação](f6-1-backup-recuperacao.md), com reconciliação de operações posteriores.
- [ ] Revalidar smoke e obter autorização de retomada.

Referências: [F5.6](f5-6-homologacao-3d.md), [F6.1](f6-1-backup-recuperacao.md), [F6.2](f6-2-operacao-monitoramento.md), [catálogo de migrations](catalogo-migrations.md).

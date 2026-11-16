# Relatório de Reservas — modelo Agenda SENAI

## Referência

PDF fornecido: **SENAI - Relatorio de Reserva (Laboratorio Movel).pdf**, uma página, cabeçalho “Agenda de Reservas - Carrinhos Dell”, período da semana e emissão, agenda dividida em segunda a sexta e resumo geral da semana.

## Implementação no Educart

A tela **Calendário e relatórios** mantém os filtros existentes e a exportação CSV. O botão **Exportar PDF** produz agora uma agenda em **A4 vertical**, no estilo do documento fornecido, com:

1. Título **Agenda de Reservas - Laboratórios Móveis**, ou nome do carrinho quando o filtro de carrinho está ativo.
2. Período exportado e data/hora de emissão no fuso **America/Sao_Paulo**.
3. Blocos separados para os dias úteis do recorte, inclusive dias sem reservas.
4. Tabela de quatro colunas: **Horário, Solicitante, Equipamento / Objetivo e Sala**.
5. Linha de equipamento com nome do carrinho, quantidade caso parcial e observações quando informadas.
6. Quando o professor marcou **Precisa de mouse**, uma linha complementar “Mouses - Nome do carrinho” no mesmo dia e turno, semelhante à referência.
7. Resumo por dia da semana e total geral dos itens de agenda.
8. Rodapé com Educart e paginação; quebra automática de página ao aumentar o número de reservas.
9. Paleta impressa profissional em roxo escuro e lilás, consistente com a identidade atual do Educart.

## Precisão e regras

- **Sala**: o modelo possui a coluna, mas o banco do Educart **não tem campo de sala**. O relatório mostra **“Não informada”** para não inventar esse dado. Adicionar esse dado futuramente requer novo campo de cadastro e migração própria.
- **Linha de mouses**: representação complementar, não uma reserva adicional no banco. O resumo conta **itens apresentados**, deixando isso explícito.
- **Cancelamentos**: aparecem somente se o usuário habilitar o filtro existente; no PDF recebem rótulo **[Cancelada]**.
- **Fonte de dados**: exclusivamente os períodos/solicitantes/carrinhos já retornados pelos filtros. Nenhuma informação é simulada na exportação real.
- **Mês**: mantém todos os dias úteis do mês e soma por dia da semana, com título “Resumo Geral do Mês”.
- **CSV**: permanece com as colunas e dados existentes, sem alteração de contrato.

## Validações

- [x] Estrutura de dados pura testada com o cenário do PDF de referência (2 itens segunda, 2 terça, demais dias vazios).
- [x] Contagem distinta de períodos e linhas complementares de mouse.
- [x] Quantidade de notebooks, objetivo e cancelamento preservados na linha de equipamento.
- [x] Teste E2E do arquivo PDF verificando assinatura e página A4 retrato.
- [x] GitHub Actions aprovado — build, **60 testes Vitest** e **37 Playwright**.
- [x] GitHub Pages atualizado — nova exportação disponível no menu Calendário e relatórios.
- [ ] Revisão manual de PDF longo, conteúdo com acentos e quebras de linha em leitores de PDF.

## Escopo

Sem alterações de esquema Supabase, autenticação, RLS ou lógica de reservas. O PR deve permanecer empilhado após o PR #29.

## Evidências de execução

- [CI: 60 testes Vitest e 37 Playwright](https://github.com/dev-oestagiario/Educart/actions/runs/43780698841).
- [Publicação GitHub Pages](https://github.com/dev-oestagiario/Educart/actions/runs/43780564320).
- [Abrir Educart](https://dev-oestagiario.github.io/Educart/) → Calendário e relatórios → selecionar semana/carrinho/professor → Exportar PDF.
- Playwright valida o download e o formato A4 vertical. Revisão manual de uma amostra gerada em navegador real, conteúdo muito extenso e impressão física ainda recomendada.

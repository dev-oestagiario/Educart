# F2.4 — Homologação dos relatórios e impressão

## Escopo
F2.3 aprovada na reexecução do run 44130808377, job 134208812149, e integrada à main no PR #41 (9d50400). O primeiro job falhou antes dos testes, na inicialização do Supabase local; a reexecução passou integralmente.
F2.4 valida a exportação CSV e a agenda A4 padrão SENAI com o navegador conectado ao Supabase local. Nenhum dado ou esquema de produção é alterado.

## Correções
- Paginar os períodos e cadastros do relatório em páginas de 250 registros, com ordenação estável por identificador (e data nos períodos), evitando truncamento pelo limite de linhas da API. Buscar cabeçalhos de reservas em lotes de 100 IDs, evitando URLs longas.
- Impedir que a limpeza temporária do filtro de data gere uma data inválida.
- Separar criação e download do PDF para facilitar testes.
- Quebrar linhas extensas da agenda em segmentos de página, repetir cabeçalho do dia e das colunas nas continuações e manter o texto dentro da área imprimível.
- Preservar estrutura de quatro colunas, acentos, rodapés, resumo e linhas adicionais de mouse; sala continua Não informada enquanto F3.1 não fornecer esse atributo.

## Matriz de validação
| ID | Cenário | Aceite |
|---|---|---|
| F24-01 | Mês com mais de mil períodos ativos | Indicadores e CSV não omitem registros |
| F24-02 | Filtros por carrinho e professor | Registros externos ao recorte ausentes |
| F24-03 | Períodos cancelados | Incluídos somente com opção marcada; indicadores de ocupação não aumentam |
| F24-04 | CSV com observações multilinha | UTF-8 BOM, contagem de registros lógicos e conteúdo íntegro |
| F24-05 | PDF semanal longo | A4 retrato, várias páginas, cabeçalhos repetidos |
| F24-06 | Objetivo com 78 linhas e acentos | Texto inicial e final extraído, sem perda |
| F24-07 | Agenda com mouse e cancelamento | Linha complementar, rótulo e total corretos |
| F24-08 | Rodapés e margens | Página N de total em cada página, palavras dentro da área imprimível |
| F24-09 | Filtro sem resultados | PDF válido, dias úteis vazios e resumo zero |

## Execução
A CI de homologação inclui scripts/homologacao-relatorios.mjs após as suítes anteriores. Instala Poppler para validar metadados com pdfinfo, texto e coordenadas com pdftotext e renderizar a primeira página com pdftoppm. Dados sintéticos criados através do Auth e das RPC reais em stack descartável. Nenhuma chave privilegiada é repassada ao navegador. Arquivos temporários removidos no final.

## Limites
A paginação de consultas não é um snapshot transacional: mudanças concorrentes no período de geração podem alterar o recorte; não equivale a um relatório contábil imutável. Verificação de coordenadas em PDF e renderização automática não substituem inspeção visual humana de todas as páginas nem teste físico de impressora. Não foi obtida nova planta arquitetônica ou informação de sala.
CI e merge condicionados à aprovação. Próxima fase F2.5: homologação em dispositivos móveis.

# Educart — Fase 5: consulta 3D do carrinho

**Estado:** implementada na branch `feat/fase-5-visualizacao-3d`, PR #14 em revisão; dependente dos PRs #10–#13.

## Objetivo e público

O administrador da TI seleciona um laboratório móvel, a data e o turno e consulta a ocupação de notebooks em uma representação 3D e uma lista textual equivalente. A cena **não é a fonte da verdade** e não cadastra, reserva, transfere ou confirma equipamentos.

## Fluxo de interface

1. Abrir **Visualização 3D** pelo menu lateral, tanto no desktop quanto no mobile.
2. Escolher carrinho, data e turno.
3. O sistema consulta capacidade e ocupações ativas no Supabase.
4. Exibir indicadores de capacidade, reservados e livres; nunca usar a contagem de códigos cadastrados como capacidade.
5. Girar/aproximar a cena e clicar em uma posição ou escolher a mesma posição na lista acessível.
6. Exibir posição, situação, código quando conhecido, confirmação da identificação física, professor, data/turno, necessidade de mouse e observações.
7. Permitir desativar o WebGL e continuar a tarefa pela lista de botões, inclusive quando o dispositivo não oferecer aceleração gráfica.

## Diretrizes de design e acessibilidade

A implementação segue a skill local `.agents/skills/educart-frontend/SKILL.md` e o design da barra lateral existente.

- O componente pesado Three.js é carregado apenas ao entrar na página, por `React.lazy`.
- Painéis de filtros usam três colunas em desktop, duas em tablets e uma em celular.
- Cena e detalhes não causam rolagem horizontal a 320–390px.
- Cores de ocupado/disponível são acompanhadas por texto; a lista de posições pode ser navegada por teclado.
- Código físico nunca é inferido a partir de uma posição fictícia. Uma posição ocupada sem atribuição física é rotulada como ilustrativa.
- Se os dados não puderem ser consultados, o sistema não informa quantidades disponíveis como se estivessem confirmadas.
- O 3D não altera as regras de cancelamento/edição/reserva das fases anteriores.

## Critérios de aceite

- [x] Página e navegação adicionadas ao front-end, sem novas credenciais ou tabelas de banco.
- [x] Consulta de capacidade, reservas e identificação pelo Supabase.
- [x] Modelo Three.js, órbita/zoom/seleção, componentes responsivos e alternativa textual.
- [x] Testes unitários adicionados para capacidade numérica e rastreabilidade.
- [x] Testes de fluxo Playwright adicionados para 3D e fallback em 360px.
- [ ] Confirmar CI completo, captura visual em desktop/mobile e deploy do commit mais recente.
- [ ] Conferir usabilidade num celular físico e validar acesso de administrador com sessão real.
- [ ] Revisão do PR #14 após a integração ordenada de #10, #11, #12 e #13.

## Fase seguinte (proposta, ainda não autorizada como especificação definitiva)

Após homologar o MVP administrativo, avaliar um portal do professor para **solicitar** reservas com aprovação da TI. Será necessário especificar autenticação e separação de permissões, fluxo de aprovação/rejeição, se solicitações pendentes ocupam capacidade, notificações e testes RLS. Não liberar esse portal sem fechar essas regras operacionais.

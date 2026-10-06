# Etapa 23 — Editor, guia e legibilidade

## Fechado nesta etapa

- O card `DANO.vida_perdida` agora tem um exemplo próprio no guia. Ele diferencia dano que só consumiu escudo/vida temporária de PV removidos da Vida normal e mostra como condicionar uma carga de Rancor à perda real.
- A auditoria do guia valida que a fórmula do exemplo é aceita pelo parser e que a explicação cobre os dois resultados relevantes.
- Os quatro textos restantes com `text-[10px]` ou `text-[11px]` em `RoleSelect` foram migrados para `text-xs` (13 px na escala global do projeto). A busca não encontrou outras classes de texto arbitrárias de 7 a 11 px em arquivos TS/TSX.

## Validação

- Auditoria, dados, composição e automação do guia: 5 arquivos de teste, 759 testes aprovados.
- `git diff --check` sem erros.

## Limite conhecido

`@DANO.vida_perdida` só tem valor durante o contexto de resolução de dano. O exemplo deve ser usado num gatilho de dano; fora dele, a referência não representa um estado persistente da ficha.

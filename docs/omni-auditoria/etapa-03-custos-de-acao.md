# Etapa 3 — Custo de ação no caminho de execução

## Lacuna encontrada

`MODIFICAR_CUSTO_ACAO` gravava o tipo de ação em `Character.omniActionCost`, mas a ativação das Ações Ativas não consultava esse mapa. Assim, uma habilidade podia exibir o modificador no estado da ficha e ainda cobrar o custo configurado originalmente. Reavaliar o gatilho também reiniciava `usedThisRound`, permitindo reaproveitar um limite já gasto.

## Comportamento implementado

- A ativação procura o modificador pelo ID da entidade, ID da Ação Ativa ou nome da ação, normalizando caixa, acentos e separadores.
- Aceita somente IDs de `SYSTEM_ACTIONS`; limites por rodada precisam ser inteiros não negativos. Zero significa sem limite.
- Em combate, a ação alterada é cobrada de verdade. Uma Ação Completa consome duas Ações Comuns. Depois de esgotar um limite por rodada, a ação volta ao custo que consta na sua configuração.
- O uso do limite é registrado junto com o pagamento dos demais custos. Reaplicar a configuração mantém o consumo já realizado na rodada.
- Os limites começam zerados quando o combate inicia e continuam sendo reiniciados na transição de rodada.
- `AcaoLogica.condicao` agora documenta seu uso como parâmetro textual dependente da primitiva. A validação específica do custo é feita antes de gravar a mudança.

## Verificação

- `npx tsc --noEmit` — passou.
- `npx vitest run src/test/omniAllActions.test.ts` — 94 testes passaram.
- `npx vitest run src/test/omniCustosAtivos.test.tsx` — 38 testes passaram.
- `npx vitest run src/test/omniPrimitiveEndToEnd.test.ts` — 4 testes passaram, incluindo o consumo real do modificador no combate, o limite por rodada, ação completa e reinício ao iniciar combate.
- `git diff --check` — passou.

Estes testes verificam o caminho local do executor e das stores. Eles não substituem um teste de sincronização entre duas contas conectadas ao backend. A etapa fecha a lacuna identificada para custos de ação; não certifica que toda combinação possível de frases naturais do OMNI esteja implementada.

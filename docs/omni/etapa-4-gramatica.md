# Etapa 4 — gramática e AST natural

Estado: analisador puro de frase natural entregue. Ainda não compila para ações executáveis nem está ligado ao terminal ou combate.

## Estrutura reconhecida

Uma linha é `[se] condição/evento então ação [e ação ...]`. Exigimos exatamente um `então` no nível externo, condição não vazia e pelo menos uma ação. A sintaxe `se` pode envolver condições combinadas; eventos também podem aparecer em combinações.

Predicados são armazenados como átomos ou operadores `e`/`ou`, preservando o texto-fonte de cada átomo e seu intervalo. `e` tem precedência sobre `ou`; parênteses podem modificar a associação. Prefixos `ao`, `quando`, `no` e `na` classificam o átomo como evento, sem ainda resolver o ID do gatilho.

Após `então`, comandos encadeados só se separam no `e` de nível superior quando o próximo termo inicia um verbo conhecido. A fórmula e os qualificadores continuam no texto da mesma ação: `causar 2d8 de dano Corte mais 1d8 adicional ...` não vira duas ações. Os grupos preservam fonte e intervalos para erros e UI.

## Escopo deliberado

- Parser aceita verbo conhecido como estrutura; não valida destinatário, recurso, tipo de dano, contador, custo ou existência da key.
- Átomos de predicado ainda são trechos opacos; parser não interpreta relação aliado/inimigo nem evento específico.
- Uma frase por chamada; blocos de múltiplas linhas e persistência de AST ficam para integração.
- Comandos antigos continuam no parser legado. Não há tradução automática nem execução desta AST.

## Testes

`npx vitest run src/test/omniGramaticaNatural.test.ts src/test/omniLexerNatural.test.ts src/test/omniParser.test.ts src/test/omniScriptCompatibility.test.ts` — 4 arquivos e 61 testes aprovados. Cobre regras de Rancor, ações compostas, precedência, parênteses, texto citado, erros e compatibilidade do parser existente.

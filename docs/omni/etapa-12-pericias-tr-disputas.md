# Etapa 12 — Perícias, TRs e disputas

## Resultado

As disputas de ações ativas agora usam somente as 22 perícias canônicas da ficha. O editor oferece seletores alimentados por `SISTEMA_PERICIAS` e `ROTULOS_PERICIAS`; a seleção do alvo permite uma ou várias perícias defensivas, das quais o executor escolhe a de maior bônus. Empates continuam favorecendo o alvo.

O pacote OMNI valida IDs canônicos e rótulos oficiais para preservar compatibilidade com configurações existentes e converte IDs em rótulos durante o parse — por exemplo, `oficio1` vira `Ofício 1`. Valores arbitrários, atributos e nomes de TR não são aceitos como perícias. O editor grava os rótulos oficiais da ficha, compatíveis com o executor de disputas existente.

O seletor de TR também deriva da lista oficial de cinco testes (`astucia`, `fortitude`, `integridade`, `reflexos`, `vontade`). A validação e os caminhos de disputa mantêm TR e perícia como modalidades distintas.

## Arquivos e evidências

- `src/components/omni/EditorAcoesAtivas.tsx`: seletores de perícias e TRs gerados pelo catálogo canônico.
- `src/lib/omni/validacao.ts`: validação dos nomes de perícia em ações importadas e normalização de IDs para o rótulo canônico.
- Testes em `omniPacoteRoundTrip.test.ts` e `omniAlvosUI.test.tsx`: IDs/rótulos aceitos, atributo/TR/chave inventada recusados e seleção do editor. Os testes existentes de `omniDisputaAtiva.test.ts` continuam cobrindo o cálculo e o desempate.

Verificação focada: quatro arquivos de teste passaram (53 testes). O TypeScript continua apontando apenas quatro erros já existentes fora desta etapa: três propriedades `conditionId` duplicadas em `SpellApplyDialog.tsx` e o tipo `T` ausente em `useReactionStore.ts`.

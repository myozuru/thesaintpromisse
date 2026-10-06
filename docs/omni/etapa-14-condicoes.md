# Etapa 14 — Condições

## Resultado

As condições ativas agora preservam a identidade das fontes conhecidas: personagem, entidade de origem e, quando existe, a cópia específica no inventário. A ficha continua expondo os campos antigos `sourceCharId` e `sourceCharName` para compatibilidade. Aplicações novas também guardam seus próprios prazos em `sourceApplications`.

Condições repetidas continuam ocupando uma única instância. A regra de renovação especial vale somente para **Condenado**: cada fonte conserva seu prazo; reaplicar pela mesma fonte amplia esse prazo pelo maior valor, e uma fonte diferente passa a contribuir sem criar outra condição. O prazo visível é o maior entre as fontes ativas. `-1` significa duração indefinida e prevalece sobre qualquer prazo finito.

Remover uma aplicação por `sourceEntityId` e, opcionalmente, `sourceInstanceId` preserva a condição enquanto outra fonte registrada continuar ativa. Se não restar fonte, a instância termina. A remoção por ID da instância da condição também continua disponível e remove a condição inteira.

Condições ligadas a ações sustentadas guardam a entidade e a cópia que as sustentam. Ao encerrar a sustentação, o motor remove somente essa aplicação; outra fonte pode manter a condição ativa.

## Idade e término

- Uma condição recém-aplicada começa com `elapsedRounds: 0`.
- Reaplicar Condenado mantém o ID da condição e sua idade; renovar o prazo não reinicia o histórico contínuo.
- A idade só aceita inteiros não negativos. Fichas antigas sem idade — ou com valor inválido — continuam com idade desconhecida; o motor não presume zero.
- Fim de turno reduz prazos em turnos; fim de rodada reduz prazos em rodadas. Cada aplicação de Condenado termina quando seu próprio prazo aplicável acaba. A condição é removida quando nenhuma aplicação restante a sustenta.
- A duração de Caído continua sem teste de TR para terminar, por `normalizeConditionExpiry`.
- A normalização de fichas antigas consolida duplicatas de Condenado numa instância e mantém as fontes e prazos recuperáveis.

## Origem registrada

Os caminhos OMNI de gatilho, watcher e efeito visual registram a entidade e a instância que aplicaram a condição quando esses IDs estão disponíveis. Ações ativas associam a condição à entidade e à cópia usada; feitiços registram o ID do feitiço. Aplicações sem origem persistente continuam válidas e não recebem IDs inventados.

`removeConditionsFromSource` remove as aplicações correspondentes sem apagar fontes diferentes. Remoção individual segue `removeCondition`, que recebe a ID canônica da instância; remoções do construtor que selecionam uma condição continuam removendo todas as instâncias daquela condição no alvo.

## Arquivos e evidências

- `src/types/conditions.ts`: proveniência por aplicação e IDs da fonte.
- `src/stores/useCharacterStore.ts`: renovação, consolidação de legado, idade, contagem de prazos e remoção por fonte.
- `src/lib/omni/executor.ts`, `eventBus.ts`, `executarSubEfeito.ts`, `acaoAtiva.ts`, `custosAtivos.ts`, `triggerEfeitos.ts`, `watcherEngine.ts` e `src/components/fichas/SpellApplyDialog.tsx`: propagação dos IDs conhecidos até a ficha e remoção exata no fim de sustentação.
- `src/test/conditionStacking.test.ts` e `src/test/omniAtivasAuditoria.test.tsx`: renovação sem reiniciar idade, prazo indefinido, remoção por fonte, consolidação de duplicatas antigas, proveniência em ação ativa/gatilho visual e encerramento seletivo de sustentação.

Verificação focada: 200 testes passaram em 8 arquivos, incluindo orçamento de reações. `npx tsc --noEmit` passou após corrigir três spreads duplicados de `conditionId` no processamento de feitiços e restaurar a declaração genérica de `runReaction`. A linguagem natural ainda não é executada por essa implementação; esta etapa corrige o ciclo de vida das condições usadas pelas APIs atuais.

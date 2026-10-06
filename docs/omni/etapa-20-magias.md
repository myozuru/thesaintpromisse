# Etapa 20 — magia, concentração e sustentação

## Corrigido

- Magias `Duradouras` não cobram PE por rodada. Apenas `Sustentadas` (`durationRounds === -1`) recebem o custo de manutenção definido pela tabela de nível.
- O custo é cobrado uma vez por conjuração no turno do conjurador, independente do número de buffs ou alvos. O PE nunca é debitado da ficha que recebeu o efeito.
- Cada conjuração sustentada recebe `sustainInstanceId`, usado para cobrar e encerrar o grupo correto de efeitos.
- Se o conjurador não tiver PE para manter uma conjuração, os buffs e condições vinculados a ela terminam. A cobrança é atômica por conjuração; outras conjurações podem continuar se ainda houver PE.
- Substituir a sustentação de um jogador também remove condições aplicadas pela conjuração anterior, preservando aplicações de outras fontes.
- `qtd_sustentados` conta conjurações, não cada buff individual. Buffs legados sem ID são agrupados por conjurador e nome do feitiço.
- `qtd_concentrando` não usa mais `lastSpellUsedId`: esse campo registra histórico, não concentração ativa.

## Limite encontrado

O modelo atual de magia não possui um estado persistido para concentração ativa nem uma propriedade que declare que um feitiço exige concentração. Por isso, o OMNI retorna zero para `qtd_concentrando` até existir uma fonte de estado real. Os slots de concentração continuam calculados a partir do limite configurado, mas o projeto ainda precisa definir e persistir os efeitos que os ocupam.

## Arquivos e validação

- `src/components/fichas/SpellApplyDialog.tsx`
- `src/stores/useCharacterStore.ts`
- `src/types/index.ts`
- `src/lib/omni/resolvedor.ts`
- `src/lib/omni/constantesDoSistema.ts`
- `src/test/spellSustainAccounting.test.ts`
- `src/test/omniBlocks/01-visao-ado-identidade-concentracao.test.ts`

Testes focados e `tsc --noEmit` passaram. Dois testes já existentes de `omniSpellDamageContext.test.tsx` continuam falhando porque procuram o botão `/^Rolar$/`, mas a tela exibe `Lançar Dano`; esse problema é anterior e não faz parte da sustentação de magia.

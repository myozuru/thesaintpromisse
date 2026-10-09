# Etapa 20 — magia, concentração e sustentação

## Corrigido

- Magias `Duradouras` não cobram PE por rodada. Apenas `Sustentadas` (`durationRounds === -1`) recebem o custo de manutenção definido pela tabela de nível.
- O custo é cobrado uma vez por conjuração no turno do conjurador, independente do número de buffs ou alvos. O PE nunca é debitado da ficha que recebeu o efeito.
- Cada conjuração sustentada recebe `sustainInstanceId`, usado para cobrar e encerrar o grupo correto de efeitos.
- Se o conjurador não tiver PE para manter uma conjuração, os buffs e condições vinculados a ela terminam. A cobrança é atômica por conjuração; outras conjurações podem continuar se ainda houver PE.
- Substituir a sustentação de um jogador também remove condições aplicadas pela conjuração anterior, preservando aplicações de outras fontes.
- `qtd_sustentados` conta conjurações, não cada buff individual. Buffs legados sem ID são agrupados por conjurador e nome do feitiço.
- `qtd_concentrando` não usa mais `lastSpellUsedId`: esse campo registra histórico, não concentração ativa.
- Feitiços podem declarar `requiresConcentration`; o lançamento verifica slots antes de cobrar PE/ação e grava uma instância ativa na ficha.
- Buffs e condições de uma concentração ficam ativos até a instância ser encerrada. `endConcentration` remove somente os efeitos vinculados àquela instância e preserva aplicações de outras fontes.
- O painel da ficha mostra as concentrações e permite encerrá-las. Encerrar uma sustentação remove a concentração quando ambas compartilham a mesma instância.
- `concentrando` indica pelo menos uma concentração ativa; `qtd_concentrando` conta IDs únicos. Ambos ignoram `lastSpellUsedId` e feitiços sustentados que não exigem concentração.

## Limite restante

O repositório não define a CD/fórmula canônica para o teste de quebra de concentração após dano. Por isso, esta etapa não inventa uma CD nem quebra a concentração automaticamente com base em dano; a ficha permite encerrar manualmente e expõe o estado persistido às regras OMNI. A integração desse teste depende da fórmula oficial do livro.

## Arquivos e validação

- `src/components/fichas/SpellApplyDialog.tsx`
- `src/components/fichas/SpellCreationAssistant.tsx`
- `src/components/fichas/ActiveConcentrationPanel.tsx`
- `src/stores/useCharacterStore.ts`
- `src/types/index.ts`
- `src/lib/concentration.ts`
- `src/lib/omni/resolvedor.ts`
- `src/lib/omni/constantesDoSistema.ts`
- `src/test/concentrationLifecycle.test.ts`
- `src/test/spellSustainAccounting.test.ts`
- `src/test/omniBlocks/01-visao-ado-identidade-concentracao.test.ts`

Testes focados, regressões de sustentação, `tsc --noEmit` e `git diff --check` passaram.

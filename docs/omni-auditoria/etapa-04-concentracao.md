# Etapa 4 — concentração ativa no OMNI

## Lacuna fechada

`qtd_concentrando` devolvia zero fixo e `concentrando` consultava `lastSpellUsedId`, que é apenas histórico de conjuração. Não existia campo no feitiço dizendo que ele exigia concentração, estado ativo na ficha, bloqueio por limite ou ação para encerrar a concentração.

## Contrato implementado

- `Spell.requiresConcentration` declara explicitamente a exigência no construtor.
- `Character.activeConcentrations` persiste cada instância com identificador, feitiço, alvos e horário de início.
- Antes de cobrar PE ou ação, o lançamento verifica a quantidade contra `maxConcentrationSlots` (padrão 1). Sem slot, a ação é bloqueada.
- Efeitos de buff e condições ligados à instância duram enquanto ela permanecer ativa. O encerramento remove apenas os efeitos daquela instância, inclusive aplicações concorrentes de condições, e preserva efeitos de outras fontes.
- A ficha mostra o total, as concentrações e os alvos; o conjurador ou Mestre pode encerrar uma instância para liberar o slot.
- Sustentação continua sendo um sistema separado, com custo de PE por rodada e limite próprio. As keys não contam uma como outra.
- `concentrando` retorna 1 se houver ao menos uma instância ativa. `qtd_concentrando` conta IDs únicos. `slots_concentracao_livres` usa o total persistido e o limite configurado.

## Validação

- Teste de leitura das três keys com 0, 1 e 2 instâncias ativas.
- Testes de limite padrão, limite ampliado, ID duplicado e configuração inválida.
- Testes de encerramento removendo buffs e condições em vários alvos, preservando efeitos de outras fontes e sincronizando o encerramento de uma sustentação que compartilha a instância.
- TypeScript e regressões direcionadas de magia/sustentação executados antes da publicação.

## Limite que ainda precisa da regra oficial

As regras no repositório não especificam a CD/fórmula do teste de quebra da concentração após dano. A engine não deve inventar esse valor. O estado está implementado e pode ser consultado pelo OMNI, mas o disparo e a resolução automática do teste precisam da fórmula oficial do livro.

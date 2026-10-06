# Etapa 13 — Armas e custos

## Resultado

As cópias de armas agora são identificadas individualmente em ambos os espaços da ficha. `mainHandWeaponInstanceId` e `offHandWeaponInstanceId` identificam a arma Omni pelo `InventoryItem.instanceId`; armas que ainda vêm do inventário antigo usam `legacy:<Item.id>`. Os nomes continuam salvos e são usados na apresentação e como fallback para fichas anteriores.

O painel deixou de agrupar cópias pelo nome. Cada cópia tem uma opção própria; uma mão só bloqueia a mesma instância na outra mão. Armas de duas mãos gravam o mesmo ID nos dois espaços. Duas cópias diferentes com o mesmo nome permanecem distintas, podem ser empunhadas separadamente e contam como duas armas. O descarte limpa apenas os espaços que apontam para aquela cópia.

## Munição e compatibilidade

- Armas Omni guardam munição em `InventoryItem.municaoRestante`.
- Armas do inventário legado usam a chave `weaponAmmo["legacy:<Item.id>"]`.
- `weaponAmmo[<nome>]` permanece como compatibilidade para fichas antigas. Na primeira leitura de uma arma com IDs, o saldo antigo é movido a uma única cópia: prioriza a cópia atualmente empunhada; sem ela, escolhe a primeira ID em ordem estável. As outras cópias recebem zero. Isso preserva o saldo total antigo sem multiplicá-lo por cada cópia.
- Ataques comuns, recarga rápida e custos de munição de ações ativas consultam e debitam a instância exata. Os custos continuam sendo validados antes do pagamento.

Fichas antigas sem os campos de ID continuam resolvendo a arma pelo nome até serem alteradas pelo seletor novo. O método antigo `equipWeapons({ mainHandName, offHandName })` continua aceito. Ao usar esse método em uma mão que já mantém o mesmo nome, a cópia atual é preservada; novas seleções enviam IDs.

## Regras preservadas

- Uma arma de duas mãos ocupa os dois espaços com a mesma instância.
- A mesma instância de uma arma de uma mão não pode ocupar os dois espaços.
- Empunhar duas cópias do mesmo nome exige as mesmas regras de empunhadura dupla aplicadas a duas armas distintas.
- O orçamento de trocas continua valendo ao trocar entre cópias do mesmo nome.
- Ações ativas de arma exigem que a instância da ação esteja empunhada. Munição e demais custos não são debitados se a validação falhar.

## Arquivos envolvidos

- `src/types/index.ts`: IDs dos dois espaços; `weaponAmmo` passa a estar marcado como campo legado.
- `src/stores/useCharacterStore.ts`: resolução e gravação dos IDs, validação de duas mãos e custo de troca.
- `src/stores/useInventoryStore.ts`: munição persistida por instância Omni.
- `src/components/fichas/AttackPanel.tsx` e `EspecialistaNv4CSections.tsx`: seleção sem deduplicação por nome, ataque e recarga por cópia.
- `src/lib/recargaRapida.ts` e `src/lib/omni/custosAtivos.ts`: migração, consulta e consumo de munição.
- `src/lib/omni/acaoAtiva.ts`, `reacoesAtivas.ts`, `resolvedor.ts` e `componentes/equipamento.ts`: contexto exato da arma empunhada.
- `src/lib/omni/itensNoChao.ts` e `replicas.ts`: descarte e réplicas ligados ao ID correto.

## Verificação

Foram aprovados 172 testes direcionados em 13 arquivos sobre instâncias Omni e legadas, seleção no painel, munição e recarga, custos ativos, combate duplo, estilo do arremessador, descarte, armas de duas mãos, réplicas, composição de equipamento e Zona de Risco.

Na primeira validação desta etapa, `npx tsc --noEmit` ainda apontava três spreads duplicados de `conditionId` em `SpellApplyDialog.tsx` e o tipo `T` não declarado em `useReactionStore.ts`. Os quatro erros foram corrigidos durante a Etapa 14; a validação atual de TypeScript passa.

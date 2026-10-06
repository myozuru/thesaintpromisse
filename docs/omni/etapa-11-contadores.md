# Etapa 11 — Contadores e quotas por fonte

## Resultado

O saldo de um contador agora tem um teto global independente da divisão por fonte. `por_fonte` registra quem contribuiu; não multiplica o limite total. Assim, `ate treino por_fonte` limita o saldo combinado ao valor de Treinamento e mantém cada parcela auditável.

A sintaxe opcional `teto_aliado N por rodada` ou `teto_aliado N por descanso` limita quantas cargas uma mesma fonte concede dentro do ciclo. A validação do pacote rejeita quotas sem ciclo explícito. A quota fica separada do saldo: consumir todas as cargas não devolve a contribuição já usada. Fontes diferentes têm cotas diferentes, e o teto global continua valendo sobre a soma.

O ciclo de rodada inclui o identificador do combate e o número da rodada; um combate novo não herda a cota da rodada 1 de um combate anterior. O ciclo de descanso avança quando `aoDescansar` é emitido depois da atualização da ficha, tanto para descanso curto quanto longo. O tipo de cota e o registro por fonte persistem na ficha.

## Compatibilidade e escopo

- Scripts antigos continuam sendo lidos e reemitidos; o significado do teto usado pelo executor passa a ser global para atender à especificação aprovada.
- A divisão por fonte mantém o histórico do saldo e o cálculo de consumo parcial/total.
- O construtor visual mantém o campo de teto global legado; configuração de `teto_aliado` está disponível no script OMNI. A interface visual para editar esse novo campo fica para a etapa do editor.
- A implementação não inventa ciclos quando o efeito não declara período. Sem `teto_aliado`, `por_fonte` só separa as contribuições.

## Arquivos e evidências

- `src/lib/omni/contadores.ts`: teto global, cotas por fonte/ciclo e consumo que preserva a quota.
- `src/lib/omni/omniScript.ts`: parse/serialização de `teto_aliado`.
- `src/lib/omni/aplicarEfeito.ts`, `src/lib/omni/executor.ts`, `src/lib/omni/triggerEfeitos.ts`, `src/lib/omni/executarSubEfeito.ts` e `src/lib/omni/watcherEngine.ts`: propagação do teto, da fonte e do ciclo.
- `src/types/index.ts` e `src/lib/omni/eventBus.ts`: persistência e avanço do ciclo de descanso pelo evento já emitido após a conclusão.
- `src/test/omniContadoresObservadores.test.ts`: teto global com fontes múltiplas, teto por aliado, gasto sem renovar cota, rodada nova, descansos e round-trip da sintaxe.

Verificação focada: nove arquivos de teste passaram (232 testes). ESLint nos arquivos tocados passou sem erros; há um aviso preexistente sobre uma diretiva `eslint-disable` não utilizada em `tipos.ts`. `npx tsc --noEmit` continua bloqueado por quatro erros fora do escopo: três propriedades `conditionId` duplicadas em `SpellApplyDialog.tsx` e o identificador `T` ausente em `useReactionStore.ts`.

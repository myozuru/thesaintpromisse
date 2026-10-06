# Etapa 18 — Históricos, economia e tempo

## Verificação

- `aoDescansar` é emitido somente nos fluxos de descanso curto/longo após a atualização da ficha; cada emissão avança `omniCounterRestCycle` uma vez. Quotas `por descanso` leem esse ciclo e não são reiniciadas por gastar o contador.
- Quotas `por rodada` usam a identidade de combate e a rodada global. A revisão dos contadores e seu teste de ciclo estão na Etapa 11.
- Durações de condições mantêm campos distintos `durationTurns` e `durationRounds`. Comandos que aceitam duração registram explicitamente `turnos N` ou `rodadas N`; não há conversão silenciosa entre as unidades.
- O OMNI já consulta saldos de carteiras/moedas para fórmulas, mas antes desta etapa o verbo `transferir` só movimentava recursos internos de uma ficha.

## Implementação

Foi acrescentada a forma monetária estrita:

```text
transferir 10 de wallet-a para wallet-b moeda yen
```

O valor, os dois IDs de carteira e o ID da moeda são obrigatórios. A execução usa `useMoneyStore.transfer`, que faz débito e crédito numa única transação, registra histórico e recusa saldo insuficiente, carteira/moeda inexistente ou origem igual ao destino. O Mestre pode executar transferências; um jogador só pode debitar uma carteira da qual seja membro. O comando antigo de transferência entre recursos da própria ficha permanece compatível.

## Evidências

- `src/test/omniCurrencyTransfer.test.ts`: gramática obrigatória, serialização, transferência bem-sucedida, autorização por membro, Mestre e saldo insuficiente.
- `src/test/omniContadoresObservadores.test.ts`: avanço de ciclo em descanso e renovação de cota por rodada.
- `src/test/omniCurrencyTransfer.test.ts` e `src/test/omniContadoresObservadores.test.ts` passaram (20 testes no total); `tsc --noEmit` e `git diff --check` passaram.

## Limite de autorização

O armazenamento atual de moedas é o Zustand persistido no cliente (`rpg-money`). A validação de role/membro é defesa no runtime OMNI, mas ainda não constitui autorização de servidor. A Etapa 22 precisa verificar ou migrar a persistência para uma operação autorizada no backend antes de afirmar segurança contra clientes adulterados.

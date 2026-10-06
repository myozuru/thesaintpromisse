# Etapa 10 — Estados contínuos e auras

## Resultado

As consultas de passivas contínuas agora recalculam suas condições a partir do estado atual da ficha, sem gravar bônus na ficha. Bônus positivos concorrentes da mesma perícia usam o maior valor; penalidades continuam cumulativas, conforme a política definida na etapa 9.

O rastreador de auras conserva a lista de criaturas dentro da área e compara o estado anterior com o atual. A entrada é emitida uma vez quando a criatura entra; a saída é emitida uma vez quando ela deixa de estar na área. O cache de membros é atualizado antes da execução dos efeitos para impedir que uma atualização aninhada repita a mesma transição.

As transições são recalculadas após movimento confirmado de tokens, remoção ou reposicionamento de token, troca de cena, remoção do vínculo de aura da ficha e avanço de turno. Efeitos de aura runtime também emitem saída quando são removidos. Recepção de estado remoto e clientes PLAYER não aplicam os efeitos localmente; o cálculo continua autoritativo no MASTER.

## Limites do que esta etapa entrega

- A reversão do efeito depende de uma regra `aoSairDaAura` configurada para desfazer o efeito de entrada. O motor não tenta inferir como desfazer qualquer comando arbitrário.
- A aura de suporte manual do catálogo continua sendo uma aplicação temporária; esta etapa não a converteu em bônus geométrico passivo contínuo.
- A derivação contínua atualmente cobre bônus passivos de perícia, redução de custo de magia e imunidades. Outros caminhos de recurso não são transformados em bônus passivos por inferência.
- A exclusão da própria entidade do catálogo OMNI enquanto ainda há vínculo/runtime não tem snapshot suficiente para executar todos os efeitos de saída; isso permanece para a etapa de integração/persistência.

## Arquivos e evidências

- `src/lib/omni/passivasDerivadas.ts`: recálculo de contribuições por perícia e resolução de acúmulo.
- `src/lib/omni/auras.ts`: entrada e saída idempotentes em auras runtime e vinculadas; ausência de posição e remoção do efeito produzem saída.
- `src/lib/mapa/engineZonasTerreno.ts`: atualiza auras automaticamente em alterações de cena/tokens e na mudança de vínculos da ficha.
- Testes: `src/test/omniBridgeE2E.test.ts`, `src/test/omniSyncAuditoria.test.tsx` e `src/test/omniEspacialAuditoria.test.tsx`.

Verificação focada: 145 testes passaram nos três arquivos acima. `npx tsc --noEmit` ainda informa quatro erros fora do escopo desta etapa: três propriedades duplicadas em `SpellApplyDialog.tsx` e um identificador `T` ausente em `useReactionStore.ts`.

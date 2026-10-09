# OMNI — mesclagem concorrente de fichas

## Problema

A sincronização anterior escolhia uma ficha inteira pelo `_syncAt`. Duas telas podiam editar campos diferentes da mesma ficha; ao salvar a cópia mais recente, a mudança da outra tela era perdida.

## Correção

- A ficha mantém `_syncAt` para compatibilidade e agora carrega `_syncFields`, com a versão de cada caminho alterado.
- A mesclagem de eventos recebidos e a composição antes de gravar no Cloud usam a mesma regra: mesclar cada campo/caminho individualmente; arrays continuam sendo valores atômicos.
- Mapas como `omniCounters` são mesclados por chave, então alterações concorrentes em contadores com nomes diferentes sobrevivem juntas.
- Exclusões explícitas recebem tombstones de versão, evitando que uma cópia antiga ressuscite um campo removido.
- O carimbo de caminhos também é salvo no navegador e acompanha a ficha serializada. Fichas antigas sem `_syncFields` inicializam cada campo com o `_syncAt` legado.
- Conflitos simultâneos no mesmo caminho usam maior versão; empate escolhe o mesmo valor em qualquer ordem de chegada.

## Validação

- `npx vitest run src/test/charSyncStamps.test.ts src/test/omniSuporteAtivo.test.tsx src/test/omniInventorySync.test.ts src/test/omniSyncAuditoria.test.tsx` — 4 arquivos e 81 testes aprovados.
- `npx tsc --noEmit` — aprovado.
- `git diff --check` nos arquivos da etapa — aprovado.

## Limite remanescente

Se duas telas incrementarem simultaneamente o mesmo contador numérico partindo do mesmo valor, o registro do campo continua sendo um conflito de mesmo caminho e vence uma versão determinística; o sistema ainda não soma as duas operações. Resolver isso corretamente exige persistir operações idempotentes (incremento, gasto e redefinição) com identidade própria, em vez de inferir uma operação apenas pela diferença entre snapshots. Arrays também continuam atômicos.

## Supabase

A migração RLS foi publicada na etapa anterior, mas ainda não foi aplicada ao banco. O ambiente atual só tem a chave pública do cliente e não possui Supabase CLI, token de gerenciamento ou conexão administrativa; por isso não foi possível testar o fluxo real com duas contas. A URL e as chaves não foram exibidas nem copiadas para o relatório.

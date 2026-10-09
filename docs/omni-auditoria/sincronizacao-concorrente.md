# OMNI — mesclagem concorrente de fichas

## Problema

A sincronização anterior escolhia uma ficha inteira pelo `_syncAt`. Duas telas podiam editar campos diferentes da mesma ficha; ao salvar a cópia mais recente, a mudança da outra tela era perdida.

## Correção

- A ficha mantém `_syncAt` para compatibilidade e agora carrega `_syncFields`, com a versão de cada caminho alterado.
- A mesclagem de eventos recebidos e a composição antes de gravar no Cloud usam a mesma regra: mesclar cada campo/caminho individualmente; arrays continuam sendo valores atômicos.
- Mapas como `omniCounters` são mesclados por chave, então alterações concorrentes em contadores com nomes diferentes sobrevivem juntas.
- Em contadores que registram contribuições por fonte (`<contador>__fonte__<id>`), as parcelas de fontes diferentes são preservadas e o total é recalculado após a mesclagem.
- Quando existe teto global, `calcularContador` sincroniza esse teto junto da contabilidade por fonte. Se contribuições simultâneas ultrapassarem o teto combinado, o reconciliador mantém as parcelas mais antigas; em empate, usa o identificador da fonte para decidir de forma determinística.
- Exclusões explícitas recebem tombstones de versão, evitando que uma cópia antiga ressuscite um campo removido.
- O carimbo de caminhos também é salvo no navegador e acompanha a ficha serializada. Fichas antigas sem `_syncFields` inicializam cada campo com o `_syncAt` legado.
- Conflitos simultâneos no mesmo caminho usam maior versão; empate escolhe o mesmo valor em qualquer ordem de chegada.

## Validação

- `npx vitest run src/test/charSyncStamps.test.ts src/test/omniSuporteAtivo.test.tsx src/test/omniInventorySync.test.ts src/test/omniSyncAuditoria.test.tsx` — 4 arquivos e 84 testes aprovados.
- `npx tsc --noEmit` — aprovado.
- `git diff --check` nos arquivos da etapa — aprovado.

## Operações atômicas dos contadores

O estado autoritativo agora fica em `omni_counter_states`, separado do snapshot completo de `realtime_world.characters`. Cada incremento, consumo ou redefinição usa `apply_omni_counter_operation`: o banco trava a linha da ficha, aplica a operação e grava o ID idempotente e o resultado na mesma transação. Histórico de dano e cura também usa a mesma sequência transacional.

A operação informa a ficha de origem. O banco só aceita a gravação quando a conta controla essa ficha ou é Mestre. A leitura do saldo continua restrita ao Mestre e ao dono da ficha afetada; outros clientes recebem somente uma confirmação sem saldo. A revisão autoritativa impede que snapshots antigos sobrescrevam o estado transacional.

A migração ainda precisa ser aplicada ao Supabase. Até isso acontecer, o cliente mantém a atualização otimista local e registra falhas da RPC. O teste local não comprova concorrência real entre duas sessões. Custos de PE, PV, ação e munição continuam armazenados no fluxo de ficha; esta transação garante atomicidade entre operações de contador, mas ainda não combina esses custos em uma única transação.

## Supabase

A migração RLS foi publicada na etapa anterior, mas ainda não foi aplicada ao banco. O ambiente atual só tem a chave pública do cliente e não possui Supabase CLI, token de gerenciamento ou conexão administrativa; por isso não foi possível testar o fluxo real com duas contas. A URL e as chaves não foram exibidas nem copiadas para o relatório.

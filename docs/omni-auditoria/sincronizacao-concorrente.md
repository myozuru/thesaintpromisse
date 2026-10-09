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

## Limite remanescente

Contadores com fontes diferentes preservam contribuições distintas e respeitam o teto global sincronizado. Ainda não existe soma segura para operações concorrentes no mesmo caminho de fonte nem para contadores sem rastreamento por fonte: nesses casos prevalece a versão determinística do caminho. Gastos e redefinições concorrentes também não preservam a intenção de cada operação. Resolver todos esses casos exige persistir operações idempotentes (incremento, gasto e redefinição) com identidade própria e aplicação atômica; inferir a intenção apenas pela diferença entre snapshots não é seguro. Arrays continuam sendo valores atômicos.

## Supabase

A migração RLS foi publicada na etapa anterior, mas ainda não foi aplicada ao banco. O ambiente atual só tem a chave pública do cliente e não possui Supabase CLI, token de gerenciamento ou conexão administrativa; por isso não foi possível testar o fluxo real com duas contas. A URL e as chaves não foram exibidas nem copiadas para o relatório.

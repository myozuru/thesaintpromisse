# OMNI — persistência e autorização

## Escopo

Revisão da persistência compartilhada do catálogo OMNI e das fatias de estado controladas pelo Mestre. A verificação foi feita na branch `main`, a partir do commit `079df981e6f8285d039402fd54dbb365d81d2edb`, com alterações locais ainda pendentes.

## Correção aplicada

- As fatias `chronos`, `worldMap`, `worldBosses`, `worldBossesMaster` e `omniEntidades` agora exigem a role `MASTER` para inserção e atualização no Supabase.
- O cliente descarta tentativas de publicação dessas fatias por outras roles e ignora mensagens de broadcast/Socket.IO para elas quando a sincronização Cloud está ativa. Esses canais não autenticam o emissor; a origem confiável passa a ser a linha protegida no Postgres.
- Atualizações dessas fatias chegam aos clientes por Postgres Changes. A leitura segue as políticas existentes: o catálogo OMNI e os dados públicos continuam visíveis; `worldBossesMaster` permanece restrito ao Mestre.
- `characters`, `omniInventory`, `omniRuntime` e `omniSpatial` continuam sincronizáveis conforme as permissões atuais de cada mecânica.

## Validação local

- `npx vitest run src/test/worldSliceAuthorization.test.ts src/test/omniInventorySync.test.ts src/test/omniSyncAuditoria.test.tsx src/test/omniContadoresObservadores.test.ts src/test/combatActionProtocol.test.ts` — 5 arquivos e 91 testes aprovados.
- `npx tsc --noEmit` — aprovado.
- `git diff --check` nos arquivos desta etapa — aprovado.

## Aplicação no Supabase

A migração `supabase/migrations/20261009010000_restrict_master_world_slices.sql` foi criada, mas não foi aplicada a uma instância real: o ambiente não tem Supabase CLI nem conexão de banco configurada. A proteção contra gravação direta só fica completa depois que essa migração for aplicada no projeto Supabase.

## Limite de concorrência ainda aberto

A sincronização de fichas continua escolhendo a ficha inteira com o `_syncAt` mais recente. Se duas telas alterarem simultaneamente campos diferentes da mesma ficha, uma alteração pode substituir a outra. Não apliquei merge campo a campo: contadores e recursos precisam preservar operações de soma, gasto, cura e redefinição, e uma política genérica de “maior valor” ou soma criaria duplicações e valores incorretos. É necessário definir um modelo de concorrência por ficha/campo antes de declarar esse caso resolvido.

## Limites da evidência

Os testes são locais e cobrem as decisões de role, sincronização e regressões relacionadas. Não houve teste real com duas contas simultâneas no Supabase; também não foi possível confirmar a migração executada no backend. Portanto, o fluxo está validado no código e na suíte local, mas a autorização efetiva no banco depende da aplicação da migração.

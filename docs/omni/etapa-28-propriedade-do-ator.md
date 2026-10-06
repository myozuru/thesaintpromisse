# Etapa 28 — propriedade do ator na fila de combate

## Alterações

`combat_character_owners` registra uma ficha por conta Supabase. O vínculo só
pode ser gravado por uma Server Function autenticada como Mestre; `profileId`,
`createdBy` e qualquer valor do snapshot compartilhado não autorizam o jogador.
O Mestre pode substituir o dono ou remover o vínculo. A tabela não concede
leitura ou escrita a `anon` nem a `authenticated`; apenas o service role das
Server Functions a consulta e altera.

Ao enviar uma intenção, o servidor consulta esse vínculo. O dono persistido pode
solicitar ações apenas para sua ficha. O Mestre continua autorizado a operar
qualquer ator. Fichas sem dono atribuído e contas que tentem usar a ficha de
outra pessoa são recusadas antes de criar uma linha na fila. Falha ao consultar
a tabela também bloqueia a solicitação.

## Arquivos

- `supabase/migrations/20261006050000_combat_character_owners.sql`
- `src/lib/combat/actionRequests.functions.ts`
- `src/lib/combat/actionProtocol.ts`
- `src/integrations/supabase/types.ts`
- `src/test/combatActionProtocol.test.ts`

## Limites ainda abertos

- A migration precisa ser aplicada ao Supabase e validada com duas contas reais.
- O Mestre ainda não tem uma interface para atribuir/remover os vínculos.
- A fila ainda não está conectada às ações de arma, feitiço, OMNI ou reação, e
  não executa uma ação nem aplica seu resultado à ficha.
- A fatia compartilhada `characters` ainda contém dados mecânicos completos. A
  tabela de propriedade impede falsificar o solicitante da fila, mas não corrige
  por si só o vazamento de dados apontado nas etapas 25 e 26.

## Validação desta etapa

O teste unitário cobre dono correspondente, tentativa por outra conta, ficha
sem vínculo e Mestre. A integração contra Supabase real permanece pendente; não
se deve tratar a fila como autoridade de combate até aplicar as migrations e
conectar o resolvedor confiável.

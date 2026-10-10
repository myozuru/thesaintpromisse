# Etapa 19 — auditoria inicial de multiplayer e segurança

**Data:** 10/10/2026  
**Branch revisada:** `main`  
**Commit revisado:** `7d694b02727fb71977e6e9adca7657a18696866d`  
**Status:** em andamento; esta auditoria não conclui a etapa.

## Escopo executado

- Revisadas as políticas de acesso de `realtime_world` e as proteções das
  fatias compartilhadas.
- Verificados os caminhos autenticados de aprovação de invocações e de
  intenções de combate.
- Rodados testes unitários de permissão e protocolo sem sessão, credenciais ou
  conexão com Supabase.

## Evidências

- `supabase/migrations/20261006010000_harden_shared_world_access.sql` permite
  leitura, inserção e atualização de `realtime_world` para qualquer conta
  autenticada.
- `supabase/migrations/20261009010000_restrict_master_world_slices.sql`
  restringe no banco as fatias `worldBosses`, `worldBossesMaster`, `worldMap`,
  `chronos` e `omniEntidades`. As fatias `characters` e `map` permanecem fora
  dessa lista e, portanto, aceitam gravações de qualquer conta autenticada.
- `src/hooks/useMultiplayerSync.ts` consulta
  `podePublicarWorldSlice(useRoleStore.getState().role, slice)` antes de
  publicar certas fatias. Essa checagem ocorre no cliente e não substitui a
  política do banco.
- `src/lib/controlador/aprovacao.functions.ts` valida identidade, papel,
  propriedade e revisão por Server Functions autenticadas.
- `src/lib/combat/actionRequests.functions.ts` valida o vínculo persistido em
  `combat_character_owners` ao receber uma intenção. Esse caminho não governa
  as gravações diretas das fatias de personagens e mapa.
- `src/test/worldSliceAuthorization.test.ts` e
  `src/test/combatActionProtocol.test.ts` cobrem regras puras; não exercitam
  políticas RLS nem a sincronização real.

## Achado S19-01 — gravação de personagens e mapa sem autorização por dono

**Severidade:** alta. Uma conta autenticada pode enviar uma gravação direta
para as fatias compartilhadas `characters` e `map`, inclusive alterando dados
de personagens e tokens que não lhe pertencem. A tabela de proprietários e a
fila segura de intenções protegem alguns caminhos específicos, mas a política
genérica de sincronização ainda não verifica a identidade do dono nem a
transição dos valores.

Não é seguro resolver isso apenas bloqueando essas fatias para jogadores: eles
precisam sincronizar alterações próprias e controlar suas invocações. A correção
precisa introduzir um caminho de escrita confiável que valide dono, entidade,
operação, versão e idempotência, depois restringir as gravações diretas sem
interromper os fluxos legítimos.

## Mitigação S19-02 — mesclagem concorrente de instâncias

`src/lib/charSyncStamps.ts` agora mescla `instanciasInvocacao` por ID próprio:
preserva instâncias novas criadas por clientes diferentes e, para a mesma
instância, prefere a revisão maior. Empates de revisão convergem pelo conteúdo
serializado para que os clientes terminem com o mesmo estado. `createdAt` é
registrado ao criar uma instância para manter a ordem do histórico.

Isso reduz a perda de instâncias distintas por sobrescrita de uma lista inteira.
Empates de revisão ainda podem descartar uma das duas edições concorrentes da
mesma instância; a escolha determinística garante convergência, não preservação
semântica. A mesclagem também roda no cliente e não prova propriedade, não impede
escritas diretas de terceiros e não substitui a validação autoritativa com
compare-and-swap no servidor. O achado S19-01 permanece aberto.

## Verificação local sem Supabase

Comando executado:

```text
npx vitest run src/test/worldSliceAuthorization.test.ts src/test/combatActionProtocol.test.ts src/test/controladorResolucaoDerrota.test.ts src/test/controladorFundacao.test.ts
```

Resultado: **4 arquivos e 52 testes passaram**. Nenhuma conexão ou sessão
Supabase foi iniciada. Esses testes validam regras puras e não comprovam as
políticas de banco nem a autorização no transporte multiplayer.

Verificação incremental da S19-02:

- `npx vitest run src/test/charSyncStamps.test.ts src/test/controladorResolucaoDerrota.test.ts`: **2 arquivos e 24 testes passaram**.
- `npx tsc --noEmit --pretty false`: passou.
- `npm run build`: passou.

Essas verificações foram executadas localmente, offline e sem Supabase.

## Próximo incremento

Desenhar e implementar um fluxo de escrita autenticado para estado de
invocações, incluindo autorização por identidade autenticada e vínculo de
propriedade, revisão concorrente e `requestId` idempotente. Adicionar testes
unitários offline para as decisões de autorização e integração isolada para o
persistidor. Só então estreitar as políticas RLS das fatias compartilhadas.

## Estado das etapas

- Etapa 18: parcialmente concluída; recuperação manual foi publicada, mas
  reinvocação e Hordas ainda aguardam regras pendentes.
- Etapa 19: iniciada; achado S19-01 registrado e ainda sem correção de código.
- Etapa 20: pendente.

Assim, há **3 etapas numéricas abertas** (18, 19 e 20); a etapa 18 permanece
aberta junto com o início da etapa 19.

# Revisão Final Independente READ-ONLY — `feature/dez-sombras-hud-mapa` (2026-11-15)

**Workspace:** `C:/Users/justs/Downloads/TSP-invocacoes-player`  
**Commit:** `bb6f36a` (HEAD) + uncommitted changes  
**Testes:** 217 passam (9 suítes)

---

## Defeitos Reproduzíveis

### P0 — Nenhum
Todos os bloqueadores anteriores resolvidos.

---

### P1 — 2 itens

| ID | Arquivo:Linha | Descrição | Reprodução |
|----|---------------|-----------|------------|
| **P1-1** | `src/components/mapa/ui/dezSombrasCombatHud.css:231` | `bottom: 58px` hardcoded no mobile (≤760px) assume altura fixa do `CombatBar`. Se `CombatBar` mudar altura, HUD sobrepõe ou deixa gap. | Resize viewport ≤760px, abrir HUD, verificar posição relativa ao CombatBar. |
| **P1-2** | `src/components/mapa/MapaModule.tsx:384` + `mapaMobile.css:1` | Breakpoint principal em 1100px. Layout "desktop completo" (≥1101px) não ativado em 1024×768 (usa layout intermediário 761-1100px). Funciona, mas não é layout desktop. | Abrir em 1024×768 — PartyPanel tem largura 48vw (máx 560px), não largura fixa desktop. |

---

### P2 — 3 itens

| ID | Arquivo:Linha | Descrição | Reprodução |
|----|---------------|-----------|------------|
| **P2-1** | `src/components/mapa/ui/dezSombrasCombatHud.tsx:136-148` | `stopMapEvent` bloqueia `onPointerMove`, `onWheel` (exceto Ctrl/Cmd), `onKeyDown` (exceto Escape) em TODO o HUD. Impede pan do mapa se cursor sobre HUD. | Abrir HUD, tentar arrastar mapa com mouse sobre HUD — não funciona. |
| **P2-2** | `src/lib/controlador/mapa.ts:1749-1755` | `jogadorBloqueadoPorControleMestre` não verifica `inCombat`. Se chamado fora de combate (ex.: futura feature), bloquearia Player indevidamente. Atualmente só usado em contexto de combate. | Chamar função com `masterControlled=true` fora de combate — retorna `true`. |
| **P2-3** | `src/components/mapa/ui/DezSombrasCombatHud.tsx:225-226` | Hint "Selecione este token no mapa" aparece para **Mestre** se `sourceTokenId !== activeToken.id` e token NÃO é `masterControlled`. Mestre deveria ver painel direto da lista. | Mestre abre HUD, clica token na lista lateral (não seleciona no mapa) — vê hint em vez de painel. |

---

## Falsos Positivos Relevantes (Revalidados)

| ID Anterior | Status | Justificativa |
|-------------|--------|---------------|
| **R02** | ✅ **Falso** | HUD: `role==='PLAYER' && masterControlled` → msg "sob controle do Mestre"; `sourceTokenId !== activeToken.id` → hint; else → painel. Ordem correta. |
| **R03** | ⚠️ **Parcial** | Layout 761-1100px implementado (`mapaMobile.css:19-27`, `dezSombrasCombatHud.css:246-248`). 1024×768 usa layout intermediário usável. |
| **R04** | ✅ **Falso** | HUD **dentro** de `[data-map-viewport]` (abaixo `MapTopBar`, à direita `ToolRail`). `top:12px; left:12px` é relativo ao viewport — **sem colisão**. |
| **R05** | ✅ **Corrigido** | `onWheel` permite zoom com `ctrlKey`/`metaKey` (`DezSombrasCombatHud.tsx:142-144`). |
| **N01** | ✅ **Falso** | `podeComandarInvocacao`: em combate usa `useCombatStore` initiative (setado sincronamente em `startCombat`); mapa só fallback fora de combate. Race window usa fonte correta. |
| **N02** | ✅ **Corrigido** | `removeCombatParticipant` verifica `clockOwnerWasRemoved` e reseta relógio (`useCombatStore.ts:812, 824-825`). |
| **N03** | ✅ **Corrigido** | `vincularInstanciasRituaisAoCombate` chamado em `startCombat` (linha 882) — vincula instâncias rituais ao `combatId` e normaliza Mahoraga/Tigre. |
| **P2 (jogadorBloqueadoPorControleMestre fora de combate)** | ✅ **Falso** | Função **não é chamada** fora de contexto de combate. Todas as 4 chamadas em `mapa.ts` estão em funções que verificam `inCombat` ou `modoExecucao === 'reacao'`. |

---

## Verificações Específicas Solicitadas

### HUD Real dentro de MapaModule ✅
- Renderizado em `MapaModule.tsx:3451` **dentro** de `<div data-map-viewport>` (linha 3405)
- Abaixo `MapTopBar` (linha 3392), à direita `ToolRail` (linha 3379)
- CSS posiciona relativo ao viewport container — **sem colisão**

### Permissões Mestre/Player ✅
- HUD: Player vê "sob controle do Mestre" para `masterControlled`; Mestre vê painel se `sourceTokenId` match
- `podeComandarInvocacao`: Player bloqueado para `masterControlled`; Mestre pode comandar se token é ator atual
- `ShikigamiOwnerPanel`: usa `canCommand = podeComandarInvocacao(owner.id, model.id)` — **todas** ações (incl. Tigre Reflexos, Predador Ápice) respeitam controle Mestre

### Início/Resolução de Rituais em Combate ✅
- Criação (`RituaisDezSombrasSection.tsx:146-218`): instancia com `combateId` se `inCombat`, entity com `masterControlled`, `ownerCharId`, `invocationId`, `invocationInstanceId`, `invocationState`, adiciona à iniciativa
- Limpeza (`limparAlvoDoMapa` linhas 61-86): remove initiative, combat participant, invocation instance, entity — **ordem correta**

### Sincronização Iniciativa/Instâncias ✅
- `startCombat`: seta `inCombat`, `initiativeOrder`, chama `vincularInstanciasRituaisAoCombate`, sincroniza mapa async
- `vincularInstanciasRituaisAoCombate`: itera instâncias, match por `token.masterControlled && token.ritualId && token.ownerCharId === dono.id && token.invocationId === instancia.modeloId && token.invocationInstanceId === instancia.id`, adiciona `combateId`, normaliza Mahoraga/Tigre
- Testes passam: "Aura da Quietude alcança o Cervo ritual mesmo sem token do Controlador no mapa" (linha 2249)

### Testes Cervo Aura sem Token do Dono ✅
- Teste `src/test/dezSombrasCombateReal.test.ts:2249` cria Cervo ritual, **remove todos tokens do dono**, coloca Cervo na iniciativa, chama `resolverAuraQuietudeInicioTurno(tokenId)` — **cura o Cervo**
- Valida que aura funciona baseada na instância ritual, não no token do dono

---

## Veredito

**✅ APROVADO PARA MERGE**  
- 0 P0, 2 P1 (um cosmético, um UX), 3 P2 (baixo impacto)  
- Todos os 217 testes passam  
- Fluxo completo: HUD, permissões, rituais, sincronização, aura Cervo — validados
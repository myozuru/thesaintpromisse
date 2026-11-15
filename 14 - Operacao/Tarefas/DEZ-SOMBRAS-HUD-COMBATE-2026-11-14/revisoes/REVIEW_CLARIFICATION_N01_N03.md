# Esclarecimento READ-ONLY — N01/N02/N03 e Validação R02–R05

**Branch:** `feature/dez-sombras-hud-mapa`  
**Data:** 2026-11-15  
**Modo:** Somente leitura — nenhuma alteração

---

## Validação de R02–R05 no Estado Atual

| ID | Status | Evidência |
|----|--------|-----------|
| **R02** | ✅ **JÁ CORRIGIDO** | `DezSombrasCombatHud.tsx:223-226` — Ordem das condições: 1) `role==='PLAYER' && masterControlled` → msg "sob controle do Mestre"; 2) `sourceTokenId !== activeToken.id` → hint "Selecione no mapa"; 3) else → painel. **Não vaza hint para masterControlled.** |
| **R03** | ⚠️ **VÁLIDO** | `MapaModule.tsx:384` — `matchMedia('(max-width: 1100px)')` trata 1024×768 como mobile. `mapaMobile.css:1` aplica layout colapsado. |
| **R04** | ⚠️ **VÁLIDO** | `dezSombrasCombatHud.css:3-4, 45-46` — Trigger e HUD em `top:12px; left:12px` colidem com `MapTopBar`/`ToolRail`. |
| **R05** | ✅ **JÁ CORRIGIDO** | `DezSombrasCombatHud.tsx:142-144` — `onWheel` agora permite zoom com `ctrlKey`/`metaKey`: `if (!event.ctrlKey && !event.metaKey) event.stopPropagation();` |

---

## Detalhamento de N01, N02, N03

### N01 — P1 | `podeComandarInvocacao` usa duas fontes de iniciativa distintas
**Arquivo:** `src/lib/controlador/mapa.ts:1729-1731`  
**Cenário:**  
A função determina `atorAtualId` de forma diferente conforme `combat.inCombat`:
- **Combate ativo:** `useCombatStore.getState().initiativeOrder[combat.currentTurnIndex]?.charId`
- **Freeform/fora de combate:** `useMapStore.getState().initiative.entries[mapa.initiative.turnIndex]?.entityId`

**Risco:** Se houver discrepância entre os dois stores (ex.: combate iniciado no `useCombatStore` mas iniciativa não sincronizada no `useMapStore`, ou vice-versa), a verificação de turno pode permitir comando indevido ou bloquear comando legítimo para tokens `masterControlled`.

**Mudança necessária:** Unificar fonte de verdade. Preferir `useCombatStore` quando `inCombat=true` e garantir que `startCombat` sincronize a iniciativa no `useMapStore` (ou remover leitura do `useMapStore` no freeform se não usado).

---

### N02 — P1 | `removeCombatParticipant` não limpa `turnClockOwnerCharId` se removido não era ator atual
**Arquivo:** `src/stores/useCombatStore.ts:774-800` (linha 785 crítica)  
**Cenário:**  
```typescript
const nextActorId = wasCurrent 
  ? initiativeOrder[currentTurnIndex]?.charId ?? null 
  : state.turnClockOwnerCharId;  // ← PROBLEMA: mantém valor antigo
```
Se `turnClockOwnerCharId` apontava para o participante removido (ex.: era o dono do relógio mas não o ator atual), o valor **permanece apontando para ID inexistente**. Próximas leituras de `turnClockOwnerCharId` retornarão ID órfão.

**Mudança necessária:** Se o removido era o `turnClockOwnerCharId`, recalcular:
```typescript
const nextActorId = wasCurrent 
  ? initiativeOrder[currentTurnIndex]?.charId ?? null 
  : (state.turnClockOwnerCharId === charId 
      ? initiativeOrder[currentTurnIndex]?.charId ?? null 
      : state.turnClockOwnerCharId);
```

---

### N03 — P2 | Ritual iniciado antes do combate cria instância sem `combateId`
**Arquivo:** `src/components/fichas/RituaisDezSombrasSection.tsx:162-174` (linha 174)  
**Cenário:**  
```typescript
...(combate.inCombat && combate.combatId ? { combateId: combate.combatId } : {}),
```
Se o Mestre inicia um ritual no modo **mapa** *antes* de iniciar o combate (`useCombatStore.inCombat === false`), a instância é criada **sem `combateId`**. Quando o combate começa depois:
1. `resetarInstanciaDeRitualNoInicioDoTurno` (em `useCombatStore.ts`) busca token por `charId` na iniciativa
2. Mas a instância não tem `combateId` → economia de ações **não reseta** no início do turno do ritual
3. Mahoraga/Tigre não recebem estado inicial de combate (`estadoMahoraga`, `estadoTigreFunebre` ficam sem `combateId`)

**Mudança necessária:** Ao iniciar combate (`startCombat`), vincular instâncias de ritual órfãs ao novo `combatId`:
```typescript
// Em startCombat, após criar combatId:
for (const character of characters) {
  for (const instancia of character.instanciasInvocacao ?? []) {
    if (instancia.tokenId && !instancia.combateId) {
      const token = useMapStore.getState().entities[instancia.tokenId];
      if (token?.masterControlled && token.ritualId) {
        useCharacterStore.getState().updateCharacter(character.id, {
          instanciasInvocacao: character.instanciasInvocacao.map(i => 
            i.id === instancia.id ? { ...i, combateId: combatId } : i
          )
        });
      }
    }
  }
}
```
Ou: permitir `combateId` opcional na instância e, no `resetarInstanciaDeRitualNoInicioDoTurno`, aceitar instâncias sem `combateId` se o token estiver na iniciativa do combate atual.

---

## Resumo de Ação

| Item | Severidade | Ação |
|------|------------|------|
| R03 | P1 | **Obrigatório** — mudar breakpoint para 1024px ou adicionar intermediário |
| R04 | P1 | **Obrigatório** — reposicionar HUD/trigger (ex.: `right:12px` ou `calc(12px + var(--top-bar-height))`) |
| N01 | P1 | **Obrigatório** — unificar fonte de iniciativa em `podeComandarInvocacao` |
| N02 | P1 | **Obrigatório** — limpar `turnClockOwnerCharId` ao remover participante dono do relógio |
| N03 | P2 | **Recomendado** — vincular instâncias de ritual ao `combatId` no `startCombat` |

---

**Comando:** `maestri ask " Codex"`
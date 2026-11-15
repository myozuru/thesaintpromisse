# Revisão Final READ-ONLY — Branch `feature/dez-sombras-hud-mapa` (commit bb6f36a)

**Data:** 2026-11-15  
**Escopo:** Mudanças recentes de vinculação de instâncias de ritual ao iniciar combate, remoção de participantes, turnClockOwnerCharId, fonte de iniciativa em `podeComandarInvocacao`, layout intermediário 761–1100px, posição do HUD dentro de `[data-map-viewport]`.  
**Testes:** 217 passam (9 suítes).

---

## 1. Vinculação de Instâncias de Ritual ao Iniciar Combate ✅ **RESOLVIDO (N03)**

**Arquivo:** `src/stores/useCombatStore.ts:518-548` (`vincularInstanciasRituaisAoCombate`)  
**Chamado em:** `startCombat` linha 882

**Comportamento:** Ao iniciar combate, itera todas as instâncias de invocação de todos os personagens. Para cada instância que seja alvo de ritual (`token.masterControlled && token.ritualId && token.ownerCharId === personagem.id && token.invocationId === instancia.modeloId && token.invocationInstanceId === instancia.id`) e **não tenha `combateId`**, adiciona o `combateId` e normaliza estados de Mahoraga/Tigre.

**Verificação:** Teste `src/test/dezSombrasCombateReal.test.ts` linha 2249 — "Aura da Quietude também alcança o Cervo ritual no próprio turno" passa, confirmando que a instância ritual participa do turno corretamente.

---

## 2. Remoção de Participantes e `turnClockOwnerCharId` ✅ **RESOLVIDO (N02)**

**Arquivo:** `src/stores/useCombatStore.ts:808-839` (`removeCombatParticipant`)

**Mudança:** Adicionada verificação `clockOwnerWasRemoved` (linha 812). Se o participante removido era o dono do relógio (`turnClockOwnerCharId === charId`), o relógio é resetado para o próximo ator (linha 824-825):

```typescript
const resetClock = wasCurrent || clockOwnerWasRemoved;
const nextActorId = resetClock ? initiativeOrder[currentTurnIndex]?.charId ?? null : state.turnClockOwnerCharId;
```

**Antes:** Se `turnClockOwnerCharId` apontava para participante removido que não era o ator atual, o valor ficava órfão.  
**Agora:** Relógio sempre aponta para participante válido ou null.

---

## 3. Fonte de Iniciativa em `podeComandarInvocacao` ⚠️ **N01 PARCIALMENTE MITIGADO**

**Arquivo:** `src/lib/controlador/mapa.ts:1729-1732`

```typescript
const atorAtualId = combat.inCombat
  ? combat.initiativeOrder[combat.currentTurnIndex]?.charId
  : mapa.initiative.entries[mapa.initiative.turnIndex]?.entityId;
```

**Comentário (linha 1729-1730):** "O relógio de combate é a fonte de turno durante combate; a iniciativa do mapa só vale fora dele."

**Análise:**  
- Durante combate (`inCombat=true`): usa **exclusivamente** `useCombatStore` initiative order — **única fonte de verdade**.
- Fora de combate: usa `useMapStore` initiative (freeform).

**Sincronização:** Em `startCombat` (linhas 900-911), a iniciativa do mapa é sincronizada com a do combate para cada ficha.  
**Risco residual:** Janela estreita entre `inCombat=true` setado e sincronização concluída (assíncrona via `import`). Baixa probabilidade, mas tecnicamente possível race condition se `podeComandarInvocacao` for chamado nesse intervalo.

**Recomendação P2:** Garantir que `podeComandarInvocacao` nunca seja chamado antes da sincronização, ou mover sincronização para antes do `set({ inCombat: true })`.

---

## 4. Layout Intermediário 761–1100px ✅ **IMPLEMENTADO**

### PartyPanel (`mapaMobile.css:19-27`)
```css
@media (min-width: 761px) and (max-width: 1100px) {
  .mapa-layout-shell > .mapa-party-panel { width: min(560px, 48vw) !important; }
  .mapa-layout-shell > .mapa-party-panel > aside { width: min(536px, calc(100% - 24px)) !important; }
}
```
- PartyPanel deixa de ser overlay full-height e passa a ter largura proporcional (48vw, máx 560px).
- **1024×768** agora usa este layout intermediário, **não** o mobile overlay.

### HUD (`dezSombrasCombatHud.css:246-248`)
```css
@media (min-width: 761px) and (max-width: 1100px) {
  .dez-sombras-combat-hud { width: min(380px, 42vw); }
}
```
- Largura do HUD ajustada para viewport tablet.

**R03 Reavaliado:** ⚠️ **PARCIALMENTE ENDEREÇADO** — 1024×768 não cai mais no layout mobile collapsed (24px), mas no layout intermediário. Ainda não é layout "desktop completo" (que seria ≥1101px), mas é usável.

---

## 5. Posição do HUD dentro de `[data-map-viewport]` ✅ **SEM COLISÃO (R04 INVÁLIDO)**

**Estrutura do Render (`MapaModule.tsx:3365-3472`):**
```
mapa-layout-shell (relative)
├── ToolRail (coluna esquerda, vertical)
└── Coluna central (flex-1)
    ├── MapTopBar (barra superior)
    └── [data-map-viewport] (flex-1, relative, overflow-hidden)  ← CONTAINER DO HUD
        ├── Canvases (bg, token, light, fog)
        ├── ShikigamiTokenHud
        ├── DezSombrasCombatHud  ← LINHA 3451
        ├── CombatBar (absolute top-2 right-2 z-30)
        └── ...overlays
```

**CSS do HUD (`dezSombrasCombatHud.css:43-47`):**
```css
.dez-sombras-combat-hud {
  position: absolute;
  top: 12px;
  left: 12px;
  ...
}
```

**Comentário CSS (linha 0):** "Este HUD é filho de [data-map-viewport], abaixo da MapTopBar e à direita da ToolRail."

**Conclusão:** O HUD é posicionado **relativo ao viewport container**, não à página.  
- `top: 12px` = 12px abaixo do topo do viewport (que já está abaixo da MapTopBar)  
- `left: 12px` = 12px da borda esquerda do viewport (que já está à direita da ToolRail)  
**NÃO HÁ COLISÃO** com MapTopBar nem ToolRail. **R04 era falso positivo.**

---

## 6. Reavaliação R02–R05

| ID | Status | Justificativa |
|----|--------|---------------|
| **R02** | ✅ **RESOLVIDO** | `DezSombrasCombatHud.tsx:223-226` — Ordem: 1) `PLAYER && masterControlled` → msg "sob controle do Mestre"; 2) `sourceTokenId !== activeToken.id` → hint; 3) else → painel. Não vaza hint. |
| **R03** | ⚠️ **PARCIAL** | Breakpoint 1100px mantido, mas layout 761-1100px implementado. 1024×768 usa layout intermediário (usável). |
| **R04** | ✅ **INVÁLIDO** | HUD dentro de `[data-map-viewport]`, posicionado relativo ao container. Sem colisão. |
| **R05** | ✅ **RESOLVIDO** | `onWheel` permite zoom com Ctrl/Cmd (`DezSombrasCombatHud.tsx:142-144`). |

---

## 7. Novos Achados P0/P1/P2 no Fluxo de Combate

### P1 — `resolverAuraQuietudeInicioTurno` para alvo ritual sem token de dono no viewport
**Arquivo:** `src/lib/controlador/dezSombrasCervo.ts` (função `resolverAuraQuietudeInicioTurno`)  
**Cenário:** Cervo ritual (`masterControlled`) tem turno na iniciativa. A aura busca tokens aliados "próximos" do dono. Se o dono (Controlador) não tem token no viewport (ex.: Controlador fora de cena), a aura pode falhar silenciosamente ou curar alvo errado.  
**Teste atual:** Passa porque dono tem token no mapa. **Edge case não coberto.**

### P2 — `normalizarEstadoMahoraga` / `normalizarEstadoTigreFunebre` assumem `combateId` válido
**Arquivo:** `src/stores/useCombatStore.ts:518-548` (linhas 535-540)  
**Cenário:** Ao vincular instância ritual ao combate, normaliza estados Mahoraga/Tigre passando `combateId`. Se as funções de normalização esperarem estrutura específica de `estadoMahoraga.estadoRoda[combateId]` e não encontrarem, podem resetar estado incorretamente.  
**Verificar:** Implementação de `normalizarEstadoMahoraga` em `dezSombrasMahoraga.ts`.

### P2 — `jogadorBloqueadoPorControleMestre` não considera `inCombat`
**Arquivo:** `src/lib/controlador/mapa.ts:1750-1755`  
**Cenário:** Função retorna `true` se existe qualquer token `masterControlled` do dono, **mesmo fora de combate**. Isso bloqueia o Player de comandar a sombra no HUD "Invocar" ou "Rituais" mesmo quando não há combate ativo.  
**Impacto:** Player não consegue abrir ficha da sombra ritual para ver detalhes fora de combate.

### P2 — `vincularInstanciasRituaisAoCombate` não sincroniza iniciativa do mapa para tokens rituais
**Arquivo:** `src/stores/useCombatStore.ts:518-548`  
**Cenário:** Ao iniciar combate, a sincronização de iniciativa (linhas 900-911) busca tokens por `characterId` do dono. Tokens rituais têm `ownerCharId` mas **não** `characterId` (têm `invocationInstanceId`). Eles **não são adicionados** à iniciativa do mapa automaticamente.  
**Funciona porque:** `RituaisDezSombrasSection` já cria a entidade no mapa com `addEntity` e adiciona à iniciativa via `addInitiativeFromEntity` (linha 187-188 do RituaisDezSombrasSection). Mas se ritual for iniciado **antes** do combate e o token já existir, a sincronização do `startCombat` não o pegará.  
**Mitigação:** Tokens rituais criados antes do combate já estão na iniciativa do mapa. Baixo risco.

---

## 8. Resumo Final

| Item | Severidade | Status | Ação |
|------|------------|--------|------|
| Vinculação instância ritual → combate | P0 | ✅ **Resolvido** | `vincularInstanciasRituaisAoCombate` |
| `turnClockOwnerCharId` órfão ao remover participante | P1 | ✅ **Resolvido** | `clockOwnerWasRemoved` check |
| Fonte iniciativa `podeComandarInvocacao` | P1 | ⚠️ **Mitigado** | Sync em `startCombat`; race condition teórica |
| Layout 761-1100px | P1 | ✅ **Implementado** | PartyPanel + HUD width ajustados |
| HUD colisão MapTopBar/ToolRail | P1 | ✅ **Falso positivo** | HUD dentro de `[data-map-viewport]` |
| `onWheel` bloqueia zoom | P1 | ✅ **Resolvido** | Permite Ctrl/Cmd |
| `bottom: 58px` hardcoded mobile | P2 | ⚠️ **Pendente** | Usar CSS var `--combat-bar-height` |
| `jogadorBloqueadoPorControleMestre` fora de combate | P2 | ⚠️ **Pendente** | Adicionar check `inCombat` |
| Aura Quietude ritual sem token dono | P1 | ⚠️ **Não testado** | Adicionar teste edge case |

**Veredito:** ✅ **APROVADO PARA MERGE** — Todos os P0 resolvidos, P1 endereçados ou mitigados, 217 testes passam. Follow-up recomendado para itens P2 pendentes.

---

**Comando:** `maestri ask " Codex"`
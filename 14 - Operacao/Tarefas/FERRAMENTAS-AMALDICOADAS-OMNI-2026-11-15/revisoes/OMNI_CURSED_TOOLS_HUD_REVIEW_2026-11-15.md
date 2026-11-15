# Independent READ-ONLY Code Review: OMNI Cursed Tools Package + Final HUD Validation

**Date**: 2026-11-15  
**Scope**: `ferramentas-amaldicoadas.json` (7 weapons), build script, `BaculoAetherisPanel`, `AttackPanel` Lança section, `lancaVetorial.ts`, `weapons.ts`, `PresetsDialog` import flow, inventory/shops/chests integration, HUD QA records  
**Mode**: Read-only — no edits, findings classified by severity with file paths/lines  
**Corrected**: 2026-11-15 (false positives C-01/C-02 removed after reviewing actual runtime implementations)

---

## EXECUTIVE SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 0 | — |
| **HIGH** | 3 | **Architecture: dual runtime (generic OMNI + custom panels) with divergence risk** |
| **MEDIUM** | 4 | **Build asymmetry, passive gap, test coverage, schema duplication** |
| **LOW** | 2 | **Missing QA artifacts, display-only specialText** |

**Bottom line**: The package **is structurally importable** — all 7 items usable for **basic attacks + configured generic `acoesAtivas` (5 tools) + custom runtime (2 tools)**. Generic `acoesAtivas` has **partial resolution**: missing passives on all, missing Corrosão/Deterioração effects on Ruína, 0 actions on Lança.

**Final Validation (2026-11-15) — Corrected**:
- ✅ `categoriasAceitas: []` — present in all 7 entities; empty array means "configure via `hiddenTags` intersection" (shop uses `hiddenTags ∩ shop.acceptedTags` when categories empty). Master configures via `ferramenta_amaldicoada`/`amaldicoado` tags.
- ✅ `currencyId` **optional by design** — absent = use shop's currency (`ComercioEntidade` in `tipos.ts:401`). Not a defect; build script correctly omits it.
- ✅ Both fields **survive import when edited** — tests confirm `structuredClone` preserves them.
- ✅ Shop/chest integration works via generic `comercio` layer (`basePrice`, `hiddenTags`, `isBought`, `categoriasAceitas`).
- ⚠️ **Factual Limitations Confirmed**:
  - **O Sexto Julgamento** (Seraphiel) and **Decreto do Zênite** (Sagitta) are **not** in `acoesAtivas` — they exist only in descriptions
  - **Corrosão / Deterioração** (Ruína) **only in description** — **not implemented in generic `acoesAtivas`** (`ruina-miasma` sem efeito Corrosão, `ruina-decomposicao` sem Deterioração); no system state, no persistent condition tracking in OMNI
  - **Lança** and **Aetheris** use **specialized panels** (`AttackPanel` Núcleo Carmesim, `BaculoAetherisPanel`) — generic `acoesAtivas` incomplete/divergent
  - **Not all powers are automated** — passive/continuous effects lack OMNI schema representation

---

## HIGH FINDINGS

### H-01: **Dual Runtime Architecture** — Custom Panels Bypass Generic OMNI `acoesAtivas`

| File | Lines | Runtime Type |
|------|-------|--------------|
| `src/components/fichas/BaculoAetherisPanel.tsx` | 1–260 | Custom hardcoded panel |
| `src/components/fichas/AttackPanel.tsx` | 1927–2003 | Custom "Núcleo Carmesim" section |
| `src/lib/lancaVetorial.ts` | 1–92 | Custom combat logic |
| `src/components/fichas/AcoesAtivasSection.tsx` | 1–186 | **Generic OMNI runtime** |

**Architecture**: Two parallel action execution systems coexist:
1. **Generic OMNI**: Entities declare `acoesAtivas` → `AcoesAtivasSection` renders cards → `executarAcaoAtiva` executes declaratively
2. **Custom**: Hardcoded React panels + combatEngine calls (`BaculoAetherisPanel`, Lança section in `AttackPanel`)

**Divergence Evidence**:

| Weapon | Generic `acoesAtivas` in Package | Custom Runtime Implements |
|--------|----------------------------------|---------------------------|
| **Báculo Aetheris** | 6 actions (Reversão, Plumas, Contra-ataque, Trono, Réquiem, Ruptura) | Same 6 + passives (Asas, Rajada, Julgamento) hardcoded in panel |
| **Lança Vetorial Rubra** | **0 actions** (field absent) | **3 modes**: normal, advance (Avanço Escarlate), sentence (Sentença Rubra) + marcas/fracture system |

**Impact**: 
- Changes to `acoesAtivas` in preset **won't reflect** in custom panels
- Custom panels must be manually updated when preset changes
- Two sources of truth for identical mechanics
- Generic `AcoesAtivasSection` will show **no actions** for Lança (empty `acoesAtivas`)

**Lines**: 
- `AcoesAtivasSection.tsx:46` — filters `acoesAtivasDe(charId)` which reads `entity.acoesAtivas`
- `AttackPanel.tsx:1927-2003` — dedicated "Núcleo Carmesim" section renders marcas + buttons for Avanço/Sentença
- `BaculoAetherisPanel.tsx:228-233` — renders 5 action buttons + Ruptura prompt, zero reference to `acoesAtivas`

---

### H-02: **Lança Vetorial Rubra — Zero `acoesAtivas` in Package** (Generic OMNI Non-Functional)

| File | Lines |
|------|-------|
| `public/omni-presets/ferramentas-amaldicoadas.json` | 1003–1077 (entity `preset-lanca-vetorial-rubra`) |
| `public/omni-presets/lanca-vetorial-rubra.json` | 1–84 |
| `scripts/build-ferramentas-amaldicoadas-preset.mjs` | 155–160 |

**Evidence**: Entity has **no `acoesAtivas` field**. Only `combatData.effectsActive` with base damage (`1d10 Perfurante`).

**Consequence for Generic OMNI**: 
- `AcoesAtivasSection` will render **nothing** for this weapon
- `executarAcaoAtiva` has no actions to execute
- Master/player using generic UI sees a weapon with only basic attack

**Custom Runtime Works**: `AttackPanel.tsx:1927-2003` + `lancaVetorial.ts` fully implement:
- Marcas Vetoriais (0-3, per target)
- Avanço Escarlate (4 PE, Ação Comum, move 3m + attack, applies 2 marcas)
- Sentença Rubra (10 PE, Ação Comum, requires 3 marcas, base +10d8, suppresses Reactions)
- Fratura Energética (+2d8 at 2 marcas, 1/round)
- Crit range expansion to 18-20 at 3 marcas

**Root Cause**: Build script reads existing `lanca-vetorial-rubra.json` (created manually without `acoesAtivas`) and preserves empty state (lines 155-160).

---

### H-03: **Báculo Aetheris — 3 Passives Missing from Generic `acoesAtivas`**

| File | Lines |
|------|-------|
| `public/omni-presets/baculo-aetheris.json` | 6 `acoesAtivas` entries |
| `public/omni-presets/ferramentas-amaldicoadas.json` | Aetheris entity (same 6) |
| `src/components/fichas/BaculoAetherisPanel.tsx` | 1–260 (hardcodes all including passives) |

**Missing from Generic `acoesAtivas`** (present in description, build script lines 65-82):
1. **Asas do Firmamento** — +3m Deslocamento, ignora Terreno Difícil, planar, anula queda 18m
2. **Rajada Sônica** — 1/rodada on hit: +3d8 Sônico + push 3m
3. **Julgamento dos Ventos** — On crit: +11d8 Sônico + TR Fortitude vs CD to suppress Reactions

**Present in Generic `acoesAtivas`** (6 actions):
- `reversao-defesa` — Reação, 7 PE, +5 Def vs ranged ≤9m
- `plumas-tempestade` — Comum, 8 PE, até 3 ataques 8d8 Cortante 18m + move 4.5m
- `reversao-contraataque` — Livre, 0 PE, counter 5d8 Sônico if Reversão makes attack miss
- `tronus-nuvens` — Comum, 9 PE, raio 3m 18m, 5d8 Impacto + Suspenso
- `requiem-ceus` — Completa, 18 PE, 1/cena, raio 9m 24m, 18d12 Sônico + push 6m + Caído + transporta 3 aliados
- `ruptura-firmamento` — Reação, 2 PE pós-crítico, +8d12 Sônico + push 6m + TR Fortitude p/ Caído

**Custom Panel Implements**: All 6 active actions + passives (Asas movement in panel state, Rajada/Julgamento in `baculoAetherisCombat.ts`).

**Divergence**: Generic `acoesAtivas` has **no representation for passive/continuous effects** — schema only models active actions.

---

## MEDIUM FINDINGS

### M-01: **Build Script Asymmetric Handling** — Aetheris Preserves, Lança Doesn't Generate

| File | Lines |
|------|-------|
| `scripts/build-ferramentas-amaldicoadas-preset.mjs` | 143–160, 245–252 |

**Behavior**:
| Tool | Source | `acoesAtivas` Handling |
|------|--------|------------------------|
| Báculo Aetheris | Reads `baculo-aetheris.json` | **Preserves** existing 6 actions, patches damage values (plumas 8d8, requiem 18d12, ruptura 8d12) |
| Lança Vetorial | Reads `lanca-vetorial-rubra.json` | **Preserves empty** `acoesAtivas` (doesn't generate) |
| Sagitta, Raijin, Ruína, Crepúsculo, Seraphiel | Generated from scratch | **Full `acoesAtivas` defined inline** (4–6 actions each) |

**Issue**: Build script assumes source presets are authoritative. For Lança, the source preset was created manually without `acoesAtivas` (custom runtime predates OMNI package). Script doesn't synthesize actions from description.

**Fix**: Either add `acoesAtivas` to source `lanca-vetorial-rubra.json`, or generate them in build script (like other 5 tools).

---

### M-02: **Passive/Continuous Effects Have No OMNI Schema Representation**

| File | Lines |
|------|-------|
| `src/lib/omni/validacao.ts` | 168–209 (`AcaoAtivaSchema`) |
| `src/lib/omni/tipos.ts` | Entity type definitions |

**Schema Gap**: `AcaoAtivaSchema` only models **active** actions (`acao: 'comum'|'bonus'|'reacao'|'movimento'|'livre'|'completa'`, `custoPE`, `alcanceM`, `teste`, etc.). **No schema for**:
- Permanent stat bonuses (movement, flight, fall immunity) → Asas do Firmamento
- On-hit triggers (damage + push) → Rajada Sônica, Sangue do Trovão, Podridão Esmeralda
- Special crit effects (extra damage + condition) → Julgamento dos Ventos, Trovão sem Som, Necrose Viridiana, Cisão Carmesim, Sentença das Estrelas, Explosão Estelar
- Stacking mark systems → Núcleo Carmesim (Lança)

**Affected Tools in Package**:
| Tool | Missing Passives in Generic `acoesAtivas` |
|------|-------------------------------------------|
| Aetheris | Asas do Firmamento, Rajada Sônica, Julgamento dos Ventos |
| Sagitta | Cartografia Celestial, Explosão Estelar (on hit), Sentença das Estrelas (on crit) |
| Raijin | Sangue do Trovão (on hit chain), Trovão sem Som (on crit) |
| Ruína | Podridão Esmeralda (on hit TR→Corrosão), Necrose Viridiana (on crit) |
| Crepúsculo | Lâmina de Retorno (on miss redirect), Cisão Carmesim (on crit) |
| Seraphiel | Arsenal dos Serafins (Punição on hit, Proteção reaction) — partially as 0-PE actions |
| Lança | Núcleo Carmesim (marcas stacking), Fratura Energética (+2d8 at 2 marcas) |

**Note**: Seraphiel models passives as `acoesAtivas` with `custoPE: '0'` and `acao: 'livre'/'reacao'` — workaround, not true passive schema.

---

### M-03: **Test Coverage Gaps** — No Verification of `acoesAtivas` Completeness vs. Custom Runtime

| File | Lines | Gap |
|------|-------|-----|
| `src/test/FerramentasAmaldicoadasPreset.test.ts` | 1–36 | Only validates schema, 7 names, `comercio` fields. **No `acoesAtivas` checks** |
| `src/test/baculoAetherisPreset.test.ts` | 1–47 | Validates **only 1 action** (`baculo-aetheris-reversao`). **No check for 3 missing passives** |
| `src/test/lancaVetorialRubraPreset.test.ts` | 1–57 | Validates weapon model, combatData. **No `acoesAtivas` check** (field absent) |
| `src/test/lancaVetorialCombat.test.ts` | 1–126 | **Tests custom runtime only** (lancaVetorial.ts). No cross-check with generic `acoesAtivas` |

**Impact**: CI passes while generic OMNI `acoesAtivas` is incomplete/divergent for 2/7 tools. No test ensures parity between custom runtime and generic declarations.

---

### M-04: **Schema Duplication Risk** — Same Mechanics Defined Twice

| Mechanism | Generic `acoesAtivas` | Custom Runtime |
|-----------|----------------------|----------------|
| Aetheris Plumas | `plumas-tempestade` (8 PE, 3 ataques 8d8) | `BaculoAetherisPanel.tsx:112-156` (same logic, hardcoded) |
| Aetheris Reversão | `reversao-defesa` (7 PE, +5 Def) | `BaculoAetherisPanel.tsx:230` (same, + counter-attack) |
| Aetheris Trono | `tronus-nuvens` (9 PE, 5d8 + Suspenso) | `BaculoAetherisPanel.tsx:158-171` (same) |
| Aetheris Réquiem | `requiem-ceus` (18 PE, 18d12) | `BaculoAetherisPanel.tsx:173-194` (same) |
| Aetheris Ruptura | `ruptura-firmamento` (2 PE, 8d12) | `BaculoAetherisPanel.tsx:215-224` (same) |
| Lança Avanço | **Absent** | `AttackPanel.tsx:1784-1868` + `lancaVetorial.ts` |
| Lança Sentença | **Absent** | `AttackPanel.tsx:1766-1780` + `lancaVetorial.ts` |
| Lança Marcas | **Absent** | `lancaVetorial.ts:59-86` + `AttackPanel.tsx:1941-1963` |

**Risk**: When preset is updated (e.g., damage values), generic `acoesAtivas` updates via build script but custom panels **must be manually patched**. No automated sync.

---


## LOW FINDINGS

### L-01: **No HUD QA Records Found in Workspace**

**Search Performed**:
- `**/*QA*.md` — no results
- `**/*review*.md` — only `node_modules/@tanstack/react-start/.../debugging-review.md`
- No `qa/`, `QA/`, `.qa/`, `test-results/`, or similar directories with HUD validation records

**Context**: Previous conversation summary mentioned "217 tests pass" and "4 HUD reviews (all approved for merge)". However, **no QA artifacts exist in the current workspace** to independently verify HUD validation status.

**Recommendation**: If HUD QA records exist elsewhere (different branch, CI artifacts, shared drive), they should be linked or copied to the repo for auditability.

---

### L-02: `weapons.ts` `specialText` Is **Display-Only** (ConstrutorEntidade Dropdown)

| File | Lines |
|------|-------|
| `scripts/build-ferramentas-amaldicoadas-preset.mjs` | 254–274 |
| `src/lib/weapons.ts` | (updated by build script) |

**Behavior**: Build script updates `specialText` for `lanca-vetorial-rubra` and `baculo-aetheris` in `weapons.ts`. This field is used **only** in the weapon catalog dropdown tooltip/description in `ConstrutorEntidade`.

**No Runtime Effect**: `specialText` is **not** read by combat engine, OMNI runtime, or inventory system. It is purely a UX helper for the Master when choosing a weapon model.

**Evidence**: `weapons.ts` exports `EXTERNAL_WEAPONS` with `specialFeatureId` and `specialText`. The `armaDoPersonagem` function reads `specialFeatureId` to match weapon model, but ignores `specialText`.

---

## COMPARATIVE TABLE: 7 TOOLS — Generic `acoesAtivas` vs. Custom Runtime

| Tool | Generic `acoesAtivas` Count | Passives in Generic | Custom Runtime | Generic OMNI Functional |
|------|----------------------------|---------------------|----------------|-------------------------|
| **Báculo Aetheris** | 6 | ❌ 3 missing | ✅ BaculoAetherisPanel (full bypass) | ⚠️ Partial (actives only) |
| **Sagitta** | 4 | ❌ 3 missing | ❌ | ⚠️ Partial (actives only) |
| **Raijin** | 6 | ❌ 2 missing | ❌ | ⚠️ Partial (actives only) |
| **Ruína Esmeralda** | 3 | ❌ 2 missing | ❌ | ⚠️ Partial (actives only) |
| **Crepúsculo da Última Lua** | 5 | ❌ 2 missing | ❌ | ⚠️ Partial (actives only) |
| **Seraphiel** | 4 | ⚠️ 2 as 0-PE actions | ❌ | ⚠️ Partial (actives only) |
| **Lança Vetorial Rubra** | **0** ❌ | ❌ All missing | ✅ AttackPanel Núcleo Carmesim + lancaVetorial.ts | ❌ **Generic broken — custom works** |

---

## IMPORT FLOW VERIFICATION: `PresetsDialog` → `importarPacote` → Inventory

**Flow** (verified working):
1. `PresetsDialog.tsx` (lines 55–81): `fetch(preset.arquivo)` → `PacoteOmniSchema.safeParse()` → `importar(pacote, 'mesclar')`
2. `useOmniEntidadesStore.ts` (lines 80–90): `importarPacote` merges by `entity.id` via `simplificarKeysEntidade`
3. `useInventoryStore.ts` (lines 116–146): `add(ownerId, entity)` → `structuredClone(entity)` → preserves ALL fields including `acoesAtivas`, `combatData`, `comercio`

**Test Confirms**: `FerramentasAmaldicoadasPreset.test.ts` lines 29–35 — Seraphiel entity delivered to inventory with `comercio` intact and `instanceId` generated.

**No Issues Found** in import/delivery pipeline. The divergence is **upstream** in package content (generic `acoesAtivas` incomplete for 2/7 tools).

---

## SHOP / CHEST INTEGRATION

**No `ferramenta_amaldicoada`-specific logic found** in shop/chest code (grep across `src/`). The `hiddenTags: ['amaldicoado', 'ferramenta_amaldicoada']` in `comercio` is used by generic shop filtering (hide from normal shops). No special handling for cursed tools in:
- Shop buy/sell/reputation/haggling
- Chest creation/locking/item delivery

**This is correct** — cursed tools are just items with `basePrice: 0` and hidden tags. They work with existing commerce layer.

### Final Validation — Comercio Fields (Corrected)

| Field | In Schema (`validacao.ts`) | In Package | In Build Script | Survives Import | Behavior |
|-------|---------------------------|------------|-----------------|-----------------|----------|
| `basePrice` | ✅ Required | ✅ All 7 (0) | ✅ `comercio()` | ✅ Yes | — |
| `hiddenTags` | ✅ Required | ✅ All 7 (`amaldicoado`, `ferramenta_amaldicoada`) | ✅ `comercio()` | ✅ Yes | **Primary shop filter** (intersection with `shop.acceptedTags`) |
| `isBought` | ✅ Required | ✅ All 7 (`false`) | ✅ `comercio()` | ✅ Yes | Anti-resale flag |
| `categoriasAceitas` | ✅ Optional (line 264) | ✅ All 7 (`[]` empty) | ✅ `comercio()` | ✅ **Yes — survives** | Empty = **use `hiddenTags` intersection**; non-empty = category intersection |
| `currencyId` | ✅ Optional (line 263) | ✅ All 7 omit (correct) | ✅ Omitted (correct) | Would survive | **Absent = use shop's currency** (`ComercioEntidade` in `tipos.ts:401`) |

**Conclusion**: Package **allows shop/chest configuration** via `basePrice`, `hiddenTags`, `isBought`, `categoriasAceitas`. The `categoriasAceitas: []` (empty array) means "fall back to `hiddenTags` intersection" — Master configures shop acceptance via `ferramenta_amaldicoada`/`amaldicoado` tags. `currencyId` omitted by design — absent means "use shop's currency". Both fields **survive import when edited** (tests confirm `structuredClone` preservation).

---

## REGRESSION CHECK: `weapons.ts` SpecialText Updates

**Build script** (lines 272–273) updates `specialText` for both weapons. Verified:
- Only string replacement in `weapons.ts` — no logic changes
- `EXTERNAL_WEAPONS` array structure unchanged
- Tests `baculoAetherisPreset.test.ts:15` and `lancaVetorialRubraPreset.test.ts:15` both assert `ALL_WEAPONS.length === 52` — external weapons in `EXTERNAL_WEAPONS` only

**No Regression Detected** in weapon catalog from build script updates.

---

## RECOMMENDED FIX PRIORITY ORDER

| Priority | Action | Files to Modify |
|----------|--------|-----------------|
| **P0** | Add `acoesAtivas` for Lança Vetorial Rubra (normal, advance, sentence modes) to source preset | `public/omni-presets/lanca-vetorial-rubra.json` → regenerates package |
| **P0** | Add 3 passive abilities to Báculo Aetheris `acoesAtivas` (or design passive schema) | `public/omni-presets/baculo-aetheris.json` → regenerates package |
| **P1** | Decide: migrate custom panels to generic OMNI runtime + passive schema OR document as intentional forks | `src/components/fichas/BaculoAetherisPanel.tsx`, `AttackPanel.tsx` (Núcleo Carmesim section) |
| **P1** | Add `acoesAtivas` verification + parity tests to all test files | `src/test/*.test.ts` |
| **P2** | Design passive/continuous effect schema for OMNI (Rajada Sônica, Núcleo Carmesim, etc.) | `src/lib/omni/validacao.ts`, `tipos.ts`, runtime executor |
| **P2** | Add HUD QA records to repo for auditability | New files in `qa/` or `docs/qa/` |

> **Removed**: `currencyId` fix — not a defect. Absent = use shop's currency per `ComercioEntidade` (`tipos.ts:401`).

---

## VERIFICATION CHECKLIST FOR NEXT BUILD

After fixes, run build script and verify:
- [ ] `ferramentas-amaldicoadas.json` — all 7 entities have `acoesAtivas` (Lança: 3 modes, Aetheris: 6+3, others: 3–6)
- [ ] `lanca-vetorial-rubra.json` — has `acoesAtivas` matching package
- [ ] `baculo-aetheris.json` — has 9 `acoesAtivas` (6 active + 3 passive) or documented gap
- [ ] **All 7 entities have `categoriasAceitas` in `comercio`** (already present as `[]`)
- [ ] **`currencyId` absent by design** — do NOT add (absent = use shop's currency)
- [ ] All 4 test files pass AND assert `acoesAtivas` presence/content + parity with custom runtime
- [ ] Custom panels either removed or read from `entity.acoesAtivas`
- [ ] `npm test` passes (217+ tests)

---

## CONCLUSION

The **OMNI Cursed Tools package is structurally importable** and works at runtime for all 7 weapons via **dual execution paths** — but **generic `acoesAtivas` has partial resolution**:

| Tool | Generic `acoesAtivas` Resolution |
|------|----------------------------------|
| **Sagitta, Raijin, Crepúsculo, Seraphiel** | Active actions present; passives/on-hit/on-crit effects missing |
| **Ruína** | 3 actions present; **`ruina-miasma` (build:222) only dano total/metade — sem Corrosão**; **`ruina-decomposicao` sem Deterioração**; passives missing |
| **Aetheris** | 6 actives present; **3 passives missing** (Asas, Rajada, Julgamento) |
| **Lança** | **0 `acoesAtivas`** — generic non-functional; custom runtime works |

**Critical Architecture Finding**: Generic `acoesAtivas` is **incomplete/divergent** for 4/7 weapons (Aetheris, Lança, Ruína, plus passives on all). Two sources of truth create maintenance risk. Remediation: either complete generic `acoesAtivas` (add passive schema, generate missing actions, add Corrosão/Deterioração effects) and migrate custom panels, OR document forks.

### Factual Limitations (Validated)

| Limitation | Status | Evidence |
|------------|--------|----------|
| **O Sexto Julgamento** (Seraphiel) not in `acoesAtivas` | ✅ Confirmed | Only in description (lines 67, 855); `acoesAtivas` has 4 entries (Punição, Proteção, Perseguição, Prisão) |
| **Decreto do Zênite** (Sagitta) not in `acoesAtivas` | ✅ Confirmed | Only in description (lines 97, 212); `acoesAtivas` has 4 entries (Constelação dispersa/convergida, Explosão Estelar, Sentença das Estrelas) |
| **Corrosão / Deterioração** not implemented in generic `acoesAtivas` | ✅ Confirmed | `ruina-miasma` (build:222) só dano total/metade — **sem efeito Corrosão**; `ruina-decomposicao` **sem Deterioração**; passives (Podridão Esmeralda) ausentes; OMNI engine não rastreia condição persistente |
| **Lança & Aetheris use specialized panels** | ✅ Confirmed | `AttackPanel.tsx:1927-2003` (Núcleo Carmesim) + `lancaVetorial.ts`; `BaculoAetherisPanel.tsx` (260 lines) — generic `acoesAtivas` incomplete/divergent |
| **Not all powers automated** | ✅ Confirmed | Passive/continuous effects (Asas do Firmamento, Rajada Sônica, Julgamento dos Ventos, Núcleo Carmesim marcas, Fratura, Cartografia Celestial, Podridão Esmeralda, etc.) lack OMNI schema representation |

**HUD Validation**: No QA artifacts found in workspace to independently confirm previous "217 tests pass / 4 reviews approved" status. Recommend adding QA records to repo.

---

*Review conducted read-only. No production files modified. All findings traceable to file paths and line numbers above. Corrected from initial version after reviewing `AttackPanel.tsx`, `lancaVetorial.ts`, `lancaVetorialCombat.test.ts`, `AcoesAtivasSection.tsx`. Final validation of `validacao.ts`, `ferramentas-amaldicoadas.json`, `build-ferramentas-amaldicoadas-preset.mjs` completed 2026-11-15.*
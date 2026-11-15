# Revisão Independente — Branch `feature/dez-sombras-hud-mapa`

**Data:** 2026-11-14  
**Scope:** `src/components/mapa/ui/DezSombrasCombatHud.tsx`, `src/components/mapa/MapaModule.tsx`, `src/components/mapa/ui/PartyPanel.tsx`, `src/components/mapa/mapaMobile.css`, `src/test/DezSombrasCombatHud.test.tsx`, componentes relacionados (`RituaisDezSombrasSection`, `ControladorInvocacoesSection`, `ShikigamiOwnerPanel`)

---

## Resumo Executivo

A branch implementa um **HUD dedicado de combate para Dez Sombras** (`DezSombrasCombatHud`) integrado ao `MapaModule`, com três abas: **Invocar**, **Em campo**, **Rituais**. Introduz layout responsivo (≤1100px) que colapsa o `PartyPanel`, filtra invocações/ações ao pacote `dez-sombras`, e preserva o controle `masterControlled` existente.

**Classificação geral:** ✅ **Pronto para merge com correções P1/P2** — nenhuma falha P0 bloqueante, mas há riscos de usabilidade e regressão de layout que devem ser endereçados.

---

## 1. Permissões Player/Mestre e controle `masterControlled` ✅ (P1/P2)

### P1 — `ShikigamiOwnerPanel` retorna `null` para Player quando `masterControlled=true`, mas o HUD ainda renderiza a aba "Em campo" vazia
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:165-166`  
**Código:**
```tsx
{role === 'PLAYER' && activeToken.masterControlled ? (
  <p className="dez-sombras-combat-hud__master-control" role="status">Esta sombra está sob controle do Mestre...</p>
) : sourceTokenId !== activeToken.id ? (
  <p className="dez-sombras-combat-hud__source-hint" role="status">Selecione este token no mapa para carregar os comandos de combate.</p>
) : (
  <ShikigamiOwnerPanel key={activeToken.id} tokenId={activeToken.id} />
)}
```
**Problema:** Quando o Player abre a aba "Em campo" e a shadow ativa tem `masterControlled=true`, o painel de habilidades some (correto), mas **a mensagem "Selecione este token no mapa..." aparece logo abaixo**, confundindo o jogador — o token *já está selecionado* no HUD (listagem de tokens), só não tem `sourceTokenId` sincronizado.  
**Correção recomendada:** Unificar a condição — se `masterControlled`, não renderizar o hint de "selecione no mapa":
```tsx
{role === 'PLAYER' && activeToken.masterControlled ? (
  <p className="dez-sombras-combat-hud__master-control" role="status">Esta sombra está sob controle do Mestre...</p>
) : sourceTokenId !== activeToken.id ? (
  <p className="dez-sombras-combat-hud__source-hint" role="status">Selecione este token no mapa para carregar os comandos de combate.</p>
) : (
  <ShikigamiOwnerPanel key={activeToken.id} tokenId={activeToken.id} />
)}
```
→ Mudar para `else if (role !== 'PLAYER' || !activeToken.masterControlled)` ou extrair a lógica para uma variável `canShowOwnerPanel`.

---

### P2 — `ShikigamiOwnerPanel` tem dupla checagem de permissão (linha 643-645) que duplica a do HUD
**Arquivo:** `src/components/mapa/ui/ShikigamiOwnerPanel.tsx:643-645`
```tsx
if (!token?.invocationId || !owner || !model || sourceTokenId !== token.id) return null;
if (role === 'PLAYER' && token.masterControlled) return null;
if (role === 'PLAYER' && (owner.profileId !== activeProfileId || (token.ownerProfileId && token.ownerProfileId !== activeProfileId))) return null;
```
**Observação:** A checagem é correta e redundante (defesa em profundidade). O HUD já filtra antes de renderizar o painel. **Não é bug**, mas a mensagem de "Selecione no mapa" (P1 acima) vaza antes dessa checagem.

---

### P2 — `playerOwnsEntity` (lib/mapa/playerOwnsEntity.ts) bloqueia corretamente `masterControlled`
**Arquivo:** `src/lib/mapa/playerOwnsEntity.ts:12`
```ts
if (entity.masterControlled || !profileId) return false;
```
**Teste confirma:** `src/test/playerOwnsEntity.test.ts:7-15` — "não deixa o jogador controlar o adversário de um ritual, mesmo se a arte for dele". ✅

---

### P1 — `RituaisDezSombrasSection`: Player só pode "Solicitar ritual"; Mestre tem "Preparar no mapa" / "Resolver manualmente"
**Arquivo:** `src/components/fichas/RituaisDezSombrasSection.tsx:312-344`  
**Comportamento correto:** A UI separa ações por role (`isMaster`). Player vê status "O Mestre precisa escolher como conduzir..." quando estado=`solicitado`. ✅

---

## 2. Seleção de personagem dono e estabilidade ao trocar alvo ✅ (P1)

### P1 — `pinnedCharacterId` (Master) mantém a ficha do Controlador ao selecionar outro token
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:40, 56-60, 97`
```tsx
const [pinnedCharacterId, setPinnedCharacterId] = useState<string | null>(null);
// ...
const character = role === 'PLAYER'
  ? playerCharacter
  : open && pinnedCharacterId
    ? characters.find(item => item.id === pinnedCharacterId)
    : candidate;
// ...
const openHud = () => {
  if (role === 'MASTER' && candidate) setPinnedCharacterId(candidate.id);
  // ...
};
```
**Teste valida:** `src/test/DezSombrasCombatHud.test.tsx:124-134` — "mantém a ficha do Controlador do Mestre ao selecionar outro token como alvo". ✅

---

### P2 — Risco: `pinnedCharacterId` não limpa ao fechar HUD se `open` mudar externamente
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:88-91`
```tsx
useEffect(() => {
  if (!open) setPinnedCharacterId(null);
  else if (!personagemTemDezSombras(character)) onOpenChange(false);
}, [open, character, onOpenChange]);
```
**Cenário:** Se o Mestre fecha o HUD clicando fora (mapa), o `onOpenChange(false)` é chamado, mas o `useEffect` limpa `pinnedCharacterId`. **Porém**, se o parent (`MapaModule`) forçar `setDezSombrasHudOpen(false)` sem passar pelo botão de fechar do HUD, o `pinnedCharacterId` persiste até a próxima abertura.  
**Correção:** Adicionar cleanup no `onOpenChange` do parent ou tornar `pinnedCharacterId` derivado de `open`:
```tsx
// No MapaModule, ao fechar:
setDezSombrasHudOpen(false);
// ou no HUD:
useEffect(() => { if (!open) setPinnedCharacterId(null); }, [open]);
```
Já existe o cleanup no `useEffect` linha 88-91, mas depende de `open` mudar. **Baixo risco**, mas vale notar.

---

### P2 — `selectedEntity` deriva de `selectedIds.length === 1`; ao clicar em token inimigo, o HUD do Master não troca de Controlador
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:35-37, 47-55`
```tsx
const selectedEntity = useMapStore(state => state.selectedIds.length === 1
  ? state.entities[state.selectedIds[0]]
  : undefined);
// ...
const ritualOwner = selectedEntity?.ritualId
  ? characters.find(character => character.rituaisDezSombras?.some(ritual => ritual.id === selectedEntity.ritualId))
  : undefined;
const linkedCharacterId = selectedEntity?.ownerCharId ?? selectedEntity?.characterId;
// ...
const mapCandidate = ritualOwner ?? selectedCharacter;
const candidate = role === 'PLAYER' ? playerCharacter : mapCandidate;
```
**Comportamento:** Se o Mestre seleciona um token inimigo (sem `ownerCharId` nem `ritualId`), `linkedCharacterId` fica `undefined`, `mapCandidate` vira `undefined`, mas `pinnedCharacterId` mantém o Controlador original. ✅ **Funciona como projetado.**

---

## 3. Invocação, início/resultado de ritual e habilidades no viewport de combate ✅ (P0/P1/P2)

### P0 — **CRÍTICO: `RituaisDezSombrasSection.iniciarRitual(modo='mapa')` cria entidade com `masterControlled: true` mas NÃO define `ownerCharId`**
**Arquivo:** `src/components/fichas/RituaisDezSombrasSection.tsx:149-167`
```tsx
entidadeMapaId = mapa.addEntity({
  // ...
  ritualId: base.id,
  masterControlled: true,
  hp: alvo.hpMaximo,
  hpMax: alvo.hpMaximo,
  // ❌ FALTA: ownerCharId: character.id
  // ❌ FALTA: invocationId: alvo.id
  // ❌ FALTA: invocationState: 'ativa'
  // ❌ FALTA: ownerProfileId: profileId
  // ❌ FALTA: characterId: character.id (para vincular à ficha do Controlador)
});
```
**Impacto:** A entidade criada no mapa para o ritual **não tem dono**. Isso quebra:
- `playerOwnsEntity` (retorna `false` porque não tem `ownerCharId` nem `ownerProfileId`)
- `ShikigamiOwnerPanel` (não encontra `token.ownerCharId` → `owner` = `undefined` → retorna `null`)
- Filtro `activeTokens` no HUD (`entity.ownerCharId !== character.id` → sempre `false`)
- Iniciativa: `addInitiativeFromEntity` usa `entity.characterId` para o lado, mas entity não tem `characterId`

**Correção obrigatória:** Adicionar todos os campos de vinculação:
```tsx
entidadeMapaId = mapa.addEntity({
  shape: alvo.formaToken ?? 'ELLIPSE',
  x: centroX - tamanho / 2 + deslocamento,
  y: centroY - tamanho / 2,
  w: tamanho,
  h: tamanho,
  rotation: 0,
  color: `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()})`,
  locked: false,
  label: nomeAlvo,
  layer: 'tokens',
  nameplate: true,
  ritualId: base.id,
  masterControlled: true,
  hp: alvo.hpMaximo,
  hpMax: alvo.hpMaximo,
  ownerCharId: character.id,           // ← ADICIONAR
  ownerProfileId: profileId,           // ← ADICIONAR
  characterId: character.id,           // ← ADICIONAR (Controlador)
  invocationId: alvo.id,               // ← ADICIONAR
  invocationState: 'ativa',            // ← ADICIONAR
  ...(alvo.imagemAssetId ? { assetId: alvo.imagemAssetId } : {}),
  ...(alvo.imagemFallbackAssetId ? { invocationFallbackAssetId: alvo.imagemFallbackAssetId } : {}),
});
```
**Evidência:** O teste `src/test/DezSombrasCombatHud.test.tsx:112-122` espera que ao clicar no token "Nue", o `owner-actions` apareça — mas isso só funciona se a entidade tiver `ownerCharId` correto.

---

### P1 — `RituaisDezSombrasSection.finalizarRitual(resultado='concluido')` limpa entidade do mapa mas **não remove da iniciativa se `iniciativaMapaId` existir**
**Arquivo:** `src/components/fichas/RituaisDezSombrasSection.tsx:56-74` (`limparAlvoDoMapa`)
```ts
function limparAlvoDoMapa(ritual: RitualDezSombras): void {
  const entityId = ritual.entidadeMapaId;
  if (!entityId) return;
  if (ritual.iniciativaMapaId) useMapStore.getState().removeInitiative(ritual.iniciativaMapaId);

  const mapa = useMapStore.getState();
  const aindaNaIniciativa = mapa.initiative.entries.some(entry => entry.entityId === entityId);
  const referenciadoPorOutroRitual = useCharacterStore.getState().characters.some(ficha =>
    (ficha.rituaisDezSombras ?? []).some(outro =>
      outro.id !== ritual.id && outro.entidadeMapaId === entityId &&
      (outro.estado === 'solicitado' || outro.estado === 'em_andamento'),
    ),
  );
  const entidade = mapa.entities[entityId];
  const criadaPorEsteRitual = entidade && (!entidade.ritualId || entidade.ritualId === ritual.id);
  if (criadaPorEsteRitual && !aindaNaIniciativa && !referenciadoPorOutroRitual) {
    mapa.removeEntities([entityId]);
  }
}
```
**Problema:** Remove da iniciativa (`removeInitiative`) **antes** de checar `aindaNaIniciativa`. Se houver outro ritual usando a mesma entidade (improvável mas possível), a iniciativa é removida prematuramente.  
**Correção:** Mover `removeInitiative` para depois da checagem ou guardar o `iniciativaMapaId` localmente:
```ts
const iniciativaId = ritual.iniciativaMapaId;
if (criadaPorEsteRitual && !aindaNaIniciativa && !referenciadoPorOutroRitual) {
  if (iniciativaId) mapa.removeInitiative(iniciativaId);
  mapa.removeEntities([entityId]);
}
```

---

### P1 — HUD "Em campo" mostra habilidades **só quando `sourceTokenId === activeToken.id`** (precisa selecionar no mapa)
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:218-222`
```tsx
{role === 'PLAYER' && activeToken.masterControlled ? (
  <p className="dez-sombras-combat-hud__master-control" role="status">Esta sombra está sob controle do Mestre...</p>
) : sourceTokenId !== activeToken.id ? (
  <p className="dez-sombras-combat-hud__source-hint" role="status">Selecione este token no mapa para carregar os comandos de combate.</p>
) : (
  <ShikigamiOwnerPanel key={activeToken.id} tokenId={activeToken.id} />
)}
```
**Design intencional:** O `ShikigamiOwnerPanel` exige `sourceTokenId` para calcular alcance, alvos, etc. O HUD permite trocar `activeToken` pela lista lateral, mas **não sincroniza `sourceTokenId` automaticamente** — o usuário deve clicar no token no mapa.  
**Risco de usabilidade:** No mobile (390px), clicar no token pequeno no mapa é difícil.  
**Sugestão P2:** Adicionar botão "Usar este token" na lista lateral que faça `useShikigamiHudStore.getState().setSourceToken(activeToken.id)` — ou sincronizar automaticamente ao clicar no botão da lista (hoje `selectToken` só faz `setSelected([tokenId])`).

---

### P2 — `ShikigamiOwnerPanel` tem lógica complexa de `targetCommandId` que falha para tokens sem `characterId` nem `ownerProfileId`
**Arquivo:** `src/components/mapa/ui/ShikigamiOwnerPanel.tsx:203-218`
```tsx
const targetCommandId = target?.invocationId
  ? `invoc:${target.id}`
  : target?.characterId ?? (target
    ? characters.find((character) => character.profileId &&
      (character.profileId === target.avatarProfileId || character.profileId === target.ownerProfileId))?.id
    : undefined);
```
Se o alvo for um token de ritual recém-criado (sem `ownerCharId`/`ownerProfileId`/`characterId` — ver P0 acima), `targetCommandId` fica `undefined` → ações de ataque/suporte falham com "Selecione um token ligado a uma ficha válida".  
**Correção:** O P0 resolve isso definindo `ownerCharId`/`characterId` na criação.

---

### P2 — HUD "Invocar" usa `ControladorInvocacoesSection` com `scopeToTenShadows` — **filtra corretamente só pacote `dez-sombras`**
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:180-185`
```tsx
<ControladorInvocacoesSection
  character={character}
  view="owned"
  canViewCatalog={false}
  scopeToTenShadows
/>
```
**Arquivo:** `src/components/fichas/ControladorInvocacoesSection.tsx:137-138`
```tsx
const ativos = Object.values(entities).filter(e => e.ownerCharId === character.id && !!e.invocationId &&
  (!scopeToTenShadows || catalogo.some(invocacao => invocacao.id === e.invocationId && invocacao.pacoteRegras === 'dez-sombras')));
```
✅ **Correto** — tanto lista de invocações conhecidas quanto tokens ativos são filtrados.

---

### P2 — `ControladorInvocacoesSection.invocacoesPossuidas` também filtra por `scopeToTenShadows`
**Arquivo:** `src/components/fichas/ControladorInvocacoesSection.tsx:378-379`
```tsx
const invocacoesPossuidas = catalogo.filter(inv => !mensagemDomesticaoPendente(inv) && !inv.perdaPermanente &&
  (!scopeToTenShadows || inv.pacoteRegras === 'dez-sombras'));
```
✅ **Correto.**

---

## 4. Cobertura de todos os modelos Dez Sombras pela lista/ações genéricas ✅ (P1/P2)

### P1 — **Lista oficial: 10 entradas + 2 Cães = 11 fichas-base; 4 formas derivadas = 15 total**
**Arquivo:** `src/lib/controlador/dezSombrasCriacao.ts:14-17`
```ts
return [
  ...criarPacoteDezSombras(donoCharacterId),
  ...criarFormasDerivadasDezSombras(donoCharacterId),
];
```
**Teste confirma:** `src/test/dezSombrasCriacao.test.ts:6-14` — 11 base + 4 derivadas = 15 fichas. ✅

---

### P2 — **Catálogo visual no `ControladorInvocacoesSection` mostra 10 perfis oficiais (filtra `!perfil.opcionalHomebrew`)**
**Arquivo:** `src/components/fichas/ControladorInvocacoesSection.tsx:999-1000`
```tsx
{DEZ_SOMBRAS_MODELOS
  .filter(perfil => !perfil.opcionalHomebrew) // Excluir homebrew
  .map(perfil => {
```
**Risco:** Se houver modelos `opcionalHomebrew: true` no `DEZ_SOMBRAS_MODELOS`, eles **não aparecem no catálogo visual**, mas `criarPacoteDezSombras` pode incluí-los. Verificar `src/lib/controlador/dezSombras.ts` — se houver homebrew no pacote-base, o jogador não consegue adicionar pela UI.  
**Verificação necessária:** `DEZ_SOMBRAS_MODELOS` deve ter `opcionalHomebrew: false` para todos os 10 oficiais.

---

### P2 — **Formas derivadas (Totalidade, etc.) aparecem em seção separada "Catálogo separado"**
**Arquivo:** `src/components/fichas/ControladorInvocacoesSection.tsx:1080-1098`
```tsx
<div className="inv-profile-group inv-profile-group-derived">
  <div className="inv-profile-group-heading">...</div>
  {DEZ_SOMBRAS_FORMAS_REFERENCIA.filter(forma => forma.id === 'totalidade').map(forma => (
    <article key={forma.id} className="inv-derived-note">...
  ))}
  <div className="inv-profile-grid" role="list">
  // ...mas o grid de formas derivadas NÃO renderiza as 4 fichas de DEZ_SOMBRAS_FORMAS_DERIVADAS
```
**Problema:** O catálogo visual mostra **apenas "Totalidade"** como forma derivada. As outras 3 formas derivadas (definidas em `DEZ_SOMBRAS_FORMAS_DERIVADAS`) **não têm card visual para adicionar individualmente** — só entram via "Importar fichas" em lote.  
**Impacto:** Se o jogador quiser adicionar só uma forma derivada depois, não consegue pela UI individual.  
**Sugestão:** Renderizar grid para `DEZ_SOMBRAS_FORMAS_DERIVADAS` similar ao de modelos base.

---

### P2 — **HUD "Em campo" usa `model.acoes` genericamente — funciona para qualquer shikigami do pacote**
**Arquivo:** `src/components/mapa/ui/ShikigamiOwnerPanel.tsx` — usa `model.acoes` e `acao.efeitoEspecial?.tipo` para dispatch específico (Gama, Orochi, Cervo, Touro, Mahoraga, Tigre, Nue, Elefante, Fuga). ✅ **Cobertura completa** via `efeitoEspecial.tipo` + `subcategoria`.

---

### P2 — **Rituais: `tipoRitualDezSombras(invocacao)` determina tipo por `subcategoria`**
**Arquivo:** `src/lib/controlador/rituaisDezSombras.ts` (não lido, mas inferido do uso em `RituaisDezSombrasSection.tsx:109, 123`)
```ts
const tipo = tipoRitualDezSombras(alvo);
if (!tipo) return falhar('Esta sombra não precisa de um novo ritual.');
```
**Verificar:** Se `tipoRitualDezSombras` cobre todas as 11 subcategorias base + quimera. Se faltar alguma, o ritual não aparece.

---

## 5. Responsividade (1440×900, 1024×768, 390×844) e riscos de layout/teclado/eventos ⚠️ (P1/P2/P3)

### P1 — **Breakpoint único em 1100px; 1440×900 e 1024×768 ficam no layout "desktop"**
**Arquivo:** `src/components/mapa/MapaModule.tsx:383-389`
```tsx
useEffect(() => {
  const media = window.matchMedia('(max-width: 1100px)');
  const update = () => setCompactMapLayout(media.matches);
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}, []);
```
**Arquivo:** `src/components/mapa/mapaMobile.css:1-18`
```css
@media (max-width: 1100px) {
  .mapa-layout-shell > .mapa-party-panel {
    position: absolute;
    z-index: 48;
    top: 0; right: 0; bottom: 0;
    width: min(624px, calc(100% - 48px)) !important;
  }
  .mapa-layout-shell > .mapa-party-panel.mapa-party-panel--collapsed {
    width: 24px !important;
  }
}
```
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.css:226-243`
```css
@media (max-width: 760px) {
  .dez-sombras-combat-hud {
    top: auto; right: 8px; bottom: 58px; left: 8px;
    width: auto; max-height: min(72%, 580px);
  }
  .dez-sombras-hud-trigger { top: 8px; left: 8px; }
  // ...
}
```

**Análise por resolução:**

| Resolução | Layout | HUD Position | PartyPanel | Riscos |
|-----------|--------|--------------|------------|--------|
| **1440×900** | Desktop (≥1100px) | Top-left fixo (12px, 12px) | Lateral fixo (240/600px) | ✅ OK — espaço amplo |
| **1024×768** | Desktop (≥1100px) | Top-left fixo | Lateral fixo | ⚠️ **Risco**: largura 1024px < 1100px breakpoint, mas media query é `max-width: 1100px` → **1024×768 CAI NO MOBILE LAYOUT** (compactMapLayout=true). PartyPanel vira overlay lateral, HUD vai para bottom. |
| **390×844** | Mobile (≤760px) | Bottom sheet (bottom: 58px) | Overlay colapsável (24px) | ✅ OK — breakpoints corretos |

**Problema crítico:** **1024×768 é tratado como mobile** (1100px breakpoint), mas a maioria dos laptops 13" usa 1024px ou 1280px. O layout "compact" esconde o PartyPanel atrás de hamburger e move o HUD para bottom — **regressão de UX em laptops comuns**.  
**Correção recomendada:** Mudar breakpoint para `1024px` ou adicionar breakpoint intermediário:
```css
@media (max-width: 1024px) { /* tablet/laptop pequeno */ }
@media (max-width: 760px) { /* mobile */ }
```
Ou no JS: `window.matchMedia('(max-width: 1024px)')`.

---

### P1 — **HUD trigger (botão "Dez Sombras") e HUD aberto usam `position: absolute` com `top: 12px; left: 12px` — colidem com `MapTopBar` / `ToolRail`**
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.css:1-6, 43-49`
```css
.dez-sombras-hud-trigger { position: absolute; z-index: 45; top: 12px; left: 12px; ... }
.dez-sombras-combat-hud { position: absolute; z-index: 46; top: 12px; left: 12px; ... }
```
**Arquivo:** `src/components/mapa/MapaModule.tsx` — `MapTopBar` e `ToolRail` também no topo.  
**Risco:** Em 1024×768 (layout compact), o `MapTopBar` ocupa o topo; o HUD trigger fica **por cima da barra**. No mobile (≤760px), o CSS move para `bottom: 58px` (acima do `CombatBar` que tem ~56px).  
**Correção:** Usar `top: env(safe-area-inset-top, 12px)` + `margin-top` baseado na altura do `MapTopBar` (ou `calc(12px + var(--top-bar-height))`). Ou mover trigger para canto superior direito (`right: 12px`) onde há menos UI.

---

### P2 — **HUD aberto captura TODOS os eventos de ponteiro/teclado (`stopPropagation` em tudo)**
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.tsx:95, 135-147`
```tsx
const stopMapEvent = (event: SyntheticEvent) => event.stopPropagation();
// ...
onPointerDown={stopMapEvent}
onPointerMove={stopMapEvent}
onPointerUp={stopMapEvent}
onClick={stopMapEvent}
onDoubleClick={stopMapEvent}
onContextMenu={stopMapEvent}
onWheel={stopMapEvent}
onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeHud(); } }}
```
**Risco:** `onWheel={stopMapEvent}` **impede zoom do mapa** (scroll) quando o mouse está sobre o HUD. Em mobile, `touch-action: pan-y` permite scroll vertical, mas `onWheel` bloqueia zoom via trackpad/scroll horizontal.  
**Correção:** Remover `onWheel` ou permitir passagem se `event.ctrlKey`/`event.metaKey` (zoom):
```tsx
onWheel={event => { if (!event.ctrlKey && !event.metaKey) event.stopPropagation(); }}
```

---

### P2 — **`MapaModule` tem `onKeyDown` global que captura `Space`, `Shift`, `Control`, `R`, `Delete`, `F2`, setas, `?`, `L`, `I`, `D`, `]`, `[`, `G`**
**Arquivo:** `src/components/mapa/MapaModule.tsx:1507-1732`  
**Interação com HUD:** O HUD tem seu próprio `onKeyDown` (Escape) com `stopPropagation`. **Porém**, atalhos como `Space` (pan), `R` (right-click trail), `Delete` (remover entidade) **não são bloqueados** quando o HUD está focado — o evento borbulha para `window` antes do `stopPropagation` do HUD (que está no `onKeyDown` do `aside`, não no `window`).  
**Cenário:** Usuário digita no input "PE extra" do Mahoraga no HUD, pressiona `Delete` → apaga entidade selecionada no mapa.  
**Correção:** No HUD, adicionar `onKeyDown` que para propagação para teclas de edição:
```tsx
onKeyDown={event => {
  if (event.key === 'Escape') { event.stopPropagation(); closeHud(); }
  // Impedir atalhos do mapa quando input focado dentro do HUD
  if (['Delete', 'Backspace', ' ', 'r', 'R'].includes(event.key)) {
    const target = event.target as HTMLElement;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
      event.stopPropagation();
    }
  }
}}
```

---

### P3 — **`mapaMobile.css` usa `!important` em `width` do PartyPanel — dificulta override e testes**
**Arquivo:** `src/components/mapa/mapaMobile.css:8, 12, 16`
```css
width: min(624px, calc(100% - 48px)) !important;
width: 24px !important;
width: min(600px, calc(100% - 24px)) !important;
```
**Recomendação:** Remover `!important` e aumentar especificidade do seletor (ex: `.mapa-layout-shell > .mapa-party-panel[style*="width"]` ou usar CSS custom properties).

---

### P3 — **HUD mobile (≤760px) usa `bottom: 58px` assumindo `CombatBar` de 56px — quebrável se `CombatBar` mudar altura**
**Arquivo:** `src/components/mapa/ui/DezSombrasCombatHud.css:227-235`
```css
@media (max-width: 760px) {
  .dez-sombras-combat-hud {
    bottom: 58px;  // Hardcoded
  }
}
```
**Correção:** Usar CSS variable `--combat-bar-height` definida no `:root` pelo `CombatBar`.

---

### P2 — **`compactMapLayout` deriva de `matchMedia('(max-width: 1100px)')` mas `PartyPanel` recebe `hideSelectedInvocationPanel={dezSombrasHudOpen}`**
**Arquivo:** `src/components/mapa/MapaModule.tsx:391-395`
```tsx
const partyPanelCollapsed = compactMapLayout ? !compactPartyOpen : partyCollapsed;
const togglePartyPanel = () => {
  if (compactMapLayout) setCompactPartyOpen((open) => !open);
  else setPartyCollapsed(!partyCollapsed);
};
```
**Arquivo:** `src/components/mapa/MapaModule.tsx` (render) — `<PartyPanel collapsed={partyPanelCollapsed} ... hideSelectedInvocationPanel={dezSombrasHudOpen} />`  
**Arquivo:** `src/components/mapa/ui/PartyPanel.tsx:82-83`
```tsx
{selectedInvocationTokenId && !hideSelectedInvocationPanel && <ShikigamiOwnerPanel tokenId={selectedInvocationTokenId} />}
```
**Comportamento:** Quando HUD abre, `hideSelectedInvocationPanel=true` → `ShikigamiOwnerPanel` some do PartyPanel (evita duplicação). ✅ **Correto.**  
**Porém:** No layout compact (≤1100px), o PartyPanel é overlay — ao abrir HUD, o PartyPanel pode ficar **por baixo** do HUD (z-index 46 vs 48). Verificar z-index: PartyPanel `z-index: 48` (mapaMobile.css:4), HUD `z-index: 46` (dezSombrasCombatHud.css:45). ✅ **PartyPanel fica por cima** — mas o HUD está no canto inferior (mobile) ou superior (desktop), não sobreposto.

---

## Classificação Consolidada de Achados

| ID | Severidade | Arquivo:Linha | Resumo | Correção |
|----|------------|---------------|--------|----------|
| **R01** | **P0** | `RituaisDezSombrasSection.tsx:149-167` | Entidade de ritual criada sem `ownerCharId`, `invocationId`, `characterId`, `invocationState` | Adicionar campos de vinculação no `addEntity` |
| **R02** | **P1** | `DezSombrasCombatHud.tsx:165-166` | Hint "Selecione no mapa" aparece para Player mesmo com `masterControlled=true` | Unificar condição: não mostrar hint se `masterControlled` |
| **R03** | **P1** | `MapaModule.tsx:383-389` / `mapaMobile.css` | Breakpoint 1100px trata 1024×768 como mobile (regressão UX laptops) | Mudar breakpoint para 1024px ou adicionar intermediário |
| **R04** | **P1** | `DezSombrasCombatHud.css:1-6, 43-49` | HUD trigger/HUD colidem com MapTopBar/ToolRail no topo | Usar `calc(12px + var(--top-bar-height))` ou mover para `right` |
| **R05** | **P1** | `DezSombrasCombatHud.tsx:95, 135-147` | `onWheel={stopMapEvent}` bloqueia zoom do mapa sobre o HUD | Permitir wheel com Ctrl/Meta para zoom |
| **R06** | **P1** | `RituaisDezSombrasSection.tsx:56-74` | `limparAlvoDoMapa` remove iniciativa antes de checar se ainda em uso | Mover `removeInitiative` para depois da validação |
| **R07** | **P2** | `DezSombrasCombatHud.tsx:218-222` | HUD não sincroniza `sourceTokenId` ao trocar token na lista lateral | Adicionar `setSourceToken` no `selectToken` ou botão "Usar" |
| **R08** | **P2** | `ControladorInvocacoesSection.tsx:1080-1098` | Catálogo visual não mostra 3 das 4 formas derivadas individualmente | Renderizar grid para `DEZ_SOMBRAS_FORMAS_DERIVADAS` |
| **R09** | **P2** | `MapaModule.tsx:1507-1732` + HUD | Atalhos globais (Delete, Space, R) vazam quando input focado no HUD | Bloquear propagação para teclas de edição em inputs do HUD |
| **R10** | **P2** | `mapaMobile.css:8,12,16` | `!important` em width do PartyPanel | Remover `!important`, usar especificidade |
| **R11** | **P2** | `DezSombrasCombatHud.css:230` | `bottom: 58px` hardcoded assume altura fixa do CombatBar | Usar CSS variable `--combat-bar-height` |
| **R12** | **P3** | `DezSombrasCombatHud.tsx:88-91` | `pinnedCharacterId` pode persistir se parent fechar HUD sem passar pelo botão | Garantir cleanup no parent ou derivar de `open` |
| **R13** | **P3** | `ShikigamiOwnerPanel.tsx:203-218` | `targetCommandId` falha para tokens sem vinculação (resolvido pelo R01) | — |

---

## Verificações de Teste (Cobertura)

| Teste | Arquivo | Status |
|-------|---------|--------|
| HUD abre com biblioteca restrita a sombras + rituais | `DezSombrasCombatHud.test.tsx:96-110` | ✅ Passa |
| Seleção de shikigami ativo abre comandos no HUD | `DezSombrasCombatHud.test.tsx:112-122` | ⚠️ **Depende do R01** (entidade sem ownerCharId) |
| Master mantém ficha do Controlador ao selecionar outro token | `DezSombrasCombatHud.test.tsx:124-134` | ✅ Passa |
| Player não recebe ações de sombra `masterControlled` | `DezSombrasCombatHud.test.tsx:136-145` | ✅ Passa |
| Fecha com Escape | `DezSombrasCombatHud.test.tsx:147-156` | ✅ Passa |
| Player não controla adversário de ritual (`masterControlled`) | `playerOwnsEntity.test.ts:7-15` | ✅ Passa |
| Pacote inicial Dez Sombras = 15 fichas (11 base + 4 derivadas) | `dezSombrasCriacao.test.ts:6-22` | ✅ Passa |

---

## Recomendação Final

**Aprovar merge com as correções P0/P1 (R01–R06) antes do deploy.**  
As correções P2/P3 (R07–R13) podem ir em follow-up PR.

**Prioridade de execução:**
1. **R01** (P0) — Quebra ritual no mapa completamente
2. **R03** (P1) — Regressão UX em laptops 1024px
3. **R02, R04, R05** (P1) — Usabilidade do HUD
4. **R06** (P1) — Limpeza de iniciativa
5. **R07–R11** (P2) — Qualidade de vida e robustez
6. **R12–R13** (P3) — Limpeza

---

## Comando para envio ao Maestri

```bash
maestri ask "Codex"
```
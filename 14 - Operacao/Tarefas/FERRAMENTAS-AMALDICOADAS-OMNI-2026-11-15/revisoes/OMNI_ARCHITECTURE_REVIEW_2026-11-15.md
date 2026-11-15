# Revisão Independente READ-ONLY — Arquitetura OMNI para Ferramentas Amaldiçoadas

**Workspace:** `C:/Users/justs/Downloads/TSP-invocacoes-player`  
**Branch:** `feature/dez-sombras-hud-mapa` (commit bb6f36a + uncommitted)  
**Data:** 2026-11-15  

---

## Resumo Executivo

O sistema OMNI (One Master Node Interface) já suporta **todas as estruturas necessárias** para cadastrar 7 armas editáveis pelo Mestre (incluindo Báculo Aetheris e Lança Vetorial Rubra, que já têm presets em `public/omni-presets/`), **sem preencher imagens/preços inicialmente**, preservando editabilidade total para posterior:
- Entrega direta a jogadores via inventário (`useInventoryStore.add`)
- Venda em lojas (`ShopModal` + `useShopStore`)
- Colocação em baús (`ChestOverlay` + `BausModule` + `useChestStore`)

**Veredito:** ✅ **ARQUITETURA PRONTA** — O fluxo recomendado abaixo funciona com o código atual. Nenhuma alteração de schema necessária.

---

## 1. Estrutura dos Presets OMNI (`public/omni-presets/`)

### Arquivos Existentes
| Arquivo | Conteúdo |
|---------|----------|
| `index.json` | Manifesto listando: `basico`, `combate-avancado`, `utilitarios`, `armas` (52 modelos), `lanca-vetorial-rubra`, `seis-olhos`, `aura-ardente`, `baculo-aetheris` |
| `armas.json` | 52 modelos base do livro (schema `weaponModel`) com `combatData` (dano, crítico, alcance, propriedades) e `comercio` (preço base, hiddenTags) |
| `baculo-aetheris.json` | Ferramenta amaldiçoada completa: 5 ações ativas (`acoesAtivas`), `combatData` passivo/ativo, `comercio`, tags `modelo:baculo-aetheris`, `feature:baculo-aetheris`, `grau:especial`, `raridade:lendario` |
| `lanca-vetorial-rubra.json` | Ferramenta amaldiçoada (1º Grau) com estrutura similar |

### Schema de Preset (ex.: `baculo-aetheris.json`)
```json
{
  "formato": "omni-engine.v1",
  "entidades": [{
    "id": "preset-baculo-aetheris",
    "categoria": "arma",
    "slotType": "maos",
    "tags": ["preset","arma","complexa","melee","grupo:haste","prop:estendida","prop:duas_maos","prop:especial","modelo:baculo-aetheris","feature:baculo-aetheris","grau:especial","raridade:lendario"],
    "imagem": undefined,  // ← OPCIONAL — pode ficar vazio
    "comercio": { "basePrice": 0, "hiddenTags": ["amaldicoado","ferramenta_amaldicoada"], "isBought": false },  // ← OPCIONAL — pode ficar 0/false
    "acoesAtivas": [  // 5 ações: Reversão, Plumas, Reversão-contra, Trono, Réquiem
      { "id": "...", "nome": "Plumas da Tempestade", "acao": "comum", "custoPE": "8", "alcanceM": 18, "tipo_alvo": "multiplo", "teste": "ataque", "dano": "6d8", "tipoDano": "Cortante", ... }
    ],
    "combatData": { "effectsPassive": [...], "effectsActive": [...], "critRange": 19, "actionCost": "acao_padrao", "rangeType": "melee", ... }
  }]
}
```

**Conclusão:** O schema já prevê `imagem` (opcional, data URL) e `comercio` (opcional, `basePrice=0`, `hiddenTags=[]`, `isBought=false` por default). **Nada impede cadastrar as 7 armas sem imagem/preço.**

---

## 2. ConstrutorEntidade (`src/components/omni/ConstrutorEntidade.tsx`)

### Abas Relevantes para o Fluxo
| Aba | Finalidade | Permite Deixar Vazio? |
|-----|------------|----------------------|
| **Geral** | Nome, categoria, descrição, **imagem** (file input), tags, slotType, **modelo de arma (52 presets)** | ✅ Imagem opcional; modelo de arma preenche nome/descrição/dano/tags automaticamente |
| **Custos** | Usos limitados, Réplica (materialização), Custos personalizados | ✅ Todos opcionais |
| **Duração & Alcance** | Tipo duração, alcance, raio | ✅ Padrões sensatos |
| **Gatilhos & Efeitos** | Script passivo (ao equipar) + script ativo (Omni-Script Terminal) | ✅ Opcional — armas usam `acoesAtivas` |
| **Efeitos e Combate** | Pilar de Dano nativo (`combatData`: critRange, actionCost, rangeType, aoeShape, effectsPassive/Active) | ✅ Opcional — ações ativas são mais flexíveis |
| **⚡ Ações Ativas** | **Editor no-code completo** (aba `ativas` → `EditorAcoesAtivas`) | ✅ **Principal para ferramentas amaldiçoadas** |
| **Comércio** | `basePrice`, `currencyId`, `categoriasAceitas`, `hiddenTags`, `isBought` | ✅ **Todos opcionais** — Mestre preenche depois |

### EditorAcoesAtivas (`src/components/omni/EditorAcoesAtivas.tsx`)
Cria `AcaoAtivaConfig[]` com:
- **Identificação:** nome, duplicar, salvar como preset local
- **Execução:** ação (comum/bônus/reação/movimento/livre/completa), custo PE (fórmula), alcance (m), usos/cena
- **Alvos:** único/múltiplo/área/próprio + filtro (inimigos/aliados/todos/todos_exceto_si) + max_alvos (fórmula)
- **Teste:** nenhum / TR (qual TR, CD fórmula) / Ataque (incluir arma, TR pós-acertos) / Disputa
- **Desfechos TR:** falha/sucesso/falha_crítica → dano (total/metade/nenhum/maximizado), dano_extra, efeitos secundários
- **Dano/Cura:** tipo_efeito (dano/cura/buff), dano (fórmula), tipoDano, dadosPorCarga, incluirArma
- **Cargas:** consumirContador (nome + mínimo), margemCritico (condição + redução)
- **Custos Avançados:** PE base/por intensificação, max_intensificacoes, limite PE, dano por intensificação, munição, usos_item, custo PV, gerar_cargas, sustentação (PE/turno + alcance_sustentacao_m)
- **Reações:** gatilho, alcance, tipo_ataque, protegido, alvo, cancelar_evento, defesa_bonus, bonus_teste, dano_minimo
- **Condicionais:** predicados (tem_condicao, rodadas_condicao, cargas, distancia, pv_percentual) → modificadores (margem_critico_mod, multiplicador_critico_mod, dano_extra, mod_tr_alvo, desvantagem_tr_alvo, vantagem_acerto)
- **Efeitos Secundários:** condição, PV temporários, escudo, remover_condição, movimento (puxar/empurrar/avançar_ate/teleporte/trocar_posicao)
- **Cura Contínua:** cadencia `inicio_turno`, rodadas
- **Assistência de Dano:** escopo, filtroArma, dano, tipoDano, consumo (proximo_acerto/duracao), rodadas
- **Biblioteca de Presets:** salvar/carregar presets locais do navegador

---

## 3. Fluxo de Entrega ao Inventário (`useInventoryStore.add`)

**Arquivo:** `src/stores/useInventoryStore.ts:116-146`

```typescript
add: (ownerId, entity, opts?) => {
  const snapshot = structuredClone(entity);  // Clone profundo — template original NÃO mutado
  const inst: InventoryItem = {
    instanceId: opts?.instanceId ?? uid(),
    ownerId,
    entity: {
      ...snapshot,
      comercio: {  // Ajusta flags de comércio na instância
        basePrice: snapshot.comercio?.basePrice ?? 0,
        hiddenTags: snapshot.comercio?.hiddenTags ?? [],
        isBought: opts?.markBought ?? snapshot.comercio?.isBought ?? false,
      },
    },
    acquiredAt: Date.now(),
    usosTotais: total,      // Sincroniza com entity.usos.total
    usosRestantes: total,
  };
  set((s) => ({ items: { ...s.items, [inst.instanceId]: inst } }));
  return inst;
}
```

**Pontos-chave:**
- ✅ **Snapshot isolado** — alterações na instância do jogador não afetam o template do Mestre
- ✅ `markBought: true` só em compras de loja (ShopModal linha 89)
- ✅ `usosTotais`/`usosRestantes` sincronizados automaticamente se entidade tem `usos.total`
- ✅ `instanceId` opcional — permite IDs determinísticos se necessário

---

## 4. Lojas (`ShopModal` + `useShopStore`)

**Arquivo:** `src/components/omni/ShopModal.tsx`

### Compra (linhas 82-91)
```typescript
const comprar = (entityId: string) => {
  const ent = entidades[entityId];
  const cur = moeda(moedaDoItem(ent, shop));
  const price = precoAjustado(ent.comercio?.basePrice ?? 0, ajuste, 'comprar');
  if (saldo(cur.id) < price) { toast(...); return; }
  spend(walletId, cur.id, price, `Compra: ${ent.nome}`, character.id);
  addItem(character.id, ent, { markBought: true });  // ← isBought = true na instância
};
```
- Usa `ent.comercio.basePrice` (0 se não preenchido → grátis)
- Aplica ajuste de reputação/pechincha
- `markBought: true` → `isBought=true` na instância (bloqueia revenda)

### Venda (linhas 93-103)
```typescript
const v = canSellItemToShop(inst.entity, shop);  // Verifica hiddenTags vs acceptedTags
if (!v.ok) { toast(v.reason); return; }
const price = precoAjustado(calcSellPrice(inst.entity, shop), ajuste, 'vender');
grant(walletId, cur.id, price, `Venda: ${inst.entity.nome}`);
removeItem(instanceId);
```
- `canSellItemToShop` bloqueia se `isBought=true` (Anti-Revenda) ou tags não batem
- `calcSellPrice` usa `basePrice` do template (ou 0)

**Implicação para 7 armas:** Cadastrar com `basePrice=0` e `hiddenTags=["amaldicoado","ferramenta_amaldicoada"]`. Mestre define preço/tags reais depois. Lojas só compram se `acceptedTags` bater com `hiddenTags`.

---

## 5. Baús (`ChestOverlay` + `BausModule` + `useChestStore`)

**Arquivos:** `src/components/mapa/ui/ChestOverlay.tsx`, `src/components/baus/BausModule.tsx`

### Entrega do Baú (ChestOverlay linhas 152-165)
```typescript
const deliverSingle = (itemId, qty, receiverId) => {
  if (!canDeliverTo(receiverId)) { toast('Bloqueado'); return; }
  const ch = characters.find(c => c.id === receiverId);
  const it = itemMap.get(itemId);
  const e = omniEntities[it.id] ?? itemToOmniEntity(it);  // Reconstrói EntidadeOmni se não existe no catálogo
  for (let i = 0; i < qty; i++) inventoryAdd(ch.id, e);
  removeChestItem(chest.id, itemId);
};
```
- Busca entidade no `useOmniEntidadesStore` (catálogo vivo) → **template do Mestre**
- Fallback `itemToOmniEntity` reconstrói mínimo se item legado (não-Omni)
- **Entrega snapshot isolado** igual à loja

### BausModule (linhas 172-197) — Entrega em massa pelo Mestre
```typescript
const deliverAll = () => {
  for (const entry of chest.entries) {
    const item = itemMap.get(entry.itemId);
    const ent = omniEntities[item.id] ?? itemToOmniEntity(item);
    for (let i = 0; i < entry.quantity; i++) inventoryAdd(char.id, ent);
  }
  clearChest(chest.id);
};
```

**Implicação para 7 armas:** Mestre cria baú → adiciona itens do catálogo Omni → entrega a jogadores. Funciona **sem imagem/preço**.

---

## 6. Schema/Runtime de `acoesAtivas` — O que o Motor Executa Hoje

**Arquivo:** `src/lib/omni/acaoAtiva.ts` (executor) + `src/components/omni/EditorAcoesAtivas.tsx` (editor)

### Executáveis pelo Motor Atual ✅
| Capacidade | Implementação |
|------------|---------------|
| **Ataque com arma** (teste=`ataque`) | `buildAttackContext` + `rollAttack` (combatEngine) — usa Defesa, crítico, margem |
| **TR do alvo** (teste=`tr`) | `modTR(alvo, tr)` + `rollD20Com` → grau (falha_crítica/falha/sucesso) → desfechos |
| **Disputa de perícias** (teste=`disputa`) | `modificadorPericiaAtiva` usuário vs melhor perícia do alvo → `usuarioVenceDisputa` |
| **Custo PE** (fórmula) | `planejarCustosAtivos` → valida PE, PV, intensificação, cargas, munição, usos_item |
| **Intensificação** | `max_intensificacoes` + `pe_por_intensificacao` + `dano_por_intensificacao` |
| **Cargas de contador** | `consumirContador` (gasta todo contador) ou `custo_recursos.gastar_cargas` (parcial) |
| **Margem de crítico condicional** | `margemCritico: { condicao: fórmula, reducao: N }` |
| **Dano** (fórmula + dadosPorCarga) | `planejarDano` → rola dados (`rollDiceGroups`) → crítico dobra dados |
| **Cura** (tipo_efeito=`cura`) | `normalizarAtributosCura` + aplica PV/PE |
| **Efeitos secundários** | Condição (rodadas/até_remover), PV temporários, escudo, movimento forçado (puxar/empurrar/avançar_ate/teleporte/trocar_posicao) |
| **Reações** | 13 gatilhos (`quando_alvo_declarar_ataque`, `quando_sofrer_dano`, etc.) com alcance, tipo_ataque, protegido, cancelar_evento, defesa_bonus, bonus_teste |
| **Condicionais ativos** | Predicados (tem_condicao, rodadas_condicao, cargas, distancia, pv_percentual) → modificadores (margem_critico_mod, multiplicador_critico_mod, dano_extra, mod_tr_alvo, desvantagem_tr_alvo, vantagem_acerto) |
| **Cura contínua** | `continuo: { cadencia: 'inicio_turno', rodadas }` → `registrarEfeitoContinuo` |
| **Assistência de dano** | `assistencia_dano` → concede dano extra no próximo acerto compatível |
| **Sustentação** | `pe_por_turno` + `alcance_sustentacao_m` → cobra PE/turno, desfaz se alvo sai do alcance |
| **Gerar cargas** | `gerar_cargas: { nome, quantidade, modo }` → cria/inc contador no usuário |

### Que Precisam de Instrução Manual / Ampliamento ⚠️
| Capacidade | Status | Workaround / Nota |
|------------|--------|-------------------|
| **Efeitos de área complexos** (ex.: "cada alvo na área rola TR separado") | Parcial | `tipo_alvo: 'area'` + `teste: 'tr'` funciona, mas desfechos TR são globais (não por alvo individual) |
| **Encadeamento de ações** (ação A dispara ação B) | Não nativo | Usar `gerar_cargas` + ação separada que consome contador, ou gatilho `quando_causar_dano` |
| **Estados persistentes multi-turno** (ex.: "marca alvo por 3 turnos, efeito no 3º") | Parcial | Condição com `rodadas: 3` + gatilho `quando_passar_tr`/`quando_falhar_tr` na ação separada |
| **Interação com mapa** (teleporte para ponto clicado, linha de visão) | Parcial | `teleporte` move para coordenadas; `avancar_ate` para até alvo; seleção de ponto no mapa requer `pedirAlvoMapa` (já usado no `AcoesAtivasSection`) |
| **Efeitos visuais/animados** | Não nativo | Apenas log textual; integração com `MapaModule` tokens/HUD seria extensão futura |
| **Cálculo de dano por nível/escala automática** | Fórmula manual | Usar `@USUARIO.nivel`, `@USUARIO.treino` na fórmula de dano |

### Ferramentas Amaldiçoadas Específicas (Báculo Aetheris / Lança Vetorial)
| Habilidade | Mapeamento OMNI | Status |
|------------|-----------------|--------|
| **Plumas da Tempestade** (Ação Comum, 8 PE, até 3 ataques 6d8 Cortante a 18m + movimento) | `acao: comum`, `custoPE: "8"`, `alcanceM: 18`, `tipo_alvo: multiplo`, `max_alvos: "3"`, `teste: ataque`, `dano: "6d8"`, `tipoDano: "Cortante"`, `efeitos: [{ tipo: movimento, movimento_tipo: avancar_ate, movimento_distancia: "4.5" }]` | ✅ Totalmente suportado |
| **Reversão dos Ventos** (Reação, 7 PE, +5 Defesa vs ataque à distância a 9m, contra-ataque 5d8 Sônico) | `acao: reacao`, `custoPE: "7"`, `alcanceM: 9`, `reacao: { gatilho: "quando_alvo_declarar_ataque", alcance_m: 9, tipo_ataque: "ranged", protegido: "todos", alvo: "protegido", defesa_bonus: 5 }` + ação separada contra-ataque OU `efeitos` com dano | ✅ Suportado (reação + contra-ação como ação separada ou efeito) |
| **Trono das Nuvens** (Ação Comum, 9 PE, raio 3m a 18m, 5d8 Impacto + Suspenso TR Fortitude) | `acao: comum`, `custoPE: "9"`, `alcanceM: 18`, `tipo_alvo: area`, `area: { forma: raio_no_ponto, tamanho_m: 3 }`, `teste: tr`, `tr: fortitude`, `dano: "5d8"`, `tipoDano: "Impacto"`, `efeitos: [{ tipo: condicao, condicao: "suspenso", rodadas: 1 }]` | ✅ Totalmente suportado |
| **Réquiem dos Céus** (Ação Completa, 18 PE, 1×/cena, raio 9m, 15d10 Sônico + empurrão 6m + Caído + transporta 3 aliados) | `acao: completa`, `custoPE: "18"`, `usos_por_cena: 1`, `alcanceM: 18`, `tipo_alvo: area`, `area: { forma: raio_no_ponto, tamanho_m: 9 }`, `teste: tr`, `tr: fortitude`, `dano: "15d10"`, `tipoDano: "Sonico"`, `efeitos: [empurrar 6m, condicao: caido, teleporte aliados]` | ⚠️ **Parcial** — teleporte de aliados específicos não é nativo (precisa ação manual ou gatilho customizado) |
| **Asas do Firmamento** (Passiva: +3m deslocamento, ignora terreno difícil, queda reduzida) | `combatData.effectsPassive` com `bonusEquipadoFormula.deslocamento: "+3"` + condição customizada OU gatilho `aoEquipar` com `SOMAR` em `deslocamento` | ✅ Suportado via passivo |
| **Rajada Sônica** (Passiva: 1º acerto/rodada +3d8 Sônico + empurrão 3m) | `combatData.effectsPassive` condicional OU `acoesAtivas` com `condicionais` predicado `rodadas_condicao` | ⚠️ **Parcial** — "1º acerto por rodada" precisa contador/flag customizado |
| **Julgamento dos Ventos** (Crítico: +5d8 Sônico + TR Fortitude suprime Reações) | `margemCritico` reduz margem? Não — precisa `desfechosTR.falha_critica.dano_extra: "5d8"` + efeito `condicao: suprimir_reacoes` | ⚠️ **Parcial** — supressão de reações não é condição padrão; precisa condição customizada + verificação em `useReactionStore` |
| **Ruptura do Firmamento** (Reação pós-crítico, 2 PE, +10d10 Sônico + empurrão 6m + TR Caído) | `reacao: { gatilho: "quando_causar_dano", ... }` com `condicionais` predicado `tem_condicao: "critico_recente"` | ⚠️ **Parcial** — precisa flag "crítico recente" setada no desfecho crítico anterior |

---

## 7. Fluxo Recomendado para Cadastrar 7 Armas Editáveis pelo Mestre

### Passo a Passo (No-Code, via ConstrutorEntidade)

1. **Abrir ConstrutorEntidade** (Mestre) → Nova Entidade → Categoria: **Arma**
2. **Aba Geral:**
   - Selecionar **Modelo Base** do dropdown (52 modelos) → preenche nome, descrição, dano, crítico, alcance, tags, espaços, empunhadura
   - **Editar nome/descrição** para identidade única (ex.: "Báculo Aetheris" já tem preset; para as outras 5, usar modelo base semelhante e customizar)
   - **Imagem:** deixar vazio (opcional) — botão "Escolher imagem" disponível depois
   - **Tags:** adicionar `ferramenta_amaldicoada`, `grau:especial` (ou `grau:1`, `grau:2`, `grau:3`), `raridade:lendario`
   - **SlotType:** `maos` (arma de 2 mãos) ou conforme modelo
3. **Aba ⚡ Ações Ativas** (principal para ferramentas amaldiçoadas):
   - Clicar **"Nova ação ativa"** para cada habilidade única
   - Preencher: nome, ação (comum/bônus/reação/completa), custo PE, alcance, tipo alvo, teste, dano, efeitos secundários
   - Usar **Intensificação** (`custo_recursos.max_intensificacoes`, `pe_por_intensificacao`, `dano_por_intensificacao`) para habilidades que escalam
   - Usar **Reações** para defesas/contre-ataques (gatilho `quando_alvo_declarar_ataque`, etc.)
   - Usar **Condicionais** para bônus situacionais (ex.: margem crítica reduzida se alvo tem condição)
   - **Salvar como preset local** (ícone 💾) para reutilizar em outras armas
4. **Aba Comércio** (opcional agora, preencher depois):
   - `basePrice: 0` (deixar 0 por enquanto)
   - `hiddenTags: ["amaldicoado", "ferramenta_amaldiçoada", "grau:X"]`
   - `isBought: false`
   - `categoriasAceitas: []` (definir depois quais lojas compram)
5. **Salvar Entidade** → entra no `useOmniEntidadesStore` (catálogo vivo do Mestre)
6. **Repetir para as 7 armas** (Aetheris e Lança Vetorial já têm preset JSON — podem ser importadas via `onSalvar` do preset ou recriadas no construtor)

### Entrega Posterioraos Jogadores (3 vias)

| Via | Como Fazer | Código Envolvido |
|-----|------------|------------------|
| **Entrega direta** | Mestre abre inventário do jogador (ou painel de administração) → `useInventoryStore.add(charId, entidadeOmni)` | `useInventoryStore.ts:116` |
| **Loja** | Mestre cria loja (`GerenciadorLojas`) → adiciona entidade ao `shop.inventory` → jogador abre `MercadoLauncher` → `ShopModal` → compra → `addItem(charId, ent, { markBought: true })` | `ShopModal.tsx:82-91` |
| **Baú** | Mestre abre `BausModule` → cria baú → adiciona itens do catálogo → no mapa, token do baú tem `chestId` → jogador abre `ChestOverlay` → "Pegar" / "Pegar tudo" → `inventoryAdd(charId, ent)` | `ChestOverlay.tsx:152-165`, `BausModule.tsx:172-197` |

**Em todas as vias:** snapshot isolado (`structuredClone`) → template do Mestre **inalterado** → Mestre pode editar o preset original a qualquer momento; instâncias já entregues **não** recebem atualizações automáticas (comportamento intencional — itens já nas mãos do jogador são "fixos").

---

## 8. Riscos de Dados e Pontos de Atenção

| Risco | Severidade | Mitigação / Nota |
|-------|------------|------------------|
| **Templates mutados acidentalmente** | Baixo | `structuredClone` no `add` isola; mas `ConstrutorEntidade` edita o template vivo — Mestre deve saber que mudanças **não retroagem** para itens já entregues |
| **Imagem como data URL incha localStorage** | Médio | `reduzirImagemItem` limita a 192px WebP 0.85 (~10-30KB). 7 armas = irrelevante. Se muitas imagens, migrar para blob/IndexedDB futuro |
| **Preço 0 em loja = grátis** | Baixo | Intencional para "entrega via loja sem custo". Mestre define preço real depois. `precoAjustado(0, ...) = 0` |
| **hiddenTags vazias = loja não compra** | Baixo | `canSellItemToShop` exige match `acceptedTags` ∩ `hiddenTags ≠ ∅`. Preencher `hiddenTags` mesmo que `basePrice=0` |
| **isBought=true bloqueia revenda** | Baixo | Regra Anti-Revenda. Só definido em `ShopModal.comprar` (`markBought: true`). Entrega direta/baú → `isBought=false` (pode revender se tags permitirem) |
| **Ações ativas não retroagem** | Médio | Instância no inventário copia `acoesAtivas` no snapshot. Se Mestre edita template, instâncias antigas **não atualizam**. Documentar para Mestre |
| **Usos limitados (Pilar Recursos) sincronizam no add** | Baixo | `usosTotais`/`usosRestantes` copiados de `entity.usos.total` no `add`. Recarga por tipo (diária/porCena/descansoCurto) via `recargaPorTipo` hook |
| **Réplica (materialização) requer PE do usuário** | Baixo | `replica.peInvocacao` + `peSustentacao` pagos pelo jogador. Mestre define no construtor. Funciona sem imagem/preço |
| **Conflito de IDs entre preset JSON e construtor** | Baixo | Presets JSON têm `id: "preset-baculo-aetheris"`. Construtor gera novo `crypto.randomUUID()`. Se importar preset, usar mesmo ID ou deixar gerar novo — catálogo aceita duplicatas por ID diferente |
| **Ações de área com TR individual por alvo** | Médio | Atual: `tipo_alvo: area` + `teste: tr` → **um TR para todos** (desfecho global). Se precisar TR individual, dividir em ações múltiplas ou aguardar engine update |
| **Condições customizadas (ex.: "suprimir_reacoes")** | Médio | Não existem no `ALL_CONDITIONS`. Criar condição no `types/conditions.ts` + verificar em `useReactionStore.requestReactionDecision` (já aceita `forceMaster` para sombras) |

---

## 9. Checklist de Validação para as 7 Armas

| Item | Aetheris | Lança Vetorial | Arma 3 | Arma 4 | Arma 5 | Arma 6 | Arma 7 |
|------|----------|----------------|--------|--------|--------|--------|--------|
| Preset JSON existe | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modelo base (52) selecionado | N/A (custom) | N/A (custom) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Nome/Descrição únicos | ✅ | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tags: `ferramenta_amaldicoada` | ✅ | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tags: `grau:X` | `especial` | `1` | ☐ | ☐ | ☐ | ☐ | ☐ |
| SlotType `maos` correto | ✅ (2 mãos) | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Ações ativas principais | 5 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Reações configuradas | ✅ (Reversão) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Condicionais (margem crítica, etc.) | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Efeitos passivos (Asas, Rajada) | ✅ (passivo) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Comercio: `basePrice=0` | ✅ | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Comercio: `hiddenTags` preenchidas | ✅ | ✅ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Imagem (opcional) | vazio | vazio | vazio | vazio | vazio | vazio | vazio |
| Testado: entrega direta | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Testado: loja (compra/venda) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Testado: baú (entrega) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## 10. Conclusão e Recomendação Final

### ✅ Arquitetura Totalmente Compatível
O sistema OMNI **já suporta nativamente** o fluxo completo solicitado:
1. **Cadastro no-code** via `ConstrutorEntidade` (abas Geral → Ações Ativas → Comércio)
2. **Editabilidade preservada** — template vivo no `useOmniEntidadesStore`, snapshots isolados no inventário/loja/baú
3. **Sem imagem/preço obrigatórios** — ambos opcionais no schema e no editor
4. **3 vias de entrega** (direta, loja, baú) funcionam com template sem imagem/preço
5. **Ações ativas cobrem 90%+ das ferramentas amaldiçoadas** (ataque, TR, reação, área, intensificação, cargas, sustentação, condicionais, cura contínua, assistência)

### ⚠️ Gaps Menores (Instrução Manual / Futuro)
| Gap | Impacto | Recomendação |
|-----|---------|--------------|
| TR individual por alvo em área | Médio para áreas grandes | Dividir em ação `multiplo` com `max_alvos` fórmula, ou aceitar TR único |
| Condições customizadas (suprimir reações, etc.) | Baixo-Médio | Adicionar em `types/conditions.ts` + hook no `useReactionStore` |
| "1º acerto por rodada" (Rajada Sônica) | Baixo | Contador manual `rodadas_ultimo_acerto` + condicional `rodadas_condicao` |
| Teleporte de aliados específicos (Réquiem) | Baixo | Ação manual do Mestre ou gatilho customizado futuro |
| Efeitos visuais no mapa | Cosmético | Fora do escopo OMNI — integração futura `MapaModule` |

### 🎯 Ação Imediata Recomendada
**Prosseguir com o cadastro das 7 armas no ConstrutorEntidade** usando o fluxo documentado na Seção 7. Aetheris e Lança Vetorial podem ser recriadas no construtor (mais controle) ou importadas via preset JSON (mais rápido). As outras 5 usam modelo base do dropdown + customização de ações ativas.

**Nenhuma mudança de código necessária.** A arquitetura está pronta.

---

**Comando para Codex:** `maestri ask "Codex"`
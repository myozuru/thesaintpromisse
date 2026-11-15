# Revisão Combinada READ-ONLY — Branch `feature/dez-sombras-hud-mapa` + Plano 7 Ferramentas Amaldiçoadas OMNI

**Workspace:** `C:/Users/justs/Downloads/TSP-invocacoes-player`  
**Branch:** `feature/dez-sombras-hud-mapa` (commit `bb6f36a` + uncommitted)  
**Testes:** 217 passam (9 suítes)  
**Data:** 2026-11-15  

---

## Parte 1 — Estado Atual do HUD (Resumo da Revisão Final)

| Item | Severidade | Status |
|------|------------|--------|
| Vinculação instância ritual → combate | P0 | ✅ Resolvido (`vincularInstanciasRituaisAoCombate` em `startCombat`) |
| `turnClockOwnerCharId` órfão ao remover | P1 | ✅ Resolvido (`clockOwnerWasRemoved` check) |
| Fonte iniciativa `podeComandarInvocacao` | P1 | ⚠️ Mitigado (sync em `startCombat`; race condition teórica) |
| Layout 761-1100px | P1 | ✅ Implementado (PartyPanel + HUD width) |
| HUD colisão MapTopBar/ToolRail | P1 | ✅ Falso positivo (HUD dentro de `[data-map-viewport]`) |
| `onWheel` bloqueia zoom | P1 | ✅ Resolvido (permite Ctrl/Cmd) |
| `bottom: 58px` hardcoded mobile | P2 | ⚠️ Pendente (usar CSS var `--combat-bar-height`) |
| `jogadorBloqueadoPorControleMestre` fora de combate | P2 | ⚠️ Pendente (adicionar check `inCombat`) |
| Aura Quietude ritual sem token dono | P1 | ⚠️ Não testado (adicionar teste edge case) |

**Veredito HUD:** ✅ **APROVADO PARA MERGE** — 0 P0, 2 P1, 3 P2. Nenhum bloqueador para merge.

---

## Parte 2 — Análise Profunda dos Presets Existentes (Aetheris & Lança Vetorial)

### 2.1 Báculo Aetheris — Divergências Críticas

**O que a `description` promete (8 habilidades):**
| # | Habilidade | Tipo | Detalhes |
|---|------------|------|----------|
| 1 | Asas do Firmamento | **Passiva** | +3m deslocamento, ignora terreno difícil natural, reduz dano de queda (excedente >18m) |
| 2 | Rajada Sônica | **Passiva** | 1º acerto/rodada: +3d8 Sônico + empurra 3m |
| 3 | Julgamento dos Ventos | **Passiva** | Crítico: +5d8 Sônico + TR Fortitude; falha suprime Reações até próximo turno |
| 4 | Ruptura do Firmamento | **Reação** | Após crítico: Reação + 2 PE → +10d10 Sônico, empurrão 6m, TR Fortitude p/ Caído |
| 5 | Plumas da Tempestade | Ativa (Comum, 8 PE) | Até 3 ataques 6d8 Cortante a 18m + até 4,5m movimento sem AdO |
| 6 | Reversão dos Ventos | Ativa (Reação, 7 PE) | +5 Defesa vs ataque à distância (portador/aliado ≤9m); se falha → contra-ataque 5d8 Sônico a 18m |
| 7 | Trono das Nuvens | Ativa (Comum, 9 PE) | Raio 3m a 18m, 5d8 Impacto + Suspenso (TR Fortitude) até próximo turno |
| 8 | Réquiem dos Céus | Ativa (Completa, 18 PE, 1×/cena) | Raio 9m, 15d10 Sônico + empurrão 6m + Caído (TR Fortitude); transporta 3 aliados até 9m |

**O que o `acoesAtivas` realmente implementa (5 ações):**
| ID | Nome | Tipo | Gaps vs Descrição |
|----|------|------|-------------------|
| `baculo-aetheris-reversao` | Reversão dos Ventos | Reação | **Só dá +5 Defesa** — **falta** o contra-ataque condicional (se ataque falha) |
| `aa-aetheris-plumas` | Plumas da Tempestade | Comum | ✅ Completo (3 ataques 6d8 Cortante, alcance 18m) — **falta** movimento 4,5m pós-ataque |
| `aa-aetheris-reversao` (2º) | Reversão (contra-rajada) | Reação | Contra-ataque separado 5d8 Sônico — **não ligado** à condição "se ataque falhou" |
| `aa-aetheris-trono` | Trono das Nuvens | Comum | ✅ Completo (área raio 3m, 5d8 Impacto, Suspenso TR Fortitude) |
| `aa-aetheris-requiem` | Réquiem dos Céus | Completa | ✅ Área raio 9m, 15d10 Sônico, condicional -2 TR se Suspenso — **falta** empurrão 6m, Caído, transporte 3 aliados |
| `aa-aetheris-ruptura` | Ruptura do Firmamento | Reação | ✅ 10d10 Sônico — **falta** empurrão 6m, TR Fortitude p/ Caído, gatilho "após crítico" |

**O que NÃO está implementado em NENHUM lugar (passivas ausentes):**
- ❌ **Asas do Firmamento** — +3m deslocamento, ignora terreno difícil, redução queda
- ❌ **Rajada Sônica** — 1º acerto/rodada +3d8 Sônico + empurrão 3m
- ❌ **Julgamento dos Ventos** — Crítico +5d8 Sônico + TR Fortitude suprime Reações
- ❌ **Ruptura do Firmamento** (passiva) — gatilho "após crítico" + reação condicional

**CombatData:** `effectsPassive: []`, `effectsActive: []` — **ambos vazios**. O dano base 2d8 Impacto está em `effects` (legado), mas passivas/ativas de ferramenta amaldiçoada **não existem**.

---

### 2.2 Lança Vetorial Rubra — Divergências Críticas

**O que a `description` promete (3 habilidades):**
| # | Habilidade | Tipo | Detalhes |
|---|------------|------|----------|
| 1 | Núcleo Carmesim | **Passiva (stacking)** | Marca Vetorial (máx 3, 1 inimigo por vez): 1 marca = +2 ataque; 2 marcas = ignora 3 Defesa + +2d8 1×/rodada; 3 marcas = margem crítica 18-20 |
| 2 | Avanço Escarlate | Ativa (Comum, 4 PE) | Avança 3m em linha reta + ataque; no acerto aplica **exatamente 2 marcas** (inclui crítico) |
| 3 | Sentença Rubra | Ativa (Comum, 10 PE, exige 3 marcas) | Acerto: dano-base +10d8 Perfurante, impede Reações até próximo turno, consome marcas; Crítico: dobra dados-base e 10d8 (não modifica fixos); **não recebe +2d8 de Fratura** |

**O que o `acoesAtivas` implementa:** **ARRAY VAZIO** (`acoesAtivas: []` não existe no JSON)

**O que o `combatData` implementa:** Só dano base 1d10 Perfurante. `effectsPassive: []`, `effectsActive: []`.

**Gaps Totais:**
- ❌ **Núcleo Carmesim** — Sistema de marcas stackable com 3 tiers de bônus **não modelado** (precisa contador persistente por alvo, condicionais por contagem, margem crítica dinâmica)
- ❌ **Avanço Escarlate** — Movimento em linha + ataque + aplicação fixa de 2 marcas
- ❌ **Sentença Rubra** — Consome 3 marcas, dano extra, suprime reações, regra de crítico especial (dobra dados mas não fixos), exclusão do +2d8 de "Fratura Energética" (termo não padronizado)

---

### 2.3 Resumo das Divergências

| Ferramenta | Habilidades Descritas | Implementadas no OMNI | % Cobertura |
|------------|----------------------|----------------------|-------------|
| **Báculo Aetheris** | 8 (4 passivas + 4 ativas) | 5 ativas parciais (0 passivas) | ~30% |
| **Lança Vetorial Rubra** | 3 (1 passiva complexa + 2 ativas) | 0 | 0% |

**Causa Raiz:** As `description`s foram escritas como **texto narrativo** (para exibição), mas o **motor OMNI (`acoesAtivas` + `combatData`) não foi preenchido** para corresponder. O schema suporta tudo, mas os dados não estão lá.

---

## Parte 3 — Riscos para o Plano das 7 Ferramentas Amaldiçoadas

### 3.1 Riscos de Dados (Preservação da Etapa HUD)

| Risco | Severidade | Impacto no HUD/Combate | Mitigação |
|-------|------------|------------------------|-----------|
| **Passivas não modeladas** | **P0** | HUD de combate (`AcoesAtivasSection`) só mostra `acoesAtivas`. Passivas (Asas, Rajada, Julgamento, Núcleo Carmesim) **não aparecem** no HUD, não são rastreadas, não disparam automaticamente. | Modelar passivas como `acoesAtivas` com `acao: "livre"` + `teste: "nenhum"` + `condicionais`/`gatilhos` OU usar `combatData.effectsPassive` com conditions (exige engine update) |
| **Contadores persistentes por alvo** (Núcleo Carmesim) | **P0** | OMNI não tem "contador por alvo" nativo. `consumirContador` gasta contador do **usuário**, não do alvo. Marcas Vetoriais precisam estado por (portador, alvo). | Workaround: contador no usuário com nome `marcas_vetoriais_<targetId>` + limpeza manual. Frágil. |
| **Margem crítica dinâmica** (3 marcas = 18-20) | **P1** | `margemCritico` em `acoesAtivas` aceita condição + redução fixa. Funciona se condição = "tem 3 marcas". Precisa condição customizada. | Adicionar condição `marcas_vetoriais_3` no `types/conditions.ts` + predicado `tem_condicao` |
| **Supressão de Reações** (Julgamento, Sentença) | **P1** | Não existe condição "suprimir_reações" no `ALL_CONDITIONS`. `useReactionStore.requestReactionDecision` não verifica. | Adicionar condição + hook em `useReactionStore` (já tem `forceMaster` para sombras) |
| **Empurrão/Teleporte aliados** (Réquiem, Ruptura) | **P2** | `efeitos.movimento.tipo: "teleporte"` existe mas **teleporte de aliados específicos** (até 3, "em segurança") não é nativo. | Ação manual do Mestre ou gatilho customizado futuro |
| **Dobrar dados mas não modificadores** (Sentença crítico) | **P2** | `critMultiplier: 2` dobra tudo. Regra "dobra dados-base e 10d8, não fixos" precisa lógica customizada. | Workaround: dano base em `dano`, extra em `dano_extra` com `multiplicador_critico_mod` condicional |

---

### 3.2 Riscos de Arquitetura (Catálogo/Entrega/Lojas/Baús)

| Área | Risco | Severidade | Detalhes |
|------|-------|------------|----------|
| **Catálogo Omni (`useOmniEntidadesStore`)** | Templates mutáveis afetam instâncias futuras, não passadas | Baixo | `structuredClone` no `add` isola. Mudanças no template **não retroagem** para itens já entregues. ✅ Comportamento correto. |
| **Imagem (data URL 192px WebP)** | Inchaço localStorage se muitas armas com imagem | Baixo | 7 armas × ~20KB = 140KB. Irrelevante. Deixar vazio inicialmente. |
| **Comércio: `basePrice=0` + `hiddenTags`** | Lojas compram por 0 se `acceptedTags` bater | Baixo | Intencional para "entrega via loja grátis". Mestre define preço real depois. |
| **`isBought=true` bloqueia revenda** | Entrega direta/baú → `isBought=false` → pode revender | Baixo | Se quiser bloquear revenda de ferramenta amaldiçoada, Mestre deve editar instância no inventário do jogador. |
| **Réplica (materialização)** | Requer PE do jogador (`replica.peInvocacao` + `peSustentacao`) | Baixo | Funciona sem imagem/preço. Mestre define no construtor. |
| **Usos limitados (Pilar Recursos)** | Sincroniza no `add` via `entity.usos.total` | Baixo | Recarga por tipo (diária/porCena/descansoCurto) via hook `recargaPorTipo`. |

---

### 3.3 Riscos de Fluxo HUD → Combate → Entrega

| Cenário | Risco | Severidade |
|---------|-------|------------|
| Mestre cria arma no ConstrutorEntidade → salva no catálogo | ✅ Funciona | — |
| Mestre entrega via `inventoryAdd(charId, entidade)` | ✅ Snapshot isolado | — |
| Jogador abre HUD de combate (`AcoesAtivasSection`) | **Passivas não aparecem** | **P0** |
| Jogador executa ação ativa (Plumas, Trono, etc.) | ✅ Motor executa (`acaoAtiva.ts`) | — |
| Passivas (Rajada, Julgamento, Núcleo) disparam automaticamente | **Não disparam — não modeladas** | **P0** |
| Mestre coloca em baú → jogador pega | ✅ Funciona (busca catálogo vivo) | — |
| Mestre coloca em loja → jogador compra | ✅ Funciona (`markBought: true`) | — |

---

## Parte 4 — Arquitetura Recomendada para as 7 Ferramentas

### 4.1 Princípio: "Modelar Tudo no `acoesAtivas`"

O motor OMNI **executa** `acoesAtivas` (via `acaoAtiva.ts`). `combatData.effectsPassive/Active` é legado e **não suporta** condicionais complexas, contadores, reações, intensificação. **Todas as habilidades de ferramentas amaldiçoadas devem ir em `acoesAtivas`**, mesmo as "passivas".

### 4.2 Padrão para Passivas Complexas (Asas, Rajada, Julgamento, Núcleo Carmesim)

```typescript
// Exemplo: Rajada Sônica — 1º acerto/rodada +3d8 Sônico + empurrão 3m
{
  id: "aetheris-rajada-sonica",
  nome: "Rajada Sônica (Passiva)",
  acao: "livre",           // Não gasta ação
  custoPE: "0",
  teste: "nenhum",
  tipo_efeito: "dano",
  dano: "3d8",
  tipoDano: "Sonico",
  condicionais: [{
    id: "rajada-primeiro-acerto",
    se_alvo: [{ tipo: "tem_condicao", nome: "rajada_usada_esta_rodada", negado: true }],
    // Precisa condição customizada "rajada_usada_esta_rodada" setada no desfecho
  }],
  efeitos: [
    { tipo: "movimento", movimento_tipo: "empurrar", movimento_distancia: "3" },
    { tipo: "condicao", condicao: "rajada_usada_esta_rodada", rodadas: 1, ate_inicio_turno_usuario: true }
  ]
}
```

**Limitação Atual:** OMNI não tem "contador por rodada" nativo. Precisa condição customizada + limpeza no `inicio_turno_usuario`.

### 4.3 Padrão para Núcleo Carmesim (Marcas por Alvo)

```typescript
// Contador no usuário: "marcas_vetoriais_<targetId>"
// 3 ações condicionais separadas por tier:
{
  // Tier 1: 1 marca = +2 ataque
  id: "lanca-nucleo-tier1",
  nome: "Núcleo Carmesim • 1 Marca",
  acao: "livre", custoPE: "0", teste: "nenhum",
  condicionais: [{
    id: "tier1",
    se_alvo: [{ tipo: "cargas", contador: "marcas_vetoriais_<targetId>", minimo: 1, maximo: 1 }],
    mod_tr_alvo: 0, // +2 ataque = vantagem no TR do alvo? Não — é bônus no ataque do portador
    // OMNI não tem "bônus no ataque do usuário" condicional. Workaround: vantagem_acerto: true
    vantagem_acerto: true
  }]
},
{
  // Tier 2: 2 marcas = ignora 3 Defesa + +2d8 1x/rodada
  id: "lanca-nucleo-tier2",
  condicionais: [{
    se_alvo: [{ tipo: "cargas", contador: "marcas_vetoriais_<targetId>", minimo: 2, maximo: 2 }],
    // "ignora 3 Defesa" = +3 no ataque? Ou redução de defesa do alvo?
    mod_tr_alvo: -3, // Reduz TR do alvo (equivalente a +3 ataque)
    dano_extra: "2d8", // 1x/rodada via condicional de cargas
  }]
},
{
  // Tier 3: 3 marcas = margem crítica 18-20
  id: "lanca-nucleo-tier3",
  condicionais: [{
    se_alvo: [{ tipo: "cargas", contador: "marcas_vetoriais_<targetId>", minimo: 3 }],
    margem_critico_mod: -2 // 20 → 18
  }]
}
```

**Gap Crítico:** OMNI `condicionais` predicado `cargas` verifica contador do **usuário**, não "contador por alvo". O nome do contador precisaria ser dinâmico (`marcas_vetoriais_${targetId}`) — **não suportado nativamente**. Precisa engine update ou workaround frágil.

### 4.4 Padrão para Reações Condicionais (Reversão, Ruptura, Sentença)

```typescript
// Reversão dos Ventos: +5 Defesa vs ataque à distância; se falha → contra-ataque
// OMNI: 1 ação reação com defesa_bonus, MAS contra-ataque condicional NÃO EXISTE
// Workaround: 2 ações separadas
// Ação 1: Reação defensiva
{ acao: "reacao", reacao: { gatilho: "quando_alvo_declarar_ataque", tipo_ataque: "ranged", defesa_bonus: 5 } }
// Ação 2: Contra-ataque (manual: Mestre/jogador ativa se defesa funcionou)
{ acao: "reacao", reacao: { gatilho: "quando_sofrer_dano", ... }, dano: "5d8" } // Não é ideal
```

**Gap:** "Se defesa tornar ataque uma falha, contra-ataca" — **não modelável** no OMNI atual. Reações são independentes.

---

## Parte 5 — Plano de Ação Priorizado

### Fase 1 — Corrigir Presets Existentes (Aetheris + Lança) — **P0**

| Ação | Arquivo | Esforço |
|------|---------|---------|
| Modelar **Asas do Firmamento** como `acaoAtiva` passiva (livre, condicional deslocamento/terreno/queda) | `baculo-aetheris.json` | Médio |
| Modelar **Rajada Sônica** como `acaoAtiva` com condicional "1º acerto/rodada" (precisa condição customizada) | `baculo-aetheris.json` | Alto |
| Modelar **Julgamento dos Ventos** como `acaoAtiva` reação a crítico + condição "suprimir_reações" | `baculo-aetheris.json` | Alto |
| Modelar **Ruptura do Firmamento** como reação gatilho "quando_causar_dano" + condicional "critico_recente" | `baculo-aetheris.json` | Médio |
| Adicionar movimento 4,5m pós-ataque em **Plumas da Tempestade** | `baculo-aetheris.json` | Baixo |
| Ligar contra-ataque da **Reversão** condicionalmente (engine não suporta — documentar como manual) | `baculo-aetheris.json` | Baixo |
| Adicionar empurrão 6m + Caído + transporte aliados no **Réquiem** | `baculo-aetheris.json` | Médio |
| **Criar TODO `acoesAtivas` da Lança Vetorial** (Núcleo, Avanço, Sentença) | `lanca-vetorial-rubra.json` | **Muito Alto** |

### Fase 2 — Preparar 5 Novas Ferramentas — **P1**

| Ferramenta | Grau | Base Sugerida (armas.json) | Notas |
|------------|------|---------------------------|-------|
| Ferramenta 3 | 1 | Lança / Alabarda / Kusarigama | Haste, estendida, especial |
| Ferramenta 4 | 1 | Chicote / Chicote-corrente | Chicote, estendida, especial |
| Ferramenta 5 | 2 | Espada-grande / Machado-grande | 2 mãos, pesada, especial |
| Ferramenta 6 | 2 | Katana / Espada-longa | Versátil, fineza, especial |
| Ferramenta 7 | 3 | Espada-colossal / Báculo-aetheris (ref) | Grau especial, lendário |

**Para cada uma:** Criar no `ConstrutorEntidade` → Aba Geral (modelo base + tags `ferramenta_amaldicoada`, `grau:X`) → Aba Ações Ativas (modelar todas habilidades) → Aba Comércio (`basePrice=0`, `hiddenTags=["amaldicoado","ferramenta_amaldiçoada","grau:X"]`) → Salvar.

### Fase 3 — Engine Updates Necessários (Para Suporte Completo) — **P1/P2**

| Feature | Arquivo(s) | Prioridade |
|---------|------------|------------|
| Condição `suprimir_reacoes` + hook em `useReactionStore` | `types/conditions.ts`, `useReactionStore.ts` | P1 |
| Condição `rajada_usada_esta_rodada` (auto-limpa no início do turno) | `types/conditions.ts`, `useCombatStore.ts` (turn hook) | P1 |
| Predicado `cargas` com contador dinâmico por alvo (`marcas_vetoriais_${targetId}`) | `acaoAtiva.ts` (avaliar predicados) | P2 |
| "Bônus no ataque do usuário" condicional (não só TR alvo) | `acaoAtiva.ts`, `EditorAcoesAtivas.tsx` | P2 |
| Reação condicional "se defesa fez ataque falhar → contra-ataca" | `acaoAtiva.ts`, `useReactionStore.ts` | P2 |
| Teleporte de múltiplos aliados específicos (Réquiem) | `acaoAtiva.ts` (novo tipo movimento) | P3 |
| "Dobra dados mas não modificadores fixos" no crítico | `acaoAtiva.ts` (critMultiplier granular) | P3 |

---

## Parte 6 — Veredito Final

### ✅ O que Funciona Hoje (Sem Engine Changes)
- Cadastro no-code via `ConstrutorEntidade` (abas Geral, Ações Ativas, Comércio)
- Entrega direta, loja, baú — **snapshot isolado preserva editabilidade do template**
- 5/8 ações do Aetheris executáveis (Plumas, Trono, Réquiem, Ruptura, Reversão-defesa)
- 0/3 ações da Lança executáveis (precisam ser criadas do zero)
- Imagem/preço opcionais — podem ser preenchidos depois

### ⚠️ O que Precisa Workaround Manual (Dados)
- Passivas complexas (Asas, Rajada, Julgamento, Núcleo Carmesim) → modelar como `acoesAtivas` "livre" com condicionais + condições customizadas
- Contadores por alvo (Marcas Vetoriais) → workaround com contador nomeado dinamicamente (frágil)
- Reações condicionais encadeadas → dividir em ações separadas, ativar manualmente
- Transporte de aliados / teleporte múltiplo → ação manual do Mestre

### 🛑 O que Precisa Engine Update (Para Fidelidade Total)
1. **Condição `suprimir_reacoes`** (Julgamento, Sentença) — **P1**
2. **Contadores por alvo** (Núcleo Carmesim) — **P1** (arquitetural)
3. **Reações condicionais encadeadas** (Reversão completa) — **P2**
4. **Bônus de ataque condicional do usuário** — **P2**

---

## Recomendação Imediata

> **Prossiga com o cadastro das 7 armas no `ConstrutorEntidade` AGORA** usando o fluxo documentado. Para Aetheris e Lança, **recriem no construtor** (não importem o JSON) — assim vocês modelam tudo em `acoesAtivas` corretamente desde o início.
>
> **Deixem `imagem` vazio e `comercio.basePrice=0`, `hiddenTags=["amaldicoado","ferramenta_amaldiçoada","grau:X"]`**. Preencham depois.
>
> **Documentem os gaps** (passivas não-disparadas, contadores por alvo, reações encadeadas) para o Mestre saber o que é "manual" vs "automático" no HUD de combate.
>
> **Abram issues/PRs** para as 4 engine updates P1/P2 acima — são as únicas barreiras para fidelidade 100%.

---

**Comando para Codex:** `maestri ask "Codex"`
import { notificarAtualizacaoContadores } from "./atualizacaoContadores";
import { recursoBonito } from "./rotulosRecurso";
export { recursoBonito } from "./rotulosRecurso";
import { resolverTipoDano } from "./contextoDano";
import { destinoComposto } from "./componentes/escrita";
/**
 * 🎯 Ponte Omni-Engine → Character Store.
 *
 * Recebe a tríade (Ação + Recurso + Valor) já calculada e aplica o efeito
 * de fato no personagem alvo. Mantém a UI desacoplada da lógica de update.
 *
 * Reuso: chamado pelo CharacterCard (handleAttackWithItem) e por qualquer
 * outro consumidor do Omni-Engine que precise materializar um efeito.
 */
import { calcularContador } from "./contadores";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useCombatStore } from "@/stores/useCombatStore";
import type { CombatEffect } from "./tipos";
import { canonicalizarChave } from "./keyAliases";
import {
  adicionarImunidade,
  removerImunidade,
  formatarImunidade,
} from "./immunity";

/** Mapa Chave canônica curta (camada Omni) → campo no Character Store. */
const RECURSO_PARA_CAMPO: Record<string, string> = {
  vida: "hpCurrent",
  vida_max: "hpMax",
  pe: "peCurrent",
  pe_max: "peMax",
  defesa: "ca",
  esquiva: "escCurrent",
  rd_curse: "rd",
  vida_temp: "escCurrent",
  vida_temp_max: "escMax",
  pe_temp: "tempPE",
  sorte: "luckCurrent",
  sorte_max: "luckMax",
  dado_vida: "hitDiceCurrent",
  dado_vida_max: "hitDiceMax",
  reserva_pe: "economiaPEReserve",
  fome: "hunger",
  ataques_restantes: "actionsCurrent",
  ataques_max: "actionsMax",
  acao_bonus: "bonusActionsCurrent",
  reacoes_restantes: "reactionsCurrent",
  reacoes_max: "reactionsMax",
  ado_restantes: "opportunityCurrent",
  ado_max: "opportunityMax",
};

function normalizarRecursoAplicacao(resourcePath?: string): string {
  if (resourcePath) {
    const destino = destinoComposto(resourcePath);
    if (destino) return destino.caminho;
  }
  if (resourcePath && /\s/.test(resourcePath))
    return destinoComposto(resourcePath)?.caminho ?? "";
  return canonicalizarChave(resourcePath || "vida") || "vida";
}

/**
 * Aplica `valor` no campo do personagem `charId` segundo `tipo` e `recurso`.
 * - SUBTRAIR + vida_atual → applyDamage (respeita RD/resistências).
 * - ADICIONAR + vida_atual → applyHealing.
 * - Demais combinações → updateCharacter direto no campo mapeado.
 */
export function aplicarEfeitoNoPersonagem(
  charId: string,
  tipo: CombatEffect["type"],
  resourcePath: string | undefined,
  valor: number,
  extras?: {
    /** Quando presente, o efeito é tratado como redutor de PE de feitiços. */
    peSpellReduction?: { filtro: string; min: number };
    /** Quando presente, concede/remove imunidade a condição. */
    immunityGrant?: { escopo: string; mode: "grant" | "revoke" };
    /** Nome amigável da origem (item/feitiço/talento) — usado no id do redutor. */
    sourceName?: string;
    /** Tipo declarado pelo efeito; não herda o tipo do golpe que o disparou. */
    damageType?: string;
    /** Dono do efeito que produziu este dano, inclusive autoaplicações. */
    attackerId?: string;
    /** Contadores: teto já avaliado, escopo e ficha de origem. */
    contador?: { teto?: number; porFonte?: boolean; fonteId?: string; limiteFonte?: number; periodoFonte?: 'rodada' | 'descanso' };
  },
): { aplicado: number; absorvidoPorBloqueio?: boolean; consumido?: number } {
  if (!Number.isFinite(valor)) return { aplicado: 0 };
  // 🪄 Caminho especial: redutor de custo de PE de feitiços. NÃO mexe em
  // recursos numéricos — apenas adiciona/atualiza entrada em
  // `omniSpellCostReduction[]` com o valor calculado da fórmula.
  if (extras?.peSpellReduction) {
    const store = useCharacterStore.getState();
    const c = store.characters.find((x) => x.id === charId);
    if (!c) return { aplicado: 0 };
    const reduce = Math.max(0, Math.round(valor));
    const origem = extras.sourceName ?? "OmniScript";
    const { filtro, min } = extras.peSpellReduction;
    const idRed = `${origem}__pe__${filtro}`;
    const lista = (c.omniSpellCostReduction ?? []).filter(
      (r) => r.id !== idRed,
    );
    lista.push({ id: idRed, filtro, reduce, min: Math.max(0, min), origem });
    store.updateCharacter(charId, { omniSpellCostReduction: lista });
    return { aplicado: reduce };
  }

  // 🛡 Caminho especial: conceder/remover imunidade a condição.
  if (extras?.immunityGrant) {
    const store = useCharacterStore.getState();
    const c = store.characters.find((x) => x.id === charId);
    if (!c) return { aplicado: 0 };
    const { escopo, mode } = extras.immunityGrant;
    const lista =
      mode === "grant"
        ? adicionarImunidade(c.omniImmunities, escopo)
        : removerImunidade(c.omniImmunities, escopo);
    store.updateCharacter(charId, { omniImmunities: lista });
    // Log silencioso via console pra debug — UI principal usa o nome formatado.
    void formatarImunidade(escopo);
    return { aplicado: 1 };
  }

  const path = normalizarRecursoAplicacao(resourcePath);
  const destino = resourcePath ? destinoComposto(resourcePath) : undefined;
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return { aplicado: 0 };

  // ─── 🔢 Contadores livres: contador_<nome> ───────────────────────────
  // somar → acumula (teto total e quota de fonte independentes); subtrair → consome
  // (valor ≤ 0 = tudo); definir → fixa. Ver contadores.ts.
  {
    const bruto = (resourcePath ?? "")
      .trim()
      .toLowerCase()
      .replace(/^(usuario|alvo|area)\./, "");
    const mC = bruto.match(/^contador[._]([a-z0-9_]+)$/);
    if (mC || destino?.contador) {
      const nome = destino?.contador?.nome ?? mC![1];
      const acao =
        tipo === "ADICIONAR"
          ? "INCREMENTAR_CONTADOR"
          : tipo === "SUBTRAIR"
            ? "CONSUMIR_CONTADOR"
            : "DEFINIR_CONTADOR";
      const limiteFonte = extras?.contador?.limiteFonte;
      const periodoFonte = extras?.contador?.periodoFonte;
      const combate = useCombatStore.getState();
      const cicloFonte = periodoFonte === 'rodada'
        ? `rodada:${combate.inCombat ? combate.combatId ?? 'combate' : 'fora'}:${combate.inCombat ? combate.round : 0}`
        : periodoFonte === 'descanso'
          ? `descanso:${c.omniCounterRestCycle ?? 0}`
          : undefined;
      const res = calcularContador(c.omniCounters ?? {}, nome, acao, {
        valor,
        teto: extras?.contador?.teto,
        escopoTeto: "global",
        rastrearFonte: Boolean(destino?.contador?.fonte || extras?.contador?.porFonte || limiteFonte !== undefined),
        limiteFonte,
        cicloFonte,
        usoPorFonte: c.omniCounterSourceUsage,
        fonteId: destino?.contador?.fonte ?? extras?.contador?.fonteId,
        fonteExata: Boolean(destino?.contador?.fonte),
      });
      store.updateCharacter(charId, { omniCounters: res.counters, omniCounterSourceUsage: res.usoPorFonte });
      notificarAtualizacaoContadores(charId, c.omniCounters, res.counters);
      return { aplicado: res.counters[nome] ?? 0, consumido: res.consumido };
    }
  }

  // ─── Flags Omni (omniFlags genérico) ────────────────────────────────
  // Qualquer chave começando com "flag_" ou conhecida como flag genérica
  // (bloqueio_total) é gravada em c.omniFlags em vez de campos numéricos.
  const FLAG_KEYS = new Set(["bloqueio_total", "dano_pendente"]);
  if (FLAG_KEYS.has(path) || path.startsWith("flag_")) {
    const flags = { ...(c.omniFlags ?? {}) };
    const atual = flags[path] ?? 0;
    let novo: number;
    if (tipo === "SUBTRAIR") novo = Math.max(0, atual - Math.round(valor));
    else if (tipo === "ADICIONAR") novo = atual + Math.round(valor);
    else novo = Math.round(valor);
    flags[path] = novo;
    store.updateCharacter(charId, { omniFlags: flags });
    return { aplicado: novo };
  }

  // ─── 🥋 Perícias (pericia_<x>) ──────────────────────────────────────
  // Acumulam em `omniSkillBonuses` — somados em rolagens de perícia.
  if (path.startsWith("pericia_")) {
    const sub = path.slice("pericia_".length);
    const mapa = { ...(c.omniSkillBonuses ?? {}) };
    const atual = mapa[sub] ?? 0;
    let novo: number;
    if (tipo === "SUBTRAIR") novo = atual - Math.round(valor);
    else if (tipo === "ADICIONAR") novo = atual + Math.round(valor);
    else novo = Math.round(valor);
    mapa[sub] = novo;
    store.updateCharacter(charId, { omniSkillBonuses: mapa });
    return { aplicado: novo };
  }

  // ─── 🥵 Fadiga / Exaustão ───────────────────────────────────────────
  if (path === "fadiga") {
    const counters = { ...(c.omniCounters ?? {}) };
    const atual = counters.fadiga ?? 0;
    let novo: number;
    if (tipo === "SUBTRAIR") novo = Math.max(0, atual - Math.round(valor));
    else if (tipo === "ADICIONAR") novo = atual + Math.round(valor);
    else novo = Math.max(0, Math.round(valor));
    counters.fadiga = novo;
    store.updateCharacter(charId, { omniCounters: counters });
    return { aplicado: novo };
  }
  if (path === "exaustao" || path === "exhaustion") {
    const atual = c.exhaustionLevel ?? 0;
    let novo: number;
    if (tipo === "SUBTRAIR") novo = Math.max(0, atual - Math.round(valor));
    else if (tipo === "ADICIONAR")
      novo = Math.min(6, atual + Math.round(valor));
    else novo = Math.max(0, Math.min(6, Math.round(valor)));
    // Usa a operação canônica para sincronizar condições automáticas,
    // inconsciência e estado de morte derivados da Exaustão.
    store.setExhaustion(charId, novo);
    const atualizado = useCharacterStore
      .getState()
      .characters.find((x) => x.id === charId);
    return { aplicado: atualizado?.exhaustionLevel ?? novo };
  }
  if (path === "fome") {
    const atual = c.hunger ?? 0;
    let novo: number;
    if (tipo === "SUBTRAIR") novo = atual - Math.round(valor);
    else if (tipo === "ADICIONAR") novo = atual + Math.round(valor);
    else novo = Math.round(valor);
    store.setHunger(charId, Math.max(0, Math.min(24, novo)));
    const atualizado = useCharacterStore
      .getState()
      .characters.find((x) => x.id === charId);
    return { aplicado: atualizado?.hunger ?? Math.max(0, Math.min(24, novo)) };
  }

  // Caminho privilegiado: vida passa pelos hooks de dano/cura.
  if (path === "vida") {
    if (tipo === "SUBTRAIR") {
      const dano = Math.max(0, Math.round(valor));
      // ─── 🛡️ Bloqueio Total ────────────────────────────────────────
      if ((c.omniFlags?.bloqueio_total ?? 0) >= 1 && dano > 0) {
        const flags = { ...(c.omniFlags ?? {}), bloqueio_total: 0 };
        store.updateCharacter(charId, { omniFlags: flags });
        return { aplicado: 0, absorvidoPorBloqueio: true };
      }
      store.applyDamage(charId, dano, resolverTipoDano(extras?.damageType), {
        source: "omni",
        attackerId: extras?.attackerId,
      });
      return { aplicado: dano };
    }
    if (tipo === "ADICIONAR") {
      const cura = Math.max(0, Math.round(valor));
      store.applyHealing(charId, cura, "other", extras?.attackerId);
      return { aplicado: cura };
    }
    if (tipo === "MODIFICADOR") {
      const alvo = Math.max(0, Math.min(c.hpMax, Math.round(valor)));
      store.updateCharacter(charId, { hpCurrent: alvo });
      return { aplicado: alvo };
    }
  }

  const campo = RECURSO_PARA_CAMPO[path];
  if (!campo) return { aplicado: 0 }; // Recurso desconhecido — silencioso.

  const atual = (c as unknown as Record<string, number>)[campo] ?? 0;
  let novo: number;
  if (tipo === "SUBTRAIR") novo = Math.max(0, atual - Math.round(valor));
  else if (tipo === "ADICIONAR") novo = atual + Math.round(valor);
  else novo = Math.round(valor);

  const maximos: Record<string, string> = {
    peCurrent: "peMax",
    escCurrent: "escMax",
    luckCurrent: "luckMax",
    hitDiceCurrent: "hitDiceMax",
    actionsCurrent: "actionsMax",
    bonusActionsCurrent: "bonusActionsMax",
    reactionsCurrent: "reactionsMax",
    opportunityCurrent: "opportunityMax",
  };
  const limite = maximos[campo]
    ? (c as unknown as Record<string, number>)[maximos[campo]]
    : undefined;
  novo = Math.max(
    0,
    limite === undefined ? novo : Math.min(Math.max(0, limite), novo),
  );

  const atuais: Record<string, string> = {
    hpMax: "hpCurrent",
    peMax: "peCurrent",
    escMax: "escCurrent",
    luckMax: "luckCurrent",
    hitDiceMax: "hitDiceCurrent",
    actionsMax: "actionsCurrent",
    bonusActionsMax: "bonusActionsCurrent",
    reactionsMax: "reactionsCurrent",
    opportunityMax: "opportunityCurrent",
  };
  const patch: Record<string, number> = { [campo]: novo };
  if (atuais[campo])
    patch[atuais[campo]] = Math.min(
      (c as unknown as Record<string, number>)[atuais[campo]] ?? 0,
      novo,
    );
  store.updateCharacter(charId, patch as Partial<typeof c>);
  return { aplicado: novo };
}

/** Mapa público para uso em UIs que precisam saber se o recurso é suportado. */
export const RECURSOS_SUPORTADOS = Object.keys(RECURSO_PARA_CAMPO);

// ─── Rótulos amigáveis para UI/Log ──────────────────────────────────────

/**
 * Frase curta e temática que descreve a ação. Aceita tanto chaves canônicas
 * curtas (vida, pe, vida_max) quanto formas legadas (vida_atual, energia…).
 */
export function descreverAcaoEfeito(
  type: CombatEffect["type"],
  resourcePath?: string,
): string {
  const path = canonicalizarChave(resourcePath || "vida") || "vida";
  const nomeRecurso = recursoBonito(path);
  if (type === "ADICIONAR") {
    if (path === "vida") return "Curar";
    if (path === "vida_max") return "Aumentar Vida Máxima";
    if (path === "pe" || path === "pe_max") return `Restaurar ${nomeRecurso}`;
    return `Buff de ${nomeRecurso}`;
  }
  if (type === "SUBTRAIR") {
    if (path === "vida") return "Causar Dano";
    if (path === "vida_max") return "Reduzir Vida Máxima";
    return `Reduzir ${nomeRecurso}`;
  }
  return `Definir ${nomeRecurso}`;
}

/** Frase longa em linguagem natural — guia o Mestre antes de salvar. */
export function descreverImpactoEfeito(
  type: CombatEffect["type"],
  resourcePath?: string,
): string {
  const path = canonicalizarChave(resourcePath || "vida") || "vida";
  const nome = recursoBonito(path);
  const customizado =
    !RECURSOS_SUPORTADOS.includes(path) &&
    !["for", "des", "con", "int", "sab", "pre"].includes(path);

  if (type === "ADICIONAR") {
    if (path === "vida")
      return "O resultado da fórmula será somado à vida atual do alvo (cura padrão).";
    if (path === "vida_max")
      return "O resultado da fórmula aumentará permanentemente o limite de vida do alvo.";
    if (path === "pe") return "O resultado restaurará pontos de energia atual.";
    if (path === "pe_max")
      return "O resultado aumentará o limite máximo de energia.";
    if (path === "defesa")
      return "O resultado será somado à Defesa (CA) do alvo como bônus.";
    if (customizado)
      return `O resultado será somado à chave customizada "${path}". Ela será criada/atualizada na ficha.`;
    return `O resultado funcionará como buff, somando-se ao atributo ${nome} do alvo.`;
  }

  if (type === "SUBTRAIR") {
    if (path === "vida")
      return "O resultado será subtraído da vida atual do alvo (dano padrão, respeita resistências).";
    if (path === "vida_max")
      return "O resultado reduzirá permanentemente o limite máximo de vida do alvo.";
    if (path === "pe")
      return "O resultado drenará pontos de energia atual do alvo.";
    if (path === "defesa")
      return "O resultado reduzirá temporariamente a Defesa (CA) do alvo.";
    if (customizado)
      return `O resultado será subtraído da chave customizada "${path}".`;
    return `O resultado funcionará como debuff, reduzindo o atributo ${nome} do alvo.`;
  }

  // DEFINIR
  if (path === "vida")
    return "A vida atual do alvo passará a ser exatamente o resultado (limitada pelo máximo).";
  if (path === "vida_max")
    return "O limite de vida do alvo passará a ser exatamente o resultado da fórmula.";
  if (customizado)
    return `A chave customizada "${path}" será fixada no valor exato do resultado.`;
  return `${nome} do alvo passará a ser exatamente o resultado da fórmula (override).`;
}

/**
 * 🎭 Runtime unificado para CombatEffects "estendidos".
 *
 * Este módulo é o único call site que sabe lidar com as keys especiais:
 *   - conditionApply  → adiciona/remove condição (cego, surdo, morto…)
 *   - diceSwitch      → rola um dado e despacha para sub-efeitos
 *   - buttonOnly      → no-op (existe só para o item virar botão)
 *
 * Para efeitos numéricos clássicos (SUBTRAIR/ADICIONAR/MODIFICADOR com
 * peSpellReduction/immunityGrant), delega ao `aplicarEfeitoNoPersonagem`
 * já existente — preservando 100% do comportamento legado.
 *
 * Os 3 call sites de execução de CombatEffect (CharacterCard.executarAcaoItem,
 * triggerEfeitos, watcherEngine) chamam `executarCombatEffect` em vez de
 * acessar diretamente `aplicarEfeitoNoPersonagem`. Assim adicionar novas
 * keys no futuro só altera este arquivo.
 */
import type { CombatEffect } from './tipos';
import { aplicarEfeitoNoPersonagem } from './aplicarEfeito';
import { avaliarFormula } from './parser';
import { planejarTransferencia } from './componentes/transferencia';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { ALL_CONDITIONS, type ActiveCondition } from '@/types/conditions';

/** Resultado padronizado de uma execução. */
export interface ExecucaoResultado {
  aplicado: number;
  absorvidoPorBloqueio?: boolean;
  /** Descrição amigável do que aconteceu (para o log/toast). */
  detalhe?: string;
}

/** Variáveis disponíveis ao avaliar a fórmula numérica do efeito. */
export interface ExecucaoContexto {
  usuarioId: string;
  /** Quem recebe o efeito quando target = ALVO. Default = usuarioId. */
  alvoId?: string;
  /** Variáveis @USUARIO.* (já montadas pelo call site). */
  usuarioVars: Record<string, number>;
  /** Variáveis @ALVO.* (default = usuarioVars). */
  alvoVars?: Record<string, number>;
  /** Variáveis @ITEM.* (usos_restantes etc.). */
  itemVars?: Record<string, number>;
  /** @RESULTADO_N (acumulado entre efeitos da mesma execução). */
  resultados?: number[];
  /** Nome amigável da entidade-fonte (item/feitiço/talento). */
  sourceName?: string;
  /** Snapshot do evento recebido, herdado por branches e subefeitos. */
  dano?: Readonly<Record<string, number>>;
}

/**
 * Decide o `targetId` final de um efeito.
 * - target = USUARIO → usuarioId
 * - target = ALVO    → alvoId ?? usuarioId
 * - target = AREA    → usuarioId (AOE não modelada aqui)
 */
function resolverTargetId(eff: CombatEffect, ctx: ExecucaoContexto): string {
  if (eff.target === 'ALVO') return ctx.alvoId ?? ctx.usuarioId;
  return ctx.usuarioId;
}

/** Avalia a `formula` de um efeito numérico, retornando `{ valor, rolagens }`. */
export function avaliarFormulaEfeito(eff: CombatEffect, ctx: ExecucaoContexto) {
  const vars = eff.target === 'ALVO' ? (ctx.alvoVars ?? ctx.usuarioVars) : ctx.usuarioVars;
  return avaliarFormula(eff.formula || '0', vars, undefined, {
    alvo: ctx.alvoVars ?? ctx.usuarioVars,
    item: ctx.itemVars,
    resultados: ctx.resultados,
    dano: ctx.dano ? { ...ctx.dano } : undefined,
  });
}

/**
 * Executa um único CombatEffect. Roteia entre as keys especiais e a
 * aplicação numérica clássica. Retorna `null` quando o efeito é puramente
 * informativo (buttonOnly) ou quando a sub-execução não produziu valor.
 */
export function executarCombatEffect(
  eff: CombatEffect,
  ctx: ExecucaoContexto,
): ExecucaoResultado {
  // ─── 🔘 buttonOnly: efeito no-op (só existe para gerar o botão) ───
  if (eff.buttonOnly) {
    return { aplicado: 0, detalhe: eff.buttonOnly.label ? `Botão: ${eff.buttonOnly.label}` : 'Botão' };
  }

  // ─── 🎲 diceSwitch: rola e despacha ───────────────────────────────
  if (eff.diceSwitch) {
    return executarDiceSwitch(eff, ctx);
  }

  // ─── 🩸 conditionApply: aplica/remove condição ────────────────────
  if (eff.conditionApply) {
    return executarConditionApply(eff, ctx);
  }

  // ─── ⚙️ Caminho clássico: avalia fórmula e aplica numericamente ──
  const out = avaliarFormulaEfeito(eff, ctx);
  const valor = Math.round(out.valor);
  const teto = eff.counterCap ? avaliarFormulaEfeito({ ...eff, formula: eff.counterCap }, ctx) : undefined;
  if (out.diagnosticos.length || teto?.diagnosticos.length) return { aplicado: 0, detalhe: 'Fórmula ou limite com referência inválida.' };
  const targetId = resolverTargetId(eff, ctx);
  if (eff.transferencia) {
    const store = useCharacterStore.getState();
    const c = store.characters.find(x => x.id === targetId);
    const plano = c && !out.diagnosticos.length ? planejarTransferencia(c, eff.transferencia.origem, eff.transferencia.destino, valor) : undefined;
    if (!plano) return { aplicado: 0, detalhe: 'Transferência inválida: selecione dois saldos compatíveis.' };
    store.updateCharacter(targetId, plano.patch);
    return { aplicado: plano.valor };
  }
  const r = aplicarEfeitoNoPersonagem(targetId, eff.type, eff.resourcePath, valor, {
    peSpellReduction: eff.peSpellReduction,
    immunityGrant: eff.immunityGrant,
    sourceName: ctx.sourceName,
    damageType: eff.damageType,
    attackerId: ctx.usuarioId,
    contador: { teto: teto?.valor, porFonte: eff.counterPerSource, fonteId: ctx.alvoId ?? ctx.usuarioId },
  });
  return { aplicado: r.aplicado, absorvidoPorBloqueio: r.absorvidoPorBloqueio };
}

// ─── Helpers internos ────────────────────────────────────────────────

function executarDiceSwitch(eff: CombatEffect, ctx: ExecucaoContexto): ExecucaoResultado {
  const ds = eff.diceSwitch!;
  // Rola o dado e escolhe a branch.
  const out = avaliarFormula(ds.dice, ctx.usuarioVars, undefined, {
    alvo: ctx.alvoVars ?? ctx.usuarioVars, item: ctx.itemVars, resultados: ctx.resultados,
    dano: ctx.dano ? { ...ctx.dano } : undefined,
  });
  const valor = Math.round(out.valor);
  const branch = ds.branches.find((b) => b.values.includes(valor));
  if (!branch || branch.effects.length === 0) {
    return { aplicado: 0, detalhe: `🎲 ${ds.dice} = ${valor} (sem branch correspondente)` };
  }
  // Executa cada sub-efeito sequencialmente, herdando o contexto.
  const detalhes: string[] = [`🎲 ${ds.dice} = ${valor}`];
  for (const sub of branch.effects) {
    // Sub-efeitos sempre miram o MESMO target do diceSwitch a menos que
    // declarem o seu próprio. Isso preserva semântica: "rolar 1d4 entao
    // 1: aplicar morte" = morte no MESMO alvo do efeito-pai.
    const subEff: CombatEffect = sub.target ? sub : { ...sub, target: eff.target };
    const r = executarCombatEffect(subEff, ctx);
    if (r.detalhe) detalhes.push(r.detalhe);
  }
  return { aplicado: valor, detalhe: detalhes.join(' → ') };
}

function executarConditionApply(eff: CombatEffect, ctx: ExecucaoContexto): ExecucaoResultado {
  const ca = eff.conditionApply!;
  const def = ALL_CONDITIONS.find((c) => c.id === ca.id);
  if (!def) {
    return { aplicado: 0, detalhe: `Condição desconhecida: ${ca.id}` };
  }
  const targetId = resolverTargetId(eff, ctx);
  const store = useCharacterStore.getState();
  if (ca.mode === 'apply') {
    const ac: ActiveCondition = {
      id: crypto.randomUUID(),
      conditionId: def.id,
      name: def.name,
      icon: def.icon,
      remainingTurns: ca.durationTurns ?? -1,
      remainingRounds: ca.durationRounds ?? -1,
      sourceCharName: ctx.sourceName,
    };
    store.addCondition(targetId, ac);
    return { aplicado: 1, detalhe: `${def.icon} Aplicou ${def.name}` };
  }
  // remove: limpa todas as instâncias dessa conditionId no alvo.
  const target = store.characters.find((x) => x.id === targetId);
  if (target?.activeConditions?.length) {
    const restantes = target.activeConditions.filter((c) => c.conditionId !== def.id);
    if (restantes.length !== target.activeConditions.length) {
      store.updateCharacter(targetId, { activeConditions: restantes });
      return { aplicado: 1, detalhe: `${def.icon} Removeu ${def.name}` };
    }
  }
  return { aplicado: 0, detalhe: `${def.name} não estava ativa` };
}

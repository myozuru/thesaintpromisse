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
import { aplicarEfeitoNoPersonagem, validarDestinoAplicacao } from './aplicarEfeito';
import { avaliarFormula } from './parser';
import { planejarTransferencia } from './componentes/transferencia';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { ALL_CONDITIONS, type ActiveCondition } from '@/types/conditions';

/** Resultado padronizado de uma execução. */
export interface ExecucaoResultado {
  invalido?: boolean;
  aplicado: number;
  absorvidoPorBloqueio?: boolean;
  consumido?: number;
  /** Descrição amigável do que aconteceu (para o log/toast). */
  detalhe?: string;
}

/** Variáveis disponíveis ao avaliar a fórmula numérica do efeito. */
export interface ExecucaoContexto {
  /** null indica ambiente sem autor; undefined preserva usuarioId como origem. */
  origemId?: string | null;
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
  /** IDs estáveis da fonte e da cópia que concederam o efeito, quando conhecidos. */
  sourceEntityId?: string;
  sourceInstanceId?: string;
  /** Snapshot do evento recebido, herdado por branches e subefeitos. */
  dano?: Readonly<Record<string, number>>;
}

/** Confere se um CombatEffect numérico tem um destino gravável e contexto suficiente. */
export function erroDestinoCombatEffect(
  eff: Pick<CombatEffect, 'resourcePath' | 'transferencia' | 'peSpellReduction' | 'immunityGrant'>,
  usuarioId: string,
  sourceInstanceId?: string,
): string | undefined {
  if (eff.transferencia || eff.peSpellReduction || eff.immunityGrant) return undefined;
  const destino = validarDestinoAplicacao(eff.resourcePath);
  if (!destino.ok) return destino.mensagem;
  if (destino.canal === 'item') {
    const item = sourceInstanceId ? useInventoryStore.getState().items[sourceInstanceId] : undefined;
    if (!item || item.ownerId !== usuarioId || item.usosTotais === undefined) {
      return 'usos_restantes exige a instância de item com usos, pertencente ao usuário da ação.';
    }
  }
  return undefined;
}

export type ResultadoValidacaoEfeitosFicha =
  | { ok: true; ignorados: number[] }
  | { ok: false; detalhe: string };

/** Pré-valida efeitos de item antes de rolar ou aplicar qualquer um deles na ficha. */
export function validarEfeitosAtivosDaFicha(
  efeitos: readonly CombatEffect[],
  ctx: Pick<ExecucaoContexto, 'usuarioId' | 'alvoId' | 'usuarioVars' | 'alvoVars' | 'itemVars' | 'resultados' | 'sourceInstanceId' | 'dano'>,
  multiplicadorCritico = 1,
): ResultadoValidacaoEfeitosFicha {
  const resultados = [...(ctx.resultados ?? [])];
  const ignorados: number[] = [];
  const extras = () => ({
    alvo: ctx.alvoVars ?? ctx.usuarioVars,
    item: ctx.itemVars,
    resultados,
    dano: ctx.dano ? { ...ctx.dano } : undefined,
  });
  const avaliar = (
    expressao: string,
    rotulo: string,
    op: { deterministico?: boolean; naoNegativo?: boolean } = {},
  ): { ok: true; valor: number } | { ok: false; erro: string } => {
    const r = avaliarFormula(expressao || '0', ctx.usuarioVars, () => 0.5, extras());
    if (r.diagnosticos.length || !Number.isFinite(r.valor)) {
      return { ok: false, erro: `${rotulo}: ${r.diagnosticos.map(d => d.mensagem).join('; ') || 'resultado não finito.'}` };
    }
    if (op.deterministico && r.rolagens.length) return { ok: false, erro: `${rotulo}: precisa ser determinístico; dados aleatórios não são permitidos.` };
    if (op.naoNegativo && r.valor < 0) return { ok: false, erro: `${rotulo}: precisa ser não negativo.` };
    return { ok: true, valor: r.valor };
  };

  for (const [indice, eff] of efeitos.entries()) {
    let condicaoFalsa = false;
    if (eff.condition?.trim()) {
      const condicao = avaliar(eff.condition, `Condição do efeito ${indice + 1}`);
      if (!condicao.ok) return { ok: false, detalhe: condicao.erro };
      condicaoFalsa = condicao.valor <= 0;
      const dependeDoResultado = /@?RESULTADO[_ .]/i.test(eff.condition);
      if (condicaoFalsa && !dependeDoResultado) {
        ignorados.push(indice);
        resultados.push(0);
        continue;
      }
    }

    if (eff.conditionApply) {
      if (!ALL_CONDITIONS.some(c => c.id === eff.conditionApply!.id)) {
        return { ok: false, detalhe: `Condição desconhecida: ${eff.conditionApply.id}` };
      }
      resultados.push(0);
      continue;
    }
    if (eff.buttonOnly) {
      resultados.push(0);
      continue;
    }
    if (eff.diceSwitch) {
      const dado = avaliar(eff.diceSwitch.dice, `Dado de seleção do efeito ${indice + 1}`);
      if (!dado.ok) return { ok: false, detalhe: dado.erro };
      const erroRamos = validarRamosDiceSwitch(
        eff.diceSwitch,
        { ...ctx, resultados },
        eff.target,
        `Efeito ${indice + 1}`,
      );
      if (erroRamos) return { ok: false, detalhe: erroRamos };
      resultados.push(Math.round(dado.valor));
      continue;
    }

    const erroDestino = erroDestinoCombatEffect(eff, ctx.usuarioId, ctx.sourceInstanceId);
    if (erroDestino) return { ok: false, detalhe: erroDestino };
    const destino = validarDestinoAplicacao(eff.resourcePath);
    if (destino.ok && destino.canal !== 'item' && !eff.transferencia && eff.target === 'ALVO' && !ctx.alvoId) {
      return { ok: false, detalhe: 'Esta ação de ficha não tem um alvo selecionado para o efeito.' };
    }
    if (destino.ok && destino.canal !== 'item' && !eff.transferencia && eff.target === 'AREA') {
      return { ok: false, detalhe: 'Esta ação de ficha não tem um seletor de área para o efeito.' };
    }
    const formula = avaliar(eff.formula || '0', `Fórmula do efeito ${indice + 1}`);
    if (!formula.ok) return { ok: false, detalhe: formula.erro };
    const teto = eff.counterCap ? avaliar(eff.counterCap, `Teto do efeito ${indice + 1}`, { deterministico: true, naoNegativo: true }) : undefined;
    if (teto && !teto.ok) return { ok: false, detalhe: teto.erro };
    const tetoFonte = eff.counterSourceLimit ? avaliar(eff.counterSourceLimit, `Teto por fonte do efeito ${indice + 1}`, { deterministico: true, naoNegativo: true }) : undefined;
    if (tetoFonte && !tetoFonte.ok) return { ok: false, detalhe: tetoFonte.erro };
    const valor = Math.round(formula.valor * (eff.type === 'SUBTRAIR' ? multiplicadorCritico : 1));
    resultados.push(valor);
  }
  return { ok: true, ignorados };
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
  // O destino do efeito não troca a identidade de @USUARIO. @ALVO vem do contexto próprio.
  const vars = ctx.usuarioVars;
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
  const limiteFonte = eff.counterSourceLimit ? avaliarFormulaEfeito({ ...eff, formula: eff.counterSourceLimit }, ctx) : undefined;
  const diagnosticoLimite = (rotulo: string, resultado: ReturnType<typeof avaliarFormulaEfeito> | undefined): string | undefined => {
    if (!resultado) return undefined;
    if (resultado.diagnosticos.length) return `${rotulo}: ${resultado.diagnosticos.map(d => d.mensagem).join('; ')}`;
    if (resultado.rolagens.length) return `${rotulo}: precisa ser determinístico; dados aleatórios não são permitidos.`;
    if (!Number.isFinite(resultado.valor)) return `${rotulo}: valor não finito.`;
    if (resultado.valor < 0) return `${rotulo}: precisa ser não negativo.`;
    return undefined;
  };
  const erroLimite = diagnosticoLimite('Teto global', teto) ?? diagnosticoLimite('Teto por fonte', limiteFonte);
  if (out.diagnosticos.length || !Number.isFinite(out.valor) || erroLimite) {
    const erroFormula = out.diagnosticos.map(d => d.mensagem).join('; ') || (!Number.isFinite(out.valor) ? 'fórmula do efeito não finita' : '');
    return { aplicado: 0, invalido: true, detalhe: erroLimite ?? erroFormula ?? 'Fórmula inválida.' };
  }
  const targetId = resolverTargetId(eff, ctx);
  if (eff.transferencia) {
    if (eff.transferencia.moedaId) {
      const money = useMoneyStore.getState();
      const role = useRoleStore.getState().role;
      const carteiraOrigem = money.wallets.find(w => w.id === eff.transferencia!.origem);
      const carteiraDestino = money.wallets.find(w => w.id === eff.transferencia!.destino);
      const valorTransferir = Math.floor(valor);
      if (!Number.isFinite(valor) || valorTransferir <= 0 || !carteiraOrigem || !carteiraDestino
        || !money.currencies.some(c => c.id === eff.transferencia!.moedaId)) {
        return { aplicado: 0, invalido: true, detalhe: 'Transferência monetária inválida: verifique valor, carteiras e moeda.' };
      }
      if (role !== 'MASTER' && (role !== 'PLAYER' || !carteiraOrigem.members.includes(ctx.usuarioId))) {
        return { aplicado: 0, invalido: true, detalhe: 'Transferência recusada: o executor precisa ser Mestre ou membro da carteira de origem.' };
      }
      const actor = role === 'MASTER' ? 'MASTER' : ctx.usuarioId;
      const concluida = money.transfer(
        carteiraOrigem.id, carteiraDestino.id, eff.transferencia.moedaId, valorTransferir,
        ctx.sourceName ? `OMNI: ${ctx.sourceName}` : 'OMNI', actor,
      );
      if (!concluida) return { aplicado: 0, invalido: true, detalhe: 'Transferência recusada: saldo insuficiente, origem igual ao destino ou dados inválidos.' };
      return { aplicado: valorTransferir };
    }
    const store = useCharacterStore.getState();
    const c = store.characters.find(x => x.id === targetId);
    const plano = c && !out.diagnosticos.length ? planejarTransferencia(c, eff.transferencia.origem, eff.transferencia.destino, valor) : undefined;
    if (!plano) return { aplicado: 0, invalido: true, detalhe: 'Transferência inválida: selecione dois saldos compatíveis.' };
    store.updateCharacter(targetId, plano.patch);
    return { aplicado: plano.valor };
  }
  const erroDestino = erroDestinoCombatEffect(eff, ctx.usuarioId, ctx.sourceInstanceId);
  if (erroDestino) return { aplicado: 0, invalido: true, detalhe: erroDestino };
  const r = aplicarEfeitoNoPersonagem(targetId, eff.type, eff.resourcePath, valor, {
    peSpellReduction: eff.peSpellReduction,
    immunityGrant: eff.immunityGrant,
    sourceName: ctx.sourceName,
    damageType: eff.damageType,
    attackerId: ctx.origemId === null ? undefined : ctx.origemId ?? ctx.usuarioId,
    itemInstanceId: ctx.sourceInstanceId,
    contador: { teto: teto?.valor, porFonte: eff.counterPerSource, fonteId: ctx.alvoId ?? ctx.usuarioId, limiteFonte: limiteFonte?.valor, periodoFonte: eff.counterSourcePeriod },
  });
  return { aplicado: r.aplicado, absorvidoPorBloqueio: r.absorvidoPorBloqueio, consumido: r.consumido };
}

// ─── Helpers internos ────────────────────────────────────────────────

function executarDiceSwitch(eff: CombatEffect, ctx: ExecucaoContexto): ExecucaoResultado {
  const ds = eff.diceSwitch!;
  const erroRamos = validarRamosDiceSwitch(ds, ctx, eff.target);
  if (erroRamos) {
    return { aplicado: 0, invalido: true, detalhe: erroRamos };
  }
  // Rola o dado e escolhe a branch.
  const out = avaliarFormula(ds.dice, ctx.usuarioVars, undefined, {
    alvo: ctx.alvoVars ?? ctx.usuarioVars, item: ctx.itemVars, resultados: ctx.resultados,
    dano: ctx.dano ? { ...ctx.dano } : undefined,
  });
  if (out.diagnosticos.length || !Number.isFinite(out.valor)) return { aplicado: 0, invalido: true, detalhe: 'Dado de seleção com fórmula inválida.' };
  const valor = Math.round(out.valor);
  const branch = ds.branches.find((b) => b.values.includes(valor));
  if (!branch || branch.effects.length === 0) {
    return { aplicado: 0, detalhe: `🎲 ${ds.dice} = ${valor} (sem branch correspondente)` };
  }
  // Executa cada sub-efeito sequencialmente, herdando o contexto.
  const detalhes: string[] = [`🎲 ${ds.dice} = ${valor}`];
  for (const [indice, sub] of branch.effects.entries()) {
    // Sub-efeitos sempre miram o MESMO target do diceSwitch a menos que
    // declarem o seu próprio. Isso preserva semântica: "rolar 1d4 entao
    // 1: aplicar morte" = morte no MESMO alvo do efeito-pai.
    const subEff: CombatEffect = sub.target ? sub : { ...sub, target: eff.target };
    if (subEff.condition?.trim()) {
      const condicao = avaliarFormula(subEff.condition, ctx.usuarioVars, undefined, {
        alvo: ctx.alvoVars ?? ctx.usuarioVars,
        item: ctx.itemVars,
        resultados: ctx.resultados,
        dano: ctx.dano ? { ...ctx.dano } : undefined,
      });
      if (condicao.diagnosticos.length || !Number.isFinite(condicao.valor)) {
        return { aplicado: 0, invalido: true, detalhe: `Condição inválida no subefeito ${indice + 1} do resultado ${valor}.` };
      }
      if (condicao.valor <= 0) {
        detalhes.push(`subefeito ${indice + 1} ignorado (condição falsa)`);
        continue;
      }
    }
    const r = executarCombatEffect(subEff, ctx);
    if (r.invalido) {
      return {
        aplicado: 0,
        invalido: true,
        detalhe: `Subefeito ${indice + 1} do resultado ${valor} inválido: ${r.detalhe ?? 'execução recusada.'}`,
      };
    }
    if (r.detalhe) detalhes.push(r.detalhe);
  }
  return { aplicado: valor, detalhe: detalhes.join(' → ') };
}

/** Valida todos os ramos antes de sortear, para não mutar parcialmente uma ação mal configurada. */
function validarRamosDiceSwitch(
  diceSwitch: NonNullable<CombatEffect['diceSwitch']>,
  ctx: ExecucaoContexto,
  alvoPai: CombatEffect['target'],
  trilha = 'diceSwitch',
): string | undefined {
  const extras = () => ({
    alvo: ctx.alvoVars ?? ctx.usuarioVars,
    item: ctx.itemVars,
    resultados: ctx.resultados,
    dano: ctx.dano ? { ...ctx.dano } : undefined,
  });
  const seletor = avaliarFormula(diceSwitch.dice, ctx.usuarioVars, () => 0.5, extras());
  if (seletor.diagnosticos.length || !Number.isFinite(seletor.valor)) {
    return `${trilha}: fórmula do dado de seleção inválida — ${seletor.diagnosticos.map(d => d.mensagem).join('; ') || 'resultado não finito.'}`;
  }

  for (const ramo of diceSwitch.branches) {
    for (const [indiceEfeito, original] of ramo.effects.entries()) {
      const efeito = original.target ? original : { ...original, target: alvoPai };
      const caminho = `${trilha}, ramo ${ramo.values.join('/')}, subefeito ${indiceEfeito + 1}`;
      if (efeito.condition?.trim()) {
        const condicao = avaliarFormula(efeito.condition, ctx.usuarioVars, () => 0.5, extras());
        if (condicao.diagnosticos.length || !Number.isFinite(condicao.valor)) {
          return `${caminho}: condição inválida — ${condicao.diagnosticos.map(d => d.mensagem).join('; ') || 'resultado não finito.'}`;
        }
      }

      if (efeito.conditionApply) {
        if (!ALL_CONDITIONS.some(c => c.id === efeito.conditionApply!.id)) {
          return `${caminho}: condição desconhecida: ${efeito.conditionApply.id}`;
        }
        continue;
      }
      if (efeito.buttonOnly) continue;
      if (efeito.diceSwitch) {
        const erroAninhado = validarRamosDiceSwitch(efeito.diceSwitch, ctx, efeito.target, caminho);
        if (erroAninhado) return erroAninhado;
        continue;
      }

      const erroDestino = erroDestinoCombatEffect(efeito, ctx.usuarioId, ctx.sourceInstanceId);
      if (erroDestino) return `${caminho}: ${erroDestino}`;
      const formula = avaliarFormula(efeito.formula || '0', ctx.usuarioVars, () => 0.5, extras());
      const teto = efeito.counterCap ? avaliarFormula(efeito.counterCap, ctx.usuarioVars, () => 0.5, extras()) : undefined;
      const limiteFonte = efeito.counterSourceLimit ? avaliarFormula(efeito.counterSourceLimit, ctx.usuarioVars, () => 0.5, extras()) : undefined;
      const diagnosticos = [
        ...formula.diagnosticos,
        ...(teto?.diagnosticos ?? []),
        ...(limiteFonte?.diagnosticos ?? []),
      ];
      if (diagnosticos.length || !Number.isFinite(formula.valor)
        || teto && !Number.isFinite(teto.valor)
        || limiteFonte && !Number.isFinite(limiteFonte.valor)) {
        return `${caminho}: fórmula ou limite inválido — ${diagnosticos.map(d => d.mensagem).join('; ') || 'resultado não finito.'}`;
      }
      for (const [rotulo, limite] of [['teto global', teto], ['teto por fonte', limiteFonte]] as const) {
        if (!limite) continue;
        if (limite.rolagens.length) return `${caminho}: ${rotulo} precisa ser determinístico; dados aleatórios não são permitidos.`;
        if (limite.valor < 0) return `${caminho}: ${rotulo} precisa ser não negativo.`;
      }
      if (efeito.transferencia && !efeito.transferencia.moedaId) {
        const alvoId = resolverTargetId(efeito, ctx);
        const ficha = useCharacterStore.getState().characters.find(c => c.id === alvoId);
        const plano = ficha && planejarTransferencia(
          ficha,
          efeito.transferencia.origem,
          efeito.transferencia.destino,
          formula.valor,
        );
        if (!plano) return `${caminho}: transferência inválida — escolha dois saldos compatíveis e um valor não negativo.`;
      }
    }
  }
  return undefined;
}

function executarConditionApply(eff: CombatEffect, ctx: ExecucaoContexto): ExecucaoResultado {
  const ca = eff.conditionApply!;
  const def = ALL_CONDITIONS.find((c) => c.id === ca.id);
  if (!def) {
    return { aplicado: 0, invalido: true, detalhe: `Condição desconhecida: ${ca.id}` };
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
      sourceCharId: ctx.origemId === null ? undefined : ctx.origemId ?? ctx.usuarioId,
      sourceEntityId: ctx.sourceEntityId,
      sourceInstanceId: ctx.sourceInstanceId,
    };
    store.addCondition(targetId, ac);
    return { aplicado: 1, detalhe: `${def.icon} Aplicou ${def.name}` };
  }
  // remove: limpa todas as instâncias dessa conditionId no alvo.
  const target = store.characters.find((x) => x.id === targetId);
  if (target?.activeConditions?.length) {
    const removidas = target.activeConditions.filter((c) => c.conditionId === def.id);
    for (const condition of removidas) store.removeCondition(targetId, condition.id);
    if (removidas.length) return { aplicado: removidas.length, detalhe: `${def.icon} Removeu ${def.name}` };
  }
  return { aplicado: 0, detalhe: `${def.name} não estava ativa` };
}

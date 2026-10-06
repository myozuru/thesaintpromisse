import type { Character } from '@/types';
import type { AcaoAtivaConfig } from './tipos';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { calcularContador } from './contadores';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { capacidadeDaReferencia, tirosRestantes } from '@/lib/recargaRapida';

export interface ContextoCustosAtivos { armaNome?: string; armaInstanciaId?: string; instanciaId?: string; entidadeId?: string }

export interface PlanoCustosAtivos {
  pe: number; pv: number; cargas: number; contador?: string;
  municao: number; armaMunicao?: { charId: string; nome: string; restanteAntes: number; instanceId?: string };
  usosItem: number; instanciaItemId?: string;
  acao: AcaoAtivaConfig['acao']; intensificacoes: number; maxIntensificacoes: number;
  pePorTurno: number;
}
export type ResultadoCustosAtivos = { ok: true; plano: PlanoCustosAtivos } | { ok: false; reason: string };

/** Recursos novos exigem fórmulas determinísticas; legados preservam seu arredondamento. */
export function planejarCustosAtivos(cfg: AcaoAtivaConfig, u: Character, intensificacoes = 0, contexto: ContextoCustosAtivos = {}): ResultadoCustosAtivos {
  const variaveis = montarVariaveisDoPersonagem(u, 'USUARIO');
  const numero = (expr: string | undefined, fallback = 0): number => {
    if (expr === undefined) return fallback;
    // Rejeitar dados antes de avaliar: previews nunca devem fazer rolagens.
    if (!expr.trim() || /\d*d\d+/i.test(expr)) throw new Error('Custo exige fórmula válida sem dados aleatórios.');
    const r = avaliarFormula(expr, variaveis);
    if (r.diagnosticos.length || r.rolagens.length || !Number.isFinite(r.valor) || r.valor < 0 || !Number.isSafeInteger(Math.ceil(r.valor))) throw new Error('Custo inválido, negativo ou com key sem valor.');
    return Math.ceil(r.valor);
  };
  try {
    const c = cfg.custo_recursos;
    if (c?.dano_por_intensificacao?.trim()) {
      const dano = c.dano_por_intensificacao.replace(/\s+/g, '');
      if (!/^(?:\d*d\d+|-?\d+)(?:\+(?:\d*d\d+|-?\d+))*$/i.test(dano) || [...dano.matchAll(/(\d*)d(\d+)/gi)].some(m => Number(m[1] || 1) < 1 || Number(m[2]) < 2)) throw new Error('Dano por intensificação deve conter dados válidos ou valores inteiros.');
    }
    const max = numero(c?.max_intensificacoes);
    if (!Number.isSafeInteger(intensificacoes) || intensificacoes < 0 || intensificacoes > max) return { ok: false, reason: `Intensificação deve ser inteira entre 0 e ${max}.` };
    const legado = c?.pe_base === undefined ? avaliarFormula(cfg.custoPE || '0', variaveis, () => 0.5) : undefined;
    if (legado && (legado.diagnosticos.length || legado.rolagens.length || !Number.isFinite(legado.valor) || legado.valor < 0 || !Number.isSafeInteger(Math.round(legado.valor)))) throw new Error('Custo de PE inválido: use fórmula não negativa e sem dados.');
    const base = c?.pe_base !== undefined ? numero(c.pe_base) : Math.round(legado!.valor);
    const brutoPE = base + numero(c?.pe_por_intensificacao) * intensificacoes;
    const redutorPE = u.omniCostReduction?.pe;
    if (redutorPE && (![redutorPE.reduce, redutorPE.min ?? 1].every(n => Number.isSafeInteger(n) && n >= 0))) throw new Error('Redutor de custo de PE inválido.');
    const pe = brutoPE > 0 && redutorPE && redutorPE.reduce > 0 ? Math.max(redutorPE.min ?? 1, brutoPE - redutorPE.reduce) : brutoPE;
    if (!Number.isSafeInteger(pe)) throw new Error('Custo de PE fora do limite numérico.');
    if (c?.limite_pe !== undefined && pe > numero(c.limite_pe)) return { ok: false, reason: 'Custo excede o limite de PE configurado.' };
    const pv = numero(c?.custo_pv);
    const municao = c?.municao ?? 0, usosItem = c?.usos_item ?? 0;
    if (![municao, usosItem].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Munição e usos do item devem ser inteiros não negativos.');
    let armaMunicao: PlanoCustosAtivos['armaMunicao'];
    if (municao > 0) {
      if (!contexto.armaNome) throw new Error('Munição exige uma arma identificada para a ação.');
      const capacidade = capacidadeDaReferencia(u, contexto.armaNome, contexto.armaInstanciaId);
      if (capacidade === null) throw new Error(`${contexto.armaNome} não usa munição configurada.`);
      const restanteAntes = tirosRestantes(u, contexto.armaNome, contexto.armaInstanciaId) ?? capacidade;
      if (!Number.isSafeInteger(restanteAntes) || restanteAntes < municao) throw new Error(`Munição insuficiente em ${contexto.armaNome} (tem ${restanteAntes}, precisa de ${municao}).`);
      armaMunicao = { charId: u.id, nome: contexto.armaNome, restanteAntes, instanceId: contexto.armaInstanciaId };
    }
    let instanciaItemId: string | undefined;
    if (usosItem > 0) {
      const itens = useInventoryStore.getState().listByOwner(u.id).filter(item =>
        contexto.instanciaId ? item.instanceId === contexto.instanciaId : !!contexto.entidadeId && item.entity.id === contexto.entidadeId,
      );
      const item = itens.length === 1 ? itens[0] : undefined;
      if (!item || contexto.entidadeId && item.entity.id !== contexto.entidadeId) throw new Error('Não foi possível identificar a instância do item desta ação.');
      const total = item.usosTotais ?? item.entity.usos?.total;
      const restante = item.usosRestantes ?? total;
      if (total === undefined) throw new Error('O item desta ação não possui usos limitados configurados.');
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(restante) || restante! < usosItem) throw new Error(`Usos insuficientes do item (tem ${restante ?? 0}, precisa de ${usosItem}).`);
      instanciaItemId = item.instanceId;
    }
    const g = c?.gastar_cargas;
    const contador = g?.nome.trim().toLowerCase() ?? cfg.consumirContador?.nome.trim().toLowerCase();
    const tem = contador ? (u.omniCounters?.[contador] ?? 0) : 0;
    let cargas = 0;
    if (g || cfg.consumirContador) {
      if (!contador) throw new Error('Informe o nome do contador.');
      cargas = g && g.quantidade !== 'todas' ? numero(g.quantidade) : tem;
      if (!Number.isSafeInteger(tem) || tem < 0) throw new Error('Saldo de cargas inválido.');
      const minimo = g ? (g.minimo ?? 1) : cfg.consumirContador!.minimo;
      if (!Number.isSafeInteger(minimo) || minimo < 1) throw new Error('Mínimo de cargas deve ser um inteiro positivo.');
      if (cargas < 1 || tem < Math.max(minimo, cargas)) return { ok: false, reason: `Cargas insuficientes de ${contador} ou quantidade inválida (tem ${tem}).` };
    }
    const pePorTurno = c?.tipo_acao === 'sustentada' ? numero(c.pe_por_turno) : 0;
    if (c?.tipo_acao === 'sustentada' && ![...(cfg.efeitos ?? []), ...Object.values(cfg.desfechosTR ?? {}).flatMap(r => r?.efeitos ?? [])].some(e => e.tipo === 'condicao')) throw new Error('Ação sustentada exige ao menos uma condição para manter.');
    if (c?.tipo_acao === 'sustentada' && pePorTurno < 1) throw new Error('Ação sustentada exige PE por turno maior que zero.');
    const acao = c?.tipo_acao && c.tipo_acao !== 'sustentada' ? c.tipo_acao : cfg.acao;
    const efeitos = [...(cfg.efeitos ?? []), ...Object.values(cfg.desfechosTR ?? {}).flatMap(r => r?.efeitos ?? [])];
    if (efeitos.some(e => e.tipo === 'remover_condicao') && acao === 'livre') return { ok: false, reason: 'Remover condições exige uma ação: escolha Comum, Bônus, Reação ou Movimento.' };
    if (!['comum', 'bonus', 'reacao', 'movimento', 'livre'].includes(acao)) throw new Error('Tipo de ação inválido.');
    return { ok: true, plano: { pe, pv, cargas, contador, municao, armaMunicao, usosItem, instanciaItemId, acao, intensificacoes, maxIntensificacoes: max, pePorTurno } };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'Custos inválidos.' }; }
}

export function validarRecursosAtivos(u: Character, p: PlanoCustosAtivos): { ok: true } | { ok: false; reason: string } {
  if (![u.peCurrent ?? 0, u.tempPE ?? 0].every(n => Number.isFinite(n) && n >= 0) || (u.peCurrent ?? 0) + (u.tempPE ?? 0) < p.pe) return { ok: false, reason: `PE insuficiente (precisa de ${p.pe}).` };
  // Sacrifício usa PV reais, sem mitigação/escudo/PV temporários e sem matar o usuário.
  if (p.pv > 0 && (!Number.isFinite(u.hpCurrent) || (u.hpCurrent ?? 0) <= p.pv)) return { ok: false, reason: `PV insuficiente: o custo de ${p.pv} deve deixar ao menos 1 PV.` };
  if (p.acao === 'comum' && (!Number.isFinite(u.actionsCurrent ?? 1) || (u.actionsCurrent ?? 1) < 1)) return { ok: false, reason: 'Sem Ação Comum disponível.' };
  if (p.acao === 'bonus' && (!Number.isFinite(u.bonusActionsCurrent ?? 1) || (u.bonusActionsCurrent ?? 1) < 1)) return { ok: false, reason: 'Sem Ação Bônus disponível.' };
  const reacoesDisponiveis = u.reactionsCurrent ?? u.reactionsMax ?? 1;
  if (p.acao === 'reacao' && (!Number.isFinite(reacoesDisponiveis) || reacoesDisponiveis < 1)) return { ok: false, reason: 'Sem Reação disponível.' };
  if (p.acao === 'movimento') {
    const combate = useCombatStore.getState();
    if (combate.inCombat && combate.initiativeOrder[combate.currentTurnIndex]?.charId !== u.id) return { ok: false, reason: 'A Ação de Movimento só pode ser usada no turno do personagem.' };
    if (combate.inCombat && combate.movementActionUsedByChar?.[u.id]) return { ok: false, reason: 'A Ação de Movimento deste turno já foi usada.' };
  }
  return { ok: true };
}

export function patchCustosAtivos(u: Character, p: PlanoCustosAtivos): Partial<Character> {
  const temp = Math.min(u.tempPE ?? 0, p.pe);
  const patch: Partial<Character> = { tempPE: (u.tempPE ?? 0) - temp, peCurrent: (u.peCurrent ?? 0) - (p.pe - temp) };
  if (p.pv) patch.hpCurrent = u.hpCurrent - p.pv;
  if (p.acao === 'comum') patch.actionsCurrent = Math.max(0, (u.actionsCurrent ?? 1) - 1);
  if (p.acao === 'bonus') patch.bonusActionsCurrent = Math.max(0, (u.bonusActionsCurrent ?? 1) - 1);
  if (p.acao === 'reacao') patch.reactionsCurrent = Math.max(0, (u.reactionsCurrent ?? u.reactionsMax ?? 1) - 1);
  if (p.contador && p.cargas > 0) patch.omniCounters = calcularContador(u.omniCounters ?? {}, p.contador, 'CONSUMIR_CONTADOR', { valor: p.cargas }).counters;
  return patch;
}

/** Consome munição da cópia exata validada no plano de custos. */
export function consumirMunicaoAtiva(p: PlanoCustosAtivos): boolean {
  const ammo = p.armaMunicao;
  if (!ammo || p.municao <= 0) return true;
  if (!ammo.instanceId) {
    const fresh = useCharacterStore.getState().characters.find(c => c.id === ammo.charId);
    if (!fresh) return false;
    const current = fresh.weaponAmmo?.[ammo.nome] ?? ammo.restanteAntes;
    if (current < p.municao) return false;
    useCharacterStore.getState().updateCharacter(fresh.id, { weaponAmmo: { ...(fresh.weaponAmmo ?? {}), [ammo.nome]: current - p.municao } });
    return true;
  }
  if (ammo.instanceId.startsWith('legacy:')) {
    const fresh = useCharacterStore.getState().characters.find(c => c.id === ammo.charId);
    const current = fresh?.weaponAmmo?.[ammo.instanceId];
    if (!fresh || current === undefined || current < p.municao) return false;
    useCharacterStore.getState().updateCharacter(fresh.id, { weaponAmmo: { ...(fresh.weaponAmmo ?? {}), [ammo.instanceId]: current - p.municao } });
    return true;
  }
  const inventory = useInventoryStore.getState(), item = inventory.items[ammo.instanceId];
  if (!item) return false;
  const remaining = item.municaoRestante ?? ammo.restanteAntes;
  if (remaining < p.municao) return false;
  inventory.definirMunicao(ammo.instanceId, remaining - p.municao);
  return true;
}

/** Consome usos no inventário; chamadas devem validar o plano antes de alterar outros recursos. */
export function consumirUsosItemAtivo(p: PlanoCustosAtivos): boolean {
  if (p.usosItem <= 0) return true;
  if (!p.instanciaItemId) return false;
  return useInventoryStore.getState().consumirUso(p.instanciaItemId, p.usosItem);
}

export function encerrarSustentacaoAtiva(charId: string, id: string): void {
  const store = useCharacterStore.getState(), u = store.characters.find(c => c.id === charId);
  const ativo = u?.omniSustentacoes?.find(s => s.id === id);
  if (!u || !ativo) return;
  for (const c of ativo.condicoes) {
    if (c.sourceEntityId) store.removeConditionsFromSource(c.charId, c.sourceEntityId, c.sourceInstanceId);
    else store.removeCondition(c.charId, c.id);
  }
  store.updateCharacter(charId, { omniSustentacoes: u.omniSustentacoes!.filter(s => s.id !== id) });
  useLogStore.getState().addLog('combat', `⏳ ${u.name}: ${ativo.nome} deixou de ser sustentada.`);
}

/** Uma chamada por começo de turno, nos mesmos pontos de integração das réplicas. */
export function inicioTurnoSustentacoesAtivas(charId: string): void {
  const ativos = useCharacterStore.getState().characters.find(c => c.id === charId)?.omniSustentacoes ?? [];
  for (const ativo of ativos) {
    const store = useCharacterStore.getState(), u = store.characters.find(c => c.id === charId);
    if (!u) return;
    if (!u.omniSustentacoes?.some(s => s.id === ativo.id)) continue;
    if (!ativo.condicoes.some(c => store.characters.find(x => x.id === c.charId)?.activeConditions?.some(a => {
      if (a.id !== c.id) return false;
      if (!c.sourceEntityId) return true;
      return a.sourceApplications?.some(source => source.sourceEntityId === c.sourceEntityId
        && (!c.sourceInstanceId || source.sourceInstanceId === c.sourceInstanceId)) ?? false;
    })) || !Number.isSafeInteger(ativo.pePorTurno) || ativo.pePorTurno < 1) { encerrarSustentacaoAtiva(charId, ativo.id); continue; }
    if ((u.peCurrent ?? 0) + (u.tempPE ?? 0) < ativo.pePorTurno) { encerrarSustentacaoAtiva(charId, ativo.id); continue; }
    const temp = Math.min(u.tempPE ?? 0, ativo.pePorTurno);
    store.updateCharacter(charId, { tempPE: (u.tempPE ?? 0) - temp, peCurrent: (u.peCurrent ?? 0) - (ativo.pePorTurno - temp) });
    useLogStore.getState().addLog('combat', `⚡ ${u.name} sustenta ${ativo.nome} (${ativo.pePorTurno} PE).`);
  }
}

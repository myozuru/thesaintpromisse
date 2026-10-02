import type { Character } from '@/types';
import type { AcaoAtivaConfig } from './tipos';
import { avaliarFormula } from './parser';
import { montarVariaveisDoPersonagem } from './resolvedor';
import { calcularContador } from './contadores';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export interface PlanoCustosAtivos {
  pe: number; pv: number; cargas: number; contador?: string;
  acao: AcaoAtivaConfig['acao']; intensificacoes: number; maxIntensificacoes: number;
  pePorTurno: number;
}
export type ResultadoCustosAtivos = { ok: true; plano: PlanoCustosAtivos } | { ok: false; reason: string };

/** Recursos novos exigem fórmulas determinísticas; legados preservam seu arredondamento. */
export function planejarCustosAtivos(cfg: AcaoAtivaConfig, u: Character, intensificacoes = 0): ResultadoCustosAtivos {
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
    const base = c?.pe_base !== undefined ? numero(c.pe_base) : Math.max(0, Math.round(avaliarFormula(cfg.custoPE || '0', variaveis).valor));
    const pe = base + numero(c?.pe_por_intensificacao) * intensificacoes;
    if (!Number.isSafeInteger(pe)) throw new Error('Custo de PE fora do limite numérico.');
    if (c?.limite_pe !== undefined && pe > numero(c.limite_pe)) return { ok: false, reason: 'Custo excede o limite de PE configurado.' };
    const pv = numero(c?.custo_pv);
    const g = c?.gastar_cargas;
    const contador = g?.nome.trim().toLowerCase() ?? cfg.consumirContador?.nome.trim().toLowerCase();
    const tem = contador ? (u.omniCounters?.[contador] ?? 0) : 0;
    let cargas = 0;
    if (g || cfg.consumirContador) {
      if (!contador) throw new Error('Informe o nome do contador.');
      cargas = g && g.quantidade !== 'todas' ? numero(g.quantidade) : tem;
      const minimo = g ? (g.minimo ?? 1) : Math.max(1, cfg.consumirContador!.minimo);
      if (cargas < 1 || tem < Math.max(minimo, cargas)) return { ok: false, reason: `Cargas insuficientes de ${contador} ou quantidade inválida (tem ${tem}).` };
    }
    const pePorTurno = c?.tipo_acao === 'sustentada' ? numero(c.pe_por_turno) : 0;
    if (c?.tipo_acao === 'sustentada' && !cfg.efeitos?.some(e => e.tipo === 'condicao')) throw new Error('Ação sustentada exige ao menos uma condição para manter.');
    if (c?.tipo_acao === 'sustentada' && pePorTurno < 1) throw new Error('Ação sustentada exige PE por turno maior que zero.');
    const acao = c?.tipo_acao && c.tipo_acao !== 'sustentada' ? c.tipo_acao : cfg.acao;
    return { ok: true, plano: { pe, pv, cargas, contador, acao, intensificacoes, maxIntensificacoes: max, pePorTurno } };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'Custos inválidos.' }; }
}

export function validarRecursosAtivos(u: Character, p: PlanoCustosAtivos): { ok: true } | { ok: false; reason: string } {
  if ((u.peCurrent ?? 0) + (u.tempPE ?? 0) < p.pe) return { ok: false, reason: `PE insuficiente (precisa de ${p.pe}).` };
  // Sacrifício usa PV reais, sem mitigação/escudo/PV temporários e sem matar o usuário.
  if (p.pv > 0 && (u.hpCurrent ?? 0) <= p.pv) return { ok: false, reason: `PV insuficiente: o custo de ${p.pv} deve deixar ao menos 1 PV.` };
  if (p.acao === 'comum' && (u.actionsCurrent ?? 1) <= 0) return { ok: false, reason: 'Sem Ação Comum disponível.' };
  if (p.acao === 'bonus' && (u.bonusActionsCurrent ?? 1) <= 0) return { ok: false, reason: 'Sem Ação Bônus disponível.' };
  if (p.acao === 'reacao' && (u.reactionsCurrent ?? 1) <= 0) return { ok: false, reason: 'Sem Reação disponível.' };
  return { ok: true };
}

export function patchCustosAtivos(u: Character, p: PlanoCustosAtivos): Partial<Character> {
  const temp = Math.min(u.tempPE ?? 0, p.pe);
  const patch: Partial<Character> = { tempPE: (u.tempPE ?? 0) - temp, peCurrent: (u.peCurrent ?? 0) - (p.pe - temp) };
  if (p.pv) patch.hpCurrent = u.hpCurrent - p.pv;
  if (p.acao === 'comum') patch.actionsCurrent = Math.max(0, (u.actionsCurrent ?? 1) - 1);
  if (p.acao === 'bonus') patch.bonusActionsCurrent = Math.max(0, (u.bonusActionsCurrent ?? 1) - 1);
  if (p.acao === 'reacao') patch.reactionsCurrent = Math.max(0, (u.reactionsCurrent ?? 1) - 1);
  if (p.contador && p.cargas > 0) patch.omniCounters = calcularContador(u.omniCounters ?? {}, p.contador, 'CONSUMIR_CONTADOR', { valor: p.cargas }).counters;
  return patch;
}

export function encerrarSustentacaoAtiva(charId: string, id: string): void {
  const store = useCharacterStore.getState(), u = store.characters.find(c => c.id === charId);
  const ativo = u?.omniSustentacoes?.find(s => s.id === id);
  if (!u || !ativo) return;
  for (const c of ativo.condicoes) store.removeCondition(c.charId, c.id);
  store.updateCharacter(charId, { omniSustentacoes: u.omniSustentacoes!.filter(s => s.id !== id) });
  useLogStore.getState().addLog('combat', `⏳ ${u.name}: ${ativo.nome} deixou de ser sustentada.`);
}

/** Uma chamada por começo de turno, nos mesmos pontos de integração das réplicas. */
export function inicioTurnoSustentacoesAtivas(charId: string): void {
  const ativos = useCharacterStore.getState().characters.find(c => c.id === charId)?.omniSustentacoes ?? [];
  for (const ativo of ativos) {
    const store = useCharacterStore.getState(), u = store.characters.find(c => c.id === charId);
    if (!u) return;
    if ((u.peCurrent ?? 0) + (u.tempPE ?? 0) < ativo.pePorTurno) { encerrarSustentacaoAtiva(charId, ativo.id); continue; }
    const temp = Math.min(u.tempPE ?? 0, ativo.pePorTurno);
    store.updateCharacter(charId, { tempPE: (u.tempPE ?? 0) - temp, peCurrent: (u.peCurrent ?? 0) - (ativo.pePorTurno - temp) });
    useLogStore.getState().addLog('combat', `⚡ ${u.name} sustenta ${ativo.nome} (${ativo.pePorTurno} PE).`);
  }
}

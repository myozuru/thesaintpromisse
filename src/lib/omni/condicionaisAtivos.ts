/** Predicados de estado para ações ativas: avaliação sem efeitos colaterais. */
import type { Character } from '@/types';
import type { ActiveCondition } from '@/types/conditions';
import type { ModificadorCondicionalAtivo, OperadorEstado, PredicadoEstado } from './tipos';
import { useMapStore } from '@/stores/useMapStore';
import { charsDistanceMeters } from '@/lib/touchRange';

const normalizar = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function condicoesComNome(c: Character, nome: string): ActiveCondition[] {
  const n = normalizar(nome);
  if (!n) return [];
  return (c.activeConditions ?? []).filter(a => normalizar(a.conditionId) === n || normalizar(a.name ?? '') === n);
}

/** A instância mais antiga com idade registrada; legadas não têm idade presumida. */
export function idadeCondicao(c: Character, nome: string): number | undefined {
  const idades = condicoesComNome(c, nome).map(a => a.elapsedRounds).filter((n): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0);
  return idades.length ? Math.max(...idades) : undefined;
}

function comparar(a: number | undefined, op: OperadorEstado, b: number): boolean {
  if (a === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '==': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '>': return a > b;
    default: return false;
  }
}

export function avaliarPredicadoEstado(p: PredicadoEstado, sujeito: Character, outro: Character): boolean {
  switch (p.tipo) {
    case 'tem_condicao': return condicoesComNome(sujeito, p.nome).length > 0;
    case 'rodadas_condicao': return comparar(idadeCondicao(sujeito, p.nome), p.operador, p.valor);
    case 'pv_percentual': {
      const percentual = Number.isFinite(sujeito.hpMax) && sujeito.hpMax > 0 && Number.isFinite(sujeito.hpCurrent)
        ? Math.min(100, Math.max(0, sujeito.hpCurrent / sujeito.hpMax * 100)) : undefined;
      return comparar(percentual, p.operador, p.valor);
    }
    case 'cargas': return !!p.nome.trim() && comparar(sujeito.omniCounters?.[p.nome.trim().toLowerCase()] ?? 0, p.operador, p.valor);
    case 'distancia': {
      const ms = useMapStore.getState();
      return comparar(charsDistanceMeters(sujeito.id, outro.id, ms.entities, ms.gridConfig) ?? undefined, p.operador, p.valor);
    }
    default: return false;
  }
}

export function avaliarCondicionaisAtivos(blocos: ModificadorCondicionalAtivo[], u: Character, a: Character) {
  const out = { margem: 0, multiplicador: 0, danos: [] as string[], tr: 0, desvantagemTR: false, vantagemAcerto: false, ativos: [] as string[] };
  const inteiro = (n: number | undefined) => Number.isFinite(n) ? Math.trunc(n!) : 0;
  for (const b of blocos) {
    // Um bloco sem checagens não se transforma acidentalmente em bônus incondicional.
    if (!(b.se_alvo?.length || b.se_usuario?.length)) continue;
    if (!(b.se_alvo ?? []).every(p => avaliarPredicadoEstado(p, a, u)) || !(b.se_usuario ?? []).every(p => avaliarPredicadoEstado(p, u, a))) continue;
    out.margem += inteiro(b.margem_critico_mod);
    out.multiplicador += inteiro(b.multiplicador_critico_mod);
    out.tr += inteiro(b.mod_tr_alvo);
    if (b.dano_extra?.trim()) out.danos.push(b.dano_extra);
    out.desvantagemTR ||= !!b.desvantagem_tr_alvo;
    out.vantagemAcerto ||= !!b.vantagem_acerto;
    out.ativos.push(b.id);
  }
  return out;
}

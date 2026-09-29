/**
 * Estilo do Interceptador (reação). Aliado (não você) a até 1,5 m vai receber
 * um ataque → gasta reação, rola Nd10 + mod. do atributo-chave (FOR/DES/SAB)
 * e esse valor é descontado do PRÓXIMO dano que o aliado sofrer.
 * N = 1 (+1 nos níveis 4, 8, 12 e 16).
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { fmtM, TOUCH_RANGE_M } from '@/lib/touchRange';
import { hasCombatStyle, styleStepBonus } from '@/lib/combateEstilos';
import { protetorDistance } from '@/lib/combateProtetor';

export const INTERCEPTADOR_RANGE_M = TOUCH_RANGE_M;
type R = { ok: true; amount: number } | { ok: false; reason: string };

export function interceptadorDice(level: number): number { return 1 + styleStepBonus(level); }

export function interceptadorAttr(c: Character): 'Força' | 'Destreza' | 'Sabedoria' {
  const k = c.keyAttribute;
  return k === 'Destreza' || k === 'Sabedoria' ? k : 'Força';
}

export function interceptadorMod(c: Character): number {
  const name = interceptadorAttr(c);
  const a = (c.attributes ?? []).find((x) => x.name === name);
  const v = (a?.value ?? 10) + (a?.externalBonus ?? 0);
  return Math.floor((v - 10) / 2);
}

export function interceptadorInterceptar(
  interceptorId: string, allyId: string, rng: () => number = Math.random,
): R {
  const st = useCharacterStore.getState();
  const log = useLogStore.getState().addLog;
  const p = st.characters.find((c) => c.id === interceptorId);
  const fail = (reason: string): R => { log('combat', `🗡️ ${p?.name ?? '?'}: Interceptador falhou — ${reason}`); return { ok: false, reason }; };
  if (!p || !hasCombatStyle(p, 'interceptador')) return fail('Sem Estilo do Interceptador.');
  if (allyId === interceptorId) return fail('O Interceptador protege outro aliado, não você mesmo.');
  const ally = st.characters.find((c) => c.id === allyId);
  if (!ally) return fail('Escolha o aliado.');
  if ((p.reactionsCurrent ?? 0) <= 0) return fail('Sem reação disponível.');
  const d = protetorDistance(interceptorId, allyId);
  if (d === null) return fail('Aliado sem peça no mapa — não dá para medir 1,5 m.');
  if (d > INTERCEPTADOR_RANGE_M + 0.05) return fail(`Aliado a ${fmtM(d)} m — falta ${fmtM(d - INTERCEPTADOR_RANGE_M)} m para 1,5 m.`);
  const n = interceptadorDice(p.level ?? 1);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(rng() * 10));
  const mod = interceptadorMod(p);
  const amount = Math.max(0, rolls.reduce((a, b) => a + b, 0) + mod);
  st.updateCharacter(interceptorId, { reactionsCurrent: Math.max(0, (p.reactionsCurrent ?? 0) - 1) });
  st.updateCharacter(allyId, { interceptGuard: { amount, byName: p.name } } as Partial<Character>);
  log('combat', `🗡️ ${p.name} usa a reação (Estilo do Interceptador) em ${ally.name}: ${n}d10 [${rolls.join(', ')}] ${mod >= 0 ? '+' : '−'} ${Math.abs(mod)} (${interceptadorAttr(p).slice(0, 3).toUpperCase()}) = ${amount} de redução no próximo dano.`);
  return { ok: true, amount };
}

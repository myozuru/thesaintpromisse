/**
 * Especialista em Combate — Habilidade de 2º nível: Revigorar.
 *
 * Ação Bônus. Cura 1d10 + 2 × Mod. Constituição + Bônus de Treinamento.
 * Ganha +1d10 nos níveis 4, 8, 12, 16 e 20.
 *
 * Usos por descanso = Bônus de Treinamento. Descanso longo devolve todos;
 * descanso curto devolve metade (arredondada para baixo).
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollDiceCom } from '@/lib/dice';

export const REVIGORAR_ID = 'ec-revigorar';

/** Níveis em que a cura ganha um dado adicional. */
export const REVIGORAR_MARCOS = [4, 8, 12, 16, 20];

export function hasRevigorar(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === REVIGORAR_ID);
}

/** Quantidade de d10 da cura: 1 + um por marco de nível alcançado. */
export function revigorarDados(level: number): number {
  const lv = Math.max(1, level || 1);
  return 1 + REVIGORAR_MARCOS.filter((m) => lv >= m).length;
}

/** Modificador de Constituição da ficha. */
export function revigorarConMod(c: Character): number {
  const attr = (c.attributes ?? []).find((a) => (a.name ?? '').toLowerCase().startsWith('constitu'));
  if (!attr) return 0;
  return Math.floor((((attr.value ?? 10) + (attr.externalBonus ?? 0)) - 10) / 2);
}

/** Bônus somado à rolagem: 2 × Mod. CON + Bônus de Treinamento. */
export function revigorarBonus(c: Character): number {
  return 2 * revigorarConMod(c) + getTrainingBonusByLevel(c.level ?? 1);
}

export function revigorarUsosMax(c: Character): number {
  return Math.max(1, getTrainingBonusByLevel(c.level ?? 1));
}

export function revigorarUsosGastos(c: Character): number {
  return c.specAbilityUsage?.[REVIGORAR_ID] ?? 0;
}

export function revigorarUsosRestantes(c: Character): number {
  return Math.max(0, revigorarUsosMax(c) - revigorarUsosGastos(c));
}

export function revigorarPodeUsar(c: Character | null | undefined): { ok: boolean; reason?: string } {
  if (!c || !hasRevigorar(c)) return { ok: false, reason: 'Sem Revigorar.' };
  if (revigorarUsosRestantes(c) <= 0) return { ok: false, reason: 'Sem usos — descanse para recuperar.' };
  if ((c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem ação bônus disponível.' };
  if ((c.hpCurrent ?? 0) >= (c.hpMax ?? 0)) return { ok: false, reason: 'Vida já está no máximo.' };
  return { ok: true };
}

export type RevigorarResultado =
  | { ok: true; rolls: number[]; bonus: number; total: number; curado: number }
  | { ok: false; reason: string };

/** Executa a cura: gasta ação bônus + 1 uso e rola os d10. */
export async function revigorarExecutar(charId: string): Promise<RevigorarResultado> {
  const store = useCharacterStore.getState();
  const log = useLogStore.getState().addLog;
  const c = store.characters.find((x) => x.id === charId);
  const chk = revigorarPodeUsar(c);
  if (!c || !chk.ok) {
    log('combat', `💚 ${c?.name ?? '?'}: Revigorar falhou — ${chk.reason}`);
    return { ok: false, reason: chk.reason ?? 'Não é possível.' };
  }

  const dados = revigorarDados(c.level ?? 1);
  const bonus = revigorarBonus(c);

  store.updateCharacter(charId, {
    bonusActionsCurrent: Math.max(0, (c.bonusActionsCurrent ?? 0) - 1),
    specAbilityUsage: {
      ...(c.specAbilityUsage ?? {}),
      [REVIGORAR_ID]: revigorarUsosGastos(c) + 1,
    },
  });

  const { rolls, total: dadosTotal } = await rollDiceCom(charId, `${dados}d10`, {
    bonus,
    label: `Revigorar — ${dados}d10`,
  });
  const total = Math.max(0, dadosTotal + bonus);

  const antes = useCharacterStore.getState().characters.find((x) => x.id === charId)?.hpCurrent ?? 0;
  useCharacterStore.getState().applyHealing(charId, total, 'other');
  const depois = useCharacterStore.getState().characters.find((x) => x.id === charId)?.hpCurrent ?? antes;
  const curado = depois - antes;

  log(
    'combat',
    `💚 ${c.name} usa Revigorar (ação bônus): ${dados}d10 (${rolls.join(', ')}) ${bonus >= 0 ? '+' : ''}${bonus} = ${total} → +${curado} PV (${antes} → ${depois}).`,
  );
  return { ok: true, rolls, bonus, total, curado };
}

/** Patch aplicado no descanso curto: devolve metade dos usos (para baixo). */
export function revigorarPatchDescansoCurto(c: Character): number {
  const gastos = revigorarUsosGastos(c);
  if (gastos <= 0) return 0;
  const devolve = Math.floor(revigorarUsosMax(c) / 2);
  return Math.max(0, gastos - devolve);
}

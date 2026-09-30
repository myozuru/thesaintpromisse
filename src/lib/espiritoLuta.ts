/**
 * Especialista em Combate — Habilidade de 4º nível: Espírito de Luta.
 *
 * Ação Livre, 1 PE: +2 em TODAS as jogadas de ataque até o fim da cena.
 * Ao ativar, ganha PV temporários (escudo) iguais ao nível de personagem.
 *
 * Uso: 1 vez por cena (o contador vive em `specAbilityUsage`, escopo `scene`,
 * zerado automaticamente ao encerrar o combate).
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export const ESPIRITO_LUTA_ID = 'ec-espirito-luta';
export const ESPIRITO_LUTA_PE = 1;
export const ESPIRITO_LUTA_ATK = 2;

export function hasEspiritoLuta(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ESPIRITO_LUTA_ID);
}

export function espiritoLutaAtivo(c: Character | null | undefined): boolean {
  if (!hasEspiritoLuta(c)) return false;
  return (c?.specAbilityUsage?.[ESPIRITO_LUTA_ID] ?? 0) > 0;
}

/** Bônus somado em toda jogada de ataque enquanto durar a cena. */
export function espiritoLutaBonus(c: Character | null | undefined): number {
  return espiritoLutaAtivo(c) ? ESPIRITO_LUTA_ATK : 0;
}

export function espiritoLutaPodeUsar(c: Character | null | undefined): { ok: boolean; reason?: string } {
  if (!c || !hasEspiritoLuta(c)) return { ok: false, reason: 'Sem Espírito de Luta.' };
  if (espiritoLutaAtivo(c)) return { ok: false, reason: 'Já ativo nesta cena.' };
  if ((c.peCurrent ?? 0) < ESPIRITO_LUTA_PE) return { ok: false, reason: 'PE insuficiente.' };
  return { ok: true };
}

export type EspiritoLutaResultado =
  | { ok: true; temp: number; bonus: number }
  | { ok: false; reason: string };

/** Ativa: gasta 1 PE, marca o uso da cena e soma PV temporários. */
export function espiritoLutaAtivar(charId: string): EspiritoLutaResultado {
  const store = useCharacterStore.getState();
  const log = useLogStore.getState().addLog;
  const c = store.characters.find((x) => x.id === charId);
  const chk = espiritoLutaPodeUsar(c);
  if (!c || !chk.ok) return { ok: false, reason: chk.reason ?? 'Não é possível.' };

  const temp = Math.max(1, c.level ?? 1);
  store.updateCharacter(charId, {
    peCurrent: Math.max(0, (c.peCurrent ?? 0) - ESPIRITO_LUTA_PE),
    escCurrent: (c.escCurrent ?? 0) + temp,
    escMax: Math.max(c.escMax ?? 0, (c.escCurrent ?? 0) + temp),
    specAbilityUsage: {
      ...(c.specAbilityUsage ?? {}),
      [ESPIRITO_LUTA_ID]: 1,
    },
  });

  log(
    'combat',
    `🔥 ${c.name} usa Espírito de Luta (ação livre, 1 PE): +${ESPIRITO_LUTA_ATK} em ataques até o fim da cena e +${temp} PV temporários.`,
  );
  return { ok: true, temp, bonus: ESPIRITO_LUTA_ATK };
}

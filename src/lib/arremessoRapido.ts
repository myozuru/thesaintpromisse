/**
 * Especialista em Combate — Habilidade de 4º nível: Arremesso Rápido.
 *
 * Uma vez por rodada, ao realizar um ataque com uma arma de arremesso, o
 * Especialista pode gastar 1 PE e sua Ação Bônus para fazer um ataque
 * adicional com arma de arremesso contra outro alvo (ou o mesmo, se for o
 * único disponível).
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { isEspecialistaCombate, isThrownWeapon } from '@/lib/combateEstilos';
import { findWeaponByName } from '@/lib/weapons';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export const ARREMESSO_RAPIDO_ID = 'ec-arremesso-rapido';
export const ARREMESSO_RAPIDO_CUSTO = 1;

export function hasArremessoRapido(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ARREMESSO_RAPIDO_ID);
}

/** Arma de arremesso empunhada (mão principal ou secundária). */
export function armaArremessoEmpunhada(c: Character): { name: string } | null {
  for (const n of [c.mainHandWeaponName, c.offHandWeaponName]) {
    if (!n) continue;
    const w = findWeaponByName(n);
    if (w && isThrownWeapon(w)) return { name: w.name };
  }
  return null;
}

export interface ArremessoRapidoCtx {
  inCombat: boolean;
  round: number;
}

export function arremessoRapidoPodeUsar(
  c: Character | null | undefined,
  ctx: ArremessoRapidoCtx,
): { ok: boolean; reason?: string } {
  if (!c || !hasArremessoRapido(c)) return { ok: false, reason: 'Sem Arremesso Rápido.' };
  if (!ctx.inCombat) return { ok: false, reason: 'Só em combate.' };
  if (!armaArremessoEmpunhada(c)) return { ok: false, reason: 'Exige arma de arremesso empunhada.' };
  if ((c.attacksThisTurn ?? 0) <= 0) return { ok: false, reason: 'Faça primeiro um ataque de arremesso.' };
  if (c.arremessoRapidoRound === ctx.round) return { ok: false, reason: 'Já usada nesta rodada.' };
  if ((c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem ação bônus disponível.' };
  if ((c.peCurrent ?? 0) < ARREMESSO_RAPIDO_CUSTO) return { ok: false, reason: 'PE insuficiente (precisa de 1).' };
  return { ok: true };
}

interface ArrState {
  /** Ataque extra liberado, aguardando rolagem na ficha. */
  ataque: { espId: string; alvoId: string } | null;
  setAtaque: (a: ArrState['ataque']) => void;
}

export const useArremessoRapidoStore = create<ArrState>((set) => ({
  ataque: null,
  setAtaque: (ataque) => set({ ataque }),
}));

/** Gasta 1 PE + Ação Bônus, marca a rodada e libera o ataque extra. */
export function arremessoRapidoUsar(
  charId: string,
  alvoId: string,
  ctx: ArremessoRapidoCtx,
): { ok: boolean; reason?: string } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  const chk = arremessoRapidoPodeUsar(c, ctx);
  if (!c || !chk.ok) return chk;
  const alvo = store.characters.find((x) => x.id === alvoId);
  if (!alvo) return { ok: false, reason: 'Escolha o alvo do ataque extra.' };

  store.updateCharacter(charId, {
    peCurrent: Math.max(0, (c.peCurrent ?? 0) - ARREMESSO_RAPIDO_CUSTO),
    bonusActionsCurrent: Math.max(0, (c.bonusActionsCurrent ?? 0) - 1),
    arremessoRapidoRound: ctx.round,
  });
  useArremessoRapidoStore.getState().setAtaque({ espId: charId, alvoId });
  useLogStore.getState().addLog(
    'combat',
    `🌀 Arremesso Rápido: ${c.name} gasta 1 PE e sua Ação Bônus para arremessar contra ${alvo.name}.`,
  );
  return { ok: true };
}

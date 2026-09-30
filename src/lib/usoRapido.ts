/**
 * Especialista em Combate — Habilidade de 4º nível: Uso Rápido.
 *
 * Ao gastar uma ação para usar um item, o Especialista pode pagar 1 ponto de
 * energia amaldiçoada para usar um item adicional sem gastar outra ação.
 * Vale para qualquer consumível e no máximo 1 item adicional por turno.
 */
import type { Character, Item } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';

export const USO_RAPIDO_ID = 'ec-uso-rapido';
export const CUSTO_PE = 1;

export function hasUsoRapido(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === USO_RAPIDO_ID);
}

/** Item consumível: comida/remédio, item com quantidade que se gasta ao usar. */
export function isConsumivel(item: Pick<Item, 'name' | 'category' | 'isFood'> & { quantity?: number }): boolean {
  if (item.isFood) return true;
  const txt = `${item.category ?? ''} ${item.name ?? ''}`.toLowerCase();
  return /consum|po(ç|c)(ã|a)o|remédio|remedio|medicina|comida|refei(ç|c)(ã|a)o|bebida|kit|antídoto|antidoto|elixir|ampola|seringa|bandagem|curativo|municao|muni(ç|c)(ã|a)o|granada/.test(
    txt,
  );
}

/** Chave do turno atual, para limitar a 1 item adicional por turno. */
export function turnKeyAtual(charId: string): string {
  const { round, combatId } = useCombatStore.getState();
  return `${combatId ?? 'sem-combate'}:${round}:${charId}`;
}

/** Já usou o item adicional neste turno? */
export function jaUsouNesteTurno(c: Character): boolean {
  return c.usoRapidoTurnKey === turnKeyAtual(c.id);
}

export function podeUsarItemAdicional(c: Character | null | undefined): { ok: boolean; reason?: string } {
  if (!c || !hasUsoRapido(c)) return { ok: false, reason: 'Sem Uso Rápido.' };
  if (jaUsouNesteTurno(c)) return { ok: false, reason: 'Você já usou o item adicional neste turno.' };
  if ((c.peCurrent ?? 0) < CUSTO_PE) return { ok: false, reason: 'Sem energia amaldiçoada (1 PE).' };
  return { ok: true };
}

/** Gasta 1 PE e libera o uso de um item adicional neste turno. */
export function pagarItemAdicional(charId: string, nomeItem?: string): { ok: boolean; reason?: string } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  const chk = podeUsarItemAdicional(c);
  if (!c || !chk.ok) return chk;
  store.updateCharacter(charId, {
    peCurrent: Math.max(0, (c.peCurrent ?? 0) - CUSTO_PE),
    usoRapidoTurnKey: turnKeyAtual(charId),
  });
  useLogStore.getState().addLog(
    'combat',
    `⚡ Uso Rápido: ${c.name} gasta 1 PE para usar ${nomeItem ?? 'um item'} adicional sem gastar ação.`,
  );
  return { ok: true };
}

/**
 * Especialista em Combate — Habilidade de 2º nível: Zona de Risco.
 *
 * Uma vez por rodada, empunhando uma arma CORPO A CORPO com a propriedade
 * Estendida, quando um inimigo se move e termina o movimento dentro do
 * alcance de ataque do Especialista, ele pode gastar 2 PE para atacá-lo.
 *
 * Regras confirmadas:
 *  • Custa só 2 PE (não gasta reação); limite de 1 vez por rodada.
 *  • Pergunta automática ao confirmar o movimento do inimigo no mapa.
 *  • Qualquer movimento que termine dentro do alcance ativa (mesmo se já estava).
 *  • Vale em qualquer turno.
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { findWeaponByName, hasProperty } from '@/lib/weapons';
import { golpeFalsoAlcanceM, golpeFalsoDistancia } from '@/lib/golpeFalso';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';

export const ZONA_RISCO_ID = 'ec-zona-risco';
export const ZONA_RISCO_CUSTO = 2;

export function hasZonaRisco(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ZONA_RISCO_ID);
}

/** Arma corpo a corpo com Estendida na mão principal. */
export function zonaRiscoArmaOk(c: Character): boolean {
  const w = c.mainHandWeaponName ? findWeaponByName(c.mainHandWeaponName) : null;
  return !!w && w.range === 'melee' && hasProperty(w, 'estendida');
}

export function saoInimigos(a: Character, b: Character): boolean {
  const ia = a.category === 'INIMIGO';
  const ib = b.category === 'INIMIGO';
  return ia !== ib;
}

export function zonaRiscoPodeUsar(esp: Character, alvo: Character, round: number): { ok: boolean; reason?: string } {
  if (!hasZonaRisco(esp)) return { ok: false, reason: 'não possui Zona de Risco' };
  if (!zonaRiscoArmaOk(esp)) return { ok: false, reason: 'exige arma corpo a corpo com Estendida' };
  if (!saoInimigos(esp, alvo)) return { ok: false, reason: 'o alvo não é inimigo' };
  if (esp.zonaRiscoRound === round) return { ok: false, reason: 'já usada nesta rodada' };
  if ((esp.peCurrent ?? 0) < ZONA_RISCO_CUSTO) return { ok: false, reason: `PE insuficiente (${esp.peCurrent ?? 0}/${ZONA_RISCO_CUSTO})` };
  if ((esp.hpCurrent ?? 1) <= 0) return { ok: false, reason: 'está caído' };
  const alc = golpeFalsoAlcanceM(esp);
  const d = golpeFalsoDistancia(esp.id, alvo.id);
  if (alc === null || d === null) return { ok: false, reason: 'sem peça no mapa' };
  if (d > alc + 0.05) return { ok: false, reason: 'fora do alcance' };
  return { ok: true };
}

export interface ZonaRiscoPedido {
  id: string;
  espId: string;
  espName: string;
  alvoId: string;
  alvoName: string;
}

interface ZonaState {
  fila: ZonaRiscoPedido[];
  /** Ataque liberado aguardando rolagem na ficha do Especialista. */
  ataque: { espId: string; alvoId: string } | null;
  setFila: (f: ZonaRiscoPedido[]) => void;
  setAtaque: (a: ZonaState['ataque']) => void;
}

export const useZonaRiscoStore = create<ZonaState>((set) => ({
  fila: [],
  ataque: null,
  setFila: (fila) => set({ fila }),
  setAtaque: (ataque) => set({ ataque }),
}));

/** Chamado ao confirmar o movimento de uma peça em combate. */
export function detectarZonaRisco(movingCharId: string): ZonaRiscoPedido[] {
  const cb = useCombatStore.getState();
  if (!cb.inCombat) return [];
  const round = cb.round ?? 1;
  const cs = useCharacterStore.getState().characters;
  const alvo = cs.find((x) => x.id === movingCharId);
  if (!alvo) return [];
  const novos: ZonaRiscoPedido[] = [];
  for (const esp of cs) {
    if (esp.id === alvo.id || !hasZonaRisco(esp)) continue;
    if (!zonaRiscoPodeUsar(esp, alvo, round).ok) continue;
    novos.push({ id: `${Date.now().toString(36)}-${esp.id}`, espId: esp.id, espName: esp.name, alvoId: alvo.id, alvoName: alvo.name });
  }
  if (novos.length) {
    const st = useZonaRiscoStore.getState();
    const fila = st.fila.filter((p) => !novos.some((n) => n.espId === p.espId));
    st.setFila([...fila, ...novos]);
  }
  return novos;
}

/** Resolve a pergunta: aceitar gasta 2 PE, marca a rodada e libera o ataque. */
export function responderZonaRisco(pedidoId: string, aceitar: boolean): { ok: boolean; reason?: string } {
  const st = useZonaRiscoStore.getState();
  const p = st.fila.find((x) => x.id === pedidoId);
  if (!p) return { ok: false, reason: 'pedido inexistente' };
  st.setFila(st.fila.filter((x) => x.id !== pedidoId));
  if (!aceitar) return { ok: true };
  const cs = useCharacterStore.getState().characters;
  const esp = cs.find((x) => x.id === p.espId);
  const alvo = cs.find((x) => x.id === p.alvoId);
  const round = useCombatStore.getState().round ?? 1;
  if (!esp || !alvo) return { ok: false, reason: 'personagem não encontrado' };
  const chk = zonaRiscoPodeUsar(esp, alvo, round);
  if (!chk.ok) {
    useLogStore.getState().addLog('combat', `🚫 Zona de Risco: ${chk.reason}.`);
    return chk;
  }
  useCharacterStore.getState().updateCharacter(esp.id, {
    peCurrent: (esp.peCurrent ?? 0) - ZONA_RISCO_CUSTO,
    zonaRiscoRound: round,
  });
  useZonaRiscoStore.getState().setAtaque({ espId: esp.id, alvoId: alvo.id });
  useLogStore.getState().addLog('combat', `⚔️ Zona de Risco: ${esp.name} gasta ${ZONA_RISCO_CUSTO} PE para atacar ${alvo.name}, que entrou no seu alcance.`);
  return { ok: true };
}

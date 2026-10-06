import { create } from 'zustand';
import { useMapStore, type Entity } from './useMapStore';
import { useCharacterStore } from './useCharacterStore';
import { distanciaBordaEntreFichas, distanciaCircularEntreFichas, tokenDentroDoAlcanceBorda, tokenDentroDoAlcanceCircular } from '@/lib/mapa/alcanceCircular';
import { resolverTokenDaFicha, resolverTokensDaFicha } from '@/lib/mapa/tokenDaFicha';
import type { Character } from '@/types';

export type PedidoAlvoMapa = {
  usuarioId: string; label: string; maxRangeMeters: number; maxAlvos?: number;
  medicao?: 'circular' | 'borda';
  aceita?: (alvo: Character) => boolean;
};
let resolver: ((ids: string[] | null) => void) | null = null;
export const useAlvoMapaStore = create<{ pending: PedidoAlvoMapa | null; selecionados: string[]; erro: string | null }>(() => ({ pending: null, selecionados: [], erro: null }));
export function tokenDaFicha(char: Character): Entity | undefined {
  const ms = useMapStore.getState();
  return resolverTokenDaFicha(char, ms.entities, ms.layerVisible);
}
export function alvosNoAlcance(pedido: PedidoAlvoMapa): Character[] {
  const chars = useCharacterStore.getState().characters;
  const u = chars.find(c => c.id === pedido.usuarioId);
  if (!u || !tokenDaFicha(u)) return [];
  const ms = useMapStore.getState();
  return chars.filter(a => {
    if (!resolverTokensDaFicha(a, ms.entities, ms.layerVisible).length || (pedido.aceita ? !pedido.aceita(a) : a.id === u.id)) return false;
    const d = pedido.medicao === 'borda'
      ? distanciaBordaEntreFichas(u, a, ms.entities, ms.layerVisible, ms.gridConfig)
      : distanciaCircularEntreFichas(u, a, ms.entities, ms.layerVisible, ms.gridConfig);
    // O construtor OMNI define 0 como alcance livre; não o trate como um
    // círculo de raio zero na seleção do mapa.
    return d !== null && (pedido.maxRangeMeters === 0 || d <= pedido.maxRangeMeters + 0.05);
  });
}
export function terminarAlvoMapa(ids: string[] | null) {
  const r = resolver; resolver = null;
  useAlvoMapaStore.setState({ pending: null, selecionados: [], erro: null });
  r?.(ids);
}
export function clicarAlvoMapa(entityId: string): boolean {
  const s = useAlvoMapaStore.getState(); if (!s.pending) return false;
  const e = useMapStore.getState().entities[entityId];
  const valido = e && !e.hidden && !e.carriedBy && (e.layer ?? 'tokens') === 'tokens' && useMapStore.getState().layerVisible[e.layer ?? 'tokens'] !== false;
  const ms = useMapStore.getState();
  const personagens = useCharacterStore.getState().characters;
  const usuario = personagens.find(c => c.id === s.pending!.usuarioId);
  const origens = usuario ? resolverTokensDaFicha(usuario, ms.entities, ms.layerVisible) : [];
  const profileIds = valido && e ? new Set([e.avatarProfileId, e.ownerProfileId].filter((id): id is string => !!id)) : new Set<string>();
  const fichasToken = valido && e?.characterId
    ? personagens.filter(c => c.id === e.characterId)
    : profileIds.size
      ? personagens.filter(c => !!c.profileId && profileIds.has(c.profileId))
      : [];
  const identidadeInequivoca = fichasToken.length === 1;
  const fichaToken = identidadeInequivoca ? fichasToken[0] : undefined;
  const alvo = fichaToken && alvosNoAlcance(s.pending).some(c => c.id === fichaToken.id) &&
    (s.pending.maxRangeMeters === 0 || (s.pending.medicao === 'borda'
      ? tokenDentroDoAlcanceBorda(origens, e!, ms.gridConfig, s.pending.maxRangeMeters)
      : tokenDentroDoAlcanceCircular(origens, e!, ms.gridConfig, s.pending.maxRangeMeters)))
    ? fichaToken
    : undefined;
  if (!alvo) { useAlvoMapaStore.setState({ erro: 'Escolha um token válido dentro do alcance.' }); return true; }
  if ((s.pending.maxAlvos ?? 1) <= 1) terminarAlvoMapa([alvo.id]);
  else {
    const ids = s.selecionados.includes(alvo.id) ? s.selecionados.filter(id => id !== alvo.id) : [...s.selecionados, alvo.id];
    if (ids.length > s.pending.maxAlvos!) useAlvoMapaStore.setState({ erro: `Máximo de ${s.pending.maxAlvos} alvos.` });
    else useAlvoMapaStore.setState({ selecionados: ids, erro: null });
  }
  return true;
}
export function pedirAlvoMapa(pedido: PedidoAlvoMapa): Promise<string[] | null> {
  terminarAlvoMapa(null);
  const u = useCharacterStore.getState().characters.find(c => c.id === pedido.usuarioId);
  if (!u || !tokenDaFicha(u)) return Promise.reject(new Error('Coloque o personagem no mapa antes de atacar.'));
  if (!Number.isFinite(pedido.maxRangeMeters) || pedido.maxRangeMeters < 0) return Promise.reject(new Error('Defina um alcance válido para a ação.'));
  if (!Number.isSafeInteger(pedido.maxAlvos ?? 1) || (pedido.maxAlvos ?? 1) < 1) return Promise.reject(new Error('Defina um número positivo de alvos.'));
  useAlvoMapaStore.setState({ pending: pedido, selecionados: [], erro: null });
  const promise = new Promise<string[] | null>(r => { resolver = r; });
  window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'mapa' }));
  return promise;
}

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__alvoMapa = { store: useAlvoMapaStore, alvosNoAlcance, terminar: terminarAlvoMapa };
}

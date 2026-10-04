import { create } from 'zustand';
import { useMapStore, type Entity } from './useMapStore';
import { useCharacterStore } from './useCharacterStore';
import { distanciaCircularMetros } from '@/lib/mapa/alcanceCircular';
import { resolverTokenDaFicha } from '@/lib/mapa/tokenDaFicha';
import type { Character } from '@/types';

export type PedidoAlvoMapa = {
  usuarioId: string; label: string; maxRangeMeters: number; maxAlvos?: number;
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
  const origem = u && tokenDaFicha(u);
  if (!u || !origem) return [];
  const ms = useMapStore.getState();
  return chars.filter(a => {
    const alvo = tokenDaFicha(a);
    if (!alvo || (pedido.aceita ? !pedido.aceita(a) : a.id === u.id)) return false;
    const d = distanciaCircularMetros(origem, alvo, ms.gridConfig);
    return d !== null && d <= pedido.maxRangeMeters + 0.05;
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
  const alvo = valido ? alvosNoAlcance(s.pending).find(c => tokenDaFicha(c)?.id === e?.id) : undefined;
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

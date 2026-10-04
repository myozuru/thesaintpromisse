import { useMapStore } from '@/stores/useMapStore';
import { getSocket } from '@/lib/socket';

export interface MovimentoConfirmadoMapa {
  id: string;
  sceneId: string;
  entityId: string;
  characterId: string;
  de: { x: number; y: number };
  para: { x: number; y: number };
  trajetoria: { x: number; y: number }[];
  teleporte: boolean;
}
let previa = 0;
const ouvintes = new Set<(movimento: MovimentoConfirmadoMapa) => void>();
const recebidos = new Set<string>();
export const emPreviaMovimento = () => previa > 0;
export function comPreviaMovimento<T>(fn: () => T): T {
  previa++;
  try { return fn(); } finally { previa--; }
}
export function observarMovimentoConfirmado(fn: (m: MovimentoConfirmadoMapa) => void) {
  ouvintes.add(fn); return () => { ouvintes.delete(fn); };
}
function entregar(m: MovimentoConfirmadoMapa) {
  if (recebidos.has(m.id)) return false;
  recebidos.add(m.id);
  if (recebidos.size > 2048) recebidos.delete(recebidos.values().next().value!);
  for (const fn of [...ouvintes]) fn(m);
  return true;
}
const pontoValido = (p: unknown): p is { x: number; y: number } => !!p && typeof p === 'object' && Number.isFinite((p as { x?: number }).x) && Number.isFinite((p as { y?: number }).y);
/** A prévia já moveu a peça; este commit publica somente a trajetória aceita. */
export function confirmarMovimentoMapa(entityId: string, de: { x: number; y: number }, trajetoria: { x: number; y: number }[] = [], teleporte = false) {
  const ms = useMapStore.getState(), e = ms.entities[entityId];
  if (!e?.characterId || !pontoValido(de) || !pontoValido(e) || (e.x === de.x && e.y === de.y && !trajetoria.length)) return;
  const m: MovimentoConfirmadoMapa = { id: crypto.randomUUID(), sceneId: ms.activeSceneId, entityId, characterId: e.characterId, de, para: { x: e.x, y: e.y }, trajetoria: trajetoria.filter(pontoValido).slice(-1024), teleporte };
  entregar(m);
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __worldBus?: { send: (message: unknown) => unknown }; __worldBusClientId?: string };
  const payload = { clientId: w.__worldBusClientId, patches: [{ id: entityId, patch: { x: e.x, y: e.y } }], movimentoOmni: m };
  try { void w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload }); getSocket()?.emit('entity:patch', payload); } catch { /* offline */ }
}
/** Mesma confirmação via dois transportes só produz efeitos uma vez. */
export function receberMovimentoConfirmado(m: MovimentoConfirmadoMapa): boolean {
  const ms = useMapStore.getState(), e = ms.entities[m?.entityId];
  if (!m || typeof m.id !== 'string' || !m.id || m.sceneId !== ms.activeSceneId || !e || e.characterId !== m.characterId || !pontoValido(m.de) || !pontoValido(m.para) || !Array.isArray(m.trajetoria) || m.trajetoria.length > 1024 || !m.trajetoria.every(pontoValido) || typeof m.teleporte !== 'boolean' || recebidos.has(m.id)) return false;
  comPreviaMovimento(() => ms.updateEntity(e.id, { x: m.para.x, y: m.para.y }));
  return entregar(m);
}

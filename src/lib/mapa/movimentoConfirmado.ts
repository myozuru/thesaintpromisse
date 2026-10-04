import { useMapStore } from '@/stores/useMapStore';
import { getSocket } from '@/lib/socket';

export interface MovimentoConfirmadoMapa {
  at?: number;
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
  for (const fn of [...ouvintes]) { try { fn(m); } catch (err) { console.warn('[OMNI movimento] erro no listener', err); } }
  return true;
}
const pontoValido = (p: unknown): p is { x: number; y: number } => !!p && typeof p === 'object' && Number.isFinite((p as { x?: number }).x) && Number.isFinite((p as { y?: number }).y);
/** A prévia já moveu a peça; este commit publica somente a trajetória aceita. */
export function confirmarMovimentoMapa(entityId: string, de: { x: number; y: number }, trajetoria: { x: number; y: number }[] = [], teleporte = false) {
  const ms = useMapStore.getState(), e = ms.entities[entityId];
  if (!e?.characterId || e.carriedBy || (e.layer ?? 'tokens') !== 'tokens' || !pontoValido(de) || !pontoValido(e) || (e.x === de.x && e.y === de.y && !trajetoria.length)) return;
  const m: MovimentoConfirmadoMapa = { at: Math.max(Date.now(), (e._omniMoveAt ?? 0) + 1), id: crypto.randomUUID(), sceneId: ms.activeSceneId, entityId, characterId: e.characterId, de, para: { x: e.x, y: e.y }, trajetoria: trajetoria.filter(pontoValido).slice(-1024), teleporte };
  comPreviaMovimento(() => ms.updateEntity(e.id, { _omniMoveAt: m.at, _omniMoveId: m.id }));
  entregar(m);
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __worldBus?: { send: (message: unknown) => unknown }; __worldBusClientId?: string };
  const payload = { clientId: w.__worldBusClientId, patches: [{ id: entityId, patch: { x: e.x, y: e.y } }], movimentoOmni: m };
  try { void w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload }); getSocket()?.emit('entity:patch', payload); } catch { /* offline */ }
}
/** Mesma confirmação via dois transportes só produz efeitos uma vez. */
export function receberMovimentoConfirmado(m: MovimentoConfirmadoMapa, aposAtualizar?: () => void): boolean {
  const ms = useMapStore.getState(), e = ms.entities[m?.entityId];
  if (!m || typeof m.id !== 'string' || !m.id || m.sceneId !== ms.activeSceneId || !e || e.carriedBy || (e.layer ?? 'tokens') !== 'tokens' || e.characterId !== m.characterId || !pontoValido(m.de) || !pontoValido(m.para) || !Array.isArray(m.trajetoria) || m.trajetoria.length > 1024 || !m.trajetoria.every(pontoValido) || typeof m.teleporte !== 'boolean' || recebidos.has(m.id)) return false;
  if (m.at !== undefined && (!Number.isSafeInteger(m.at) || m.at < 0)) return false;
  if (e._omniMoveAt !== undefined && (m.at === undefined || m.at < e._omniMoveAt || m.at === e._omniMoveAt && m.id <= (e._omniMoveId ?? ''))) return false;
  comPreviaMovimento(() => ms.updateEntity(e.id, { x: m.para.x, y: m.para.y, _omniMoveAt: m.at ?? Date.now(), _omniMoveId: m.id }));
  aposAtualizar?.();
  return entregar(m);
}

/** Prévia antiga não reverte uma confirmação já persistida. */
export function previaDepoisDaConfirmacao(entity: { _omniMoveAt?: number }, at: unknown): boolean {
  return entity._omniMoveAt === undefined || typeof at === 'number' && Number.isSafeInteger(at) && at > entity._omniMoveAt;
}

import { getSocket } from '@/lib/socket';

export interface MapEntityPatch {
  id: string;
  patch: Record<string, unknown>;
}

/** Publica alterações pontuais do token pelos canais compartilhados da sala. */
export function broadcastEntityPatches(patches: MapEntityPatch[]): void {
  if (!patches.length || typeof window === 'undefined') return;
  const w = window as unknown as {
    __worldBus?: { send: (message: unknown) => void };
    __worldBusClientId?: string;
  };
  const payload = { clientId: w.__worldBusClientId, at: Date.now(), patches };
  try { w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload }); } catch { /* canal indisponível */ }
  try { getSocket()?.emit('entity:patch', payload); } catch { /* canal indisponível */ }
}

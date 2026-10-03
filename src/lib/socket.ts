import { io, Socket } from 'socket.io-client';

/**
 * Cliente Socket.IO singleton.
 *
 * Conecta na MESMA origem da janela (sem URL fixa) — assim funciona tanto
 * em dev (via proxy do Vite em /socket.io → localhost:3001) quanto exposto
 * via Cloudflare Tunnel ou rede local.
 */
let socket: Socket | null = null;

/**
 * Multiplayer é ligado por padrão e conecta na MESMA ORIGEM da janela:
 * - Em dev, o Vite faz proxy de `/socket.io` para o `server.js` (localhost:3001).
 * - Em prod/tunnel, o mesmo host serve o socket.
 *
 * Para desligar explicitamente (ex.: build standalone sem backend), defina
 * `VITE_SOCKET_URL=off` no `.env.local`. Qualquer outra URL é usada como destino.
 */
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const envUrl = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SOCKET_URL;
  if (envUrl && envUrl.toLowerCase() === 'off') return null;
  const url = envUrl && envUrl.trim().length > 0 ? envUrl : window.location.origin;
  if (!socket) {
    socket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
    });

    let warnedOnce = false;
    socket.on('connect', () => console.log('[socket] conectado:', socket?.id));
    socket.on('disconnect', (r) => console.log('[socket] desconectado:', r));
    socket.on('connect_error', (e) => {
      // Evita spam: só loga o primeiro erro até reconectar.
      if (!warnedOnce) {
        console.warn('[socket] sem servidor local em /socket.io — multiplayer offline:', e.message);
        warnedOnce = true;
      }
    });
    socket.on('connect', () => { warnedOnce = false; });
  }
  return socket;
}


export type WorldSlice =
  | 'characters'
  | 'combat'
  | 'chronos'
  | 'logs'
  | 'profiles'
  | 'money'
  | 'items'
  | 'calendar'
  | 'spellProposals'
  | 'establishments'
  | 'discounts'
  | 'omniInventory'
  | 'omniEntidades'
  | 'omniRuntime'
  | 'omniSpatial'
  | 'omniProposals'
  | 'mapScene'
  | 'testRequests'
  | 'tempTemplates'
  | 'fog'
  | 'worldMap'
  | 'worldBosses';


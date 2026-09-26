/**
 * Mesa simulada: várias "telas" (Mestre, jogadores) ligadas por um canal em memória
 * que imita o broadcast da nuvem (self:false). Permite testar fluxos multiplayer
 * em milissegundos, sem abrir navegadores nem criar contas.
 */
export type Viewer = { name: string; role: 'MASTER' | 'PLAYER'; profileId: string | null };

export interface FakeClient<S> {
  id: string;
  viewer: Viewer;
  state: S;
  inbox: unknown[];
  send: (event: string, payload: Record<string, unknown>) => void;
}

export function createFakeMesa<S>(
  initial: () => S,
  handlers: Record<string, (client: FakeClient<S>, payload: Record<string, unknown>) => void>,
) {
  const clients: FakeClient<S>[] = [];
  let log: { from: string; event: string; payload: unknown }[] = [];
  const join = (viewer: Viewer): FakeClient<S> => {
    const c: FakeClient<S> = {
      id: `client-${clients.length + 1}`,
      viewer,
      state: initial(),
      inbox: [],
      send(event, payload) {
        const msg = { clientId: c.id, ...payload };
        log.push({ from: c.id, event, payload: msg });
        for (const other of clients) {
          if (other === c) continue; // igual ao broadcast.self = false
          other.inbox.push(msg);
          handlers[event]?.(other, msg);
        }
      },
    };
    clients.push(c);
    return c;
  };
  return {
    join,
    clients,
    get log() { return log; },
    reset() { log = []; clients.forEach((c) => { c.state = initial(); c.inbox = []; }); },
  };
}

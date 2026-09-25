// Sem configuração própria do Cloud, o clone usa apenas o stub offline.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined) as
  | Record<string, string | undefined>
  | undefined;
const url = env?.VITE_SUPABASE_URL;
const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const hasWorkspaceCloud = Boolean(url && key);

function buildStub(): SupabaseClient {
  const offlineResult = Promise.resolve({ data: null, error: null });
  const query = new Proxy({} as Record<string, unknown>, {
    get: (_target, property) => {
      if (property === 'then') return offlineResult.then.bind(offlineResult);
      return () => query;
    },
  });

  const channel = {
    on: () => channel,
    subscribe: (callback?: (status: string) => void) => {
      callback?.('CLOSED');
      return channel;
    },
    send: async () => 'ok',
    unsubscribe: async () => 'ok',
  };

  return {
    from: () => query,
    channel: () => channel,
    removeChannel: () => Promise.resolve('ok'),
  } as unknown as SupabaseClient;
}

let client: SupabaseClient;
if (hasWorkspaceCloud && url && key) {
  client = createClient(url, key, {
    auth: { storage: typeof localStorage !== 'undefined' ? localStorage : undefined, persistSession: true, autoRefreshToken: true },
  });
} else {
  client = buildStub();
}

export const supabase = client;

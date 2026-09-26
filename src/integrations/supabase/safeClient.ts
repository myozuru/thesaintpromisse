// Sem configuração própria do Cloud, o clone usa apenas o stub offline.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as workspaceClient } from './client';

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
  client = workspaceClient as unknown as SupabaseClient;
} else {
  client = buildStub();
}

export const supabase = client;

// Sem configuração própria do Cloud, o clone usa apenas o stub offline.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined) as
  | Record<string, string | undefined>
  | undefined;
const url = env?.VITE_SUPABASE_URL;
const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY;

function buildStub(): SupabaseClient {
  const warn = () => console.warn('[supabase] cliente offline — multiplayer cloud desativado.');
  const queryStub: Record<string, unknown> = {};
  const proxy = new Proxy(queryStub, {
    get: () => () => {
      warn();
      return Promise.resolve({ data: null, error: { message: 'supabase offline' } });
    },
  });
  return {
    from: () => proxy,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => Promise.resolve('ok'),
  } as unknown as SupabaseClient;
}

let client: SupabaseClient;
try {
  if (!url || !key) throw new Error('missing supabase env');
  client = createClient(url, key, {
    auth: { storage: typeof localStorage !== 'undefined' ? localStorage : undefined, persistSession: true, autoRefreshToken: true },
  });
} catch (err) {
  console.warn('[supabase] falha ao inicializar, usando stub:', err);
  client = buildStub();
}

export const supabase = client;

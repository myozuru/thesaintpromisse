import type { SupabaseClient, User } from '@supabase/supabase-js';
import { supabase as typedClient } from '@/integrations/supabase/client';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';

// Cliente sem tipagem estrita (tabelas de conta são novas).
export const authDb = typedClient as unknown as SupabaseClient;

export const NICK_RE = /^[a-z0-9_.-]{3,20}$/;
export const normalizeNick = (n: string) => n.trim().toLowerCase();
export const nickToEmail = (n: string) => `${normalizeNick(n)}@tpfichas.local`;

export interface CloudProfile {
  id: string;
  nick: string;
  avatar: string | null;
}

let applyingUser: Promise<void> | null = null;
let applyingUserId: string | null = null;

/** Sincroniza sessão da conta → papel (Mestre/Player) e perfil local. */
async function applyUserState(user: User) {
  const { data: prof } = await authDb
    .from('profiles')
    .select('id, nick, avatar')
    .eq('id', user.id)
    .maybeSingle();
  let profile = prof as CloudProfile | null;
  if (!profile) {
    const meta = (user.user_metadata ?? {}) as { nick?: string; avatar?: string | null };
    const nick = meta.nick ?? user.email?.split('@')[0] ?? 'jogador';
    const { data: created } = await authDb
      .from('profiles')
      .insert({ id: user.id, nick, avatar: meta.avatar ?? null })
      .select('id, nick, avatar')
      .maybeSingle();
    profile = (created as CloudProfile | null) ?? { id: user.id, nick, avatar: null };
  }

  await authDb.rpc('claim_first_master');
  const { data: isMaster } = await authDb.rpc('has_role', { _user_id: user.id, _role: 'master' });

  // Mantém um perfil local com o mesmo id da conta, para o resto do app.
  if (!profile) throw new Error('Não foi possível carregar o perfil');

  const store = useProfileStore.getState();
  const existing = store.profiles.find((p) => p.id === user.id);
  if (existing) {
    useProfileStore.setState({
      profiles: store.profiles.map((p) =>
        p.id === user.id ? { ...p, name: profile.nick, avatar: profile.avatar } : p,
      ),
    });
  } else {
    useProfileStore.setState({
      profiles: [
        ...store.profiles,
        { id: user.id, name: profile.nick, avatar: profile.avatar, password: null, createdAt: Date.now() },
      ],
    });
  }
  store.setActiveProfile(user.id);
  useRoleStore.getState().setRole(isMaster ? 'MASTER' : 'PLAYER');
}

/** Evita que o evento de sessão e o formulário criem/carreguem o mesmo perfil em paralelo. */
export function applyUser(user: User): Promise<void> {
  if (applyingUser && applyingUserId === user.id) return applyingUser;
  applyingUserId = user.id;
  applyingUser = applyUserState(user).finally(() => {
    applyingUser = null;
    applyingUserId = null;
  });
  return applyingUser;
}

export async function signOutAll() {
  await authDb.auth.signOut();
  useProfileStore.getState().setActiveProfile(null);
  useRoleStore.getState().logout();
}

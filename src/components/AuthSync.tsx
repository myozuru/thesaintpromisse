import { useEffect } from 'react';
import { authDb, applyUser } from '@/lib/auth';
import { useRoleStore } from '@/stores/useRoleStore';

/** Mantém o papel alinhado com a conta logada. Mestre exige conta verificada. */
export function AuthSync() {
  useEffect(() => {
    let alive = true;
    authDb.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (data.user) void applyUser(data.user);
      else if (useRoleStore.getState().role === 'MASTER') useRoleStore.getState().logout();
    });
    const { data: sub } = authDb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) void applyUser(session.user);
      if (event === 'SIGNED_OUT') useRoleStore.getState().logout();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return null;
}

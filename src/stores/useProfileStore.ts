import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Perfis de Player.
 * - Cada perfil é só um identificador (nome + foto + senha opcional) salvo localmente.
 * - Todos os players continuam na MESMA sala multiplayer (mesmo estado de mundo).
 * - A senha do perfil protege quem pode "logar" como aquele perfil.
 * - A senha UNIVERSAL (141204) sempre funciona em qualquer perfil e para excluir.
 */
export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string | null; // dataURL (base64) ou null
  password: string | null; // null = sem senha
  createdAt: number;
}

interface ProfileState {
  profiles: PlayerProfile[];
  activeProfileId: string | null;
  createProfile: (p: Omit<PlayerProfile, 'id' | 'createdAt'>) => PlayerProfile | null;
  updateProfile: (id: string, patch: Partial<Pick<PlayerProfile, 'name' | 'avatar' | 'password'>>) => void;
  isProfileNameTaken: (name: string, excludeId?: string) => boolean;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
}

const newId = () => `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const normName = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      isProfileNameTaken: (name, excludeId) => {
        const target = normName(name);
        if (!target) return false;
        return get().profiles.some((p) => p.id !== excludeId && normName(p.name) === target);
      },
      createProfile: (p) => {
        const target = normName(p.name);
        if (!target) return null;
        const taken = get().profiles.some((existing) => normName(existing.name) === target);
        if (taken) return null;
        const profile: PlayerProfile = { ...p, id: newId(), createdAt: Date.now() };
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return profile;
      },
      updateProfile: (id, patch) =>
        set((s) => {
          let safePatch = patch;
          if (typeof patch.name === 'string') {
            const target = normName(patch.name);
            const conflict = s.profiles.some(
              (p) => p.id !== id && normName(p.name) === target,
            );
            if (conflict || !target) {
              const { name: _ignored, ...rest } = patch;
              safePatch = rest;
            }
          }
          return {
            profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...safePatch } : p)),
          };
        }),
      deleteProfile: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
        })),
      setActiveProfile: (id) => set({ activeProfileId: id }),
    }),
    { name: 'rpg-profiles' }
  )
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__profileStore = useProfileStore;
}

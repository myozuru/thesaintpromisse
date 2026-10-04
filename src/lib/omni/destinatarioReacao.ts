import type { Character } from '@/types';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';

export const DESTINATARIO_MESTRE = '@mestre';
export function destinatarioReacao(c: Pick<Character, 'category' | 'profileId'>): string {
  return c.category === 'PLAYER' && c.profileId ? c.profileId : DESTINATARIO_MESTRE;
}
export function podeResponderReacao(destinatario: string): boolean {
  const role = useRoleStore.getState().role;
  return destinatario === DESTINATARIO_MESTRE ? role === 'MASTER'
    : role === 'PLAYER' && useProfileStore.getState().activeProfileId === destinatario;
}

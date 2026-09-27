import type { Character } from '@/types';
import type { TestRequest } from '@/stores/useTestRequestStore';

export type TestRequestViewerRole = 'MASTER' | 'PLAYER' | null;

/** Resolve quem pode executar um pedido sem deixar fichas sem dono vazarem para outros jogadores. */
export function canViewerRollTestRequest(
  request: TestRequest,
  character: Character | undefined,
  role: TestRequestViewerRole,
  activeProfileId: string | null | undefined,
): boolean {
  if (!character) return false;

  const targetProfileId = request.targetProfileId ?? character.profileId;
  if (character.category === 'PLAYER' && targetProfileId) {
    return role === 'PLAYER' && activeProfileId === targetProfileId;
  }

  return role === 'MASTER';
}

/** Pedidos ligados a um perfil são rolados pelo jogador e apenas acompanhados pelo Mestre. */
export function isPlayerOwnedTestRequest(
  request: TestRequest,
  character: Character | undefined,
): boolean {
  if (!character) return true;
  return character.category === 'PLAYER' && Boolean(request.targetProfileId ?? character.profileId);
}
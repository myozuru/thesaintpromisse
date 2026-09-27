export type DiceLaunchGuard = { armed: boolean };

/**
 * Consome o estado armado de forma síncrona. Eventos de ponteiro podem chegar
 * várias vezes antes do React renderizar; somente o primeiro pode lançar.
 */
export function claimDiceLaunch(guard: DiceLaunchGuard): boolean {
  if (!guard.armed) return false;
  guard.armed = false;
  return true;
}
import type { Weapon } from '@/lib/weapons';
import type { AttackResult } from '@/lib/combatEngine';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { distanceBetweenChars } from '@/lib/weaponRange';
import { montarMetadadosDano, type MetadadosAtaqueDano } from './contextoDano';
import { emitirEvento } from './eventBus';

/** O resultado confirmado do ataque é um evento, não apenas uma linha no log. */
export function notificarResultadoAtaque(usuarioId: string, alvoId: string | undefined, arma: Weapon, resultado: Pick<AttackResult, 'hit' | 'critical' | 'criticalFail' | 'cancelled'>, meta: MetadadosAtaqueDano = {}, fonte: 'arma' | 'omni' = 'arma') {
  if (!alvoId || resultado.cancelled) return;
  const chars = useCharacterStore.getState().characters;
  const u = chars.find(c => c.id === usuarioId), alvo = chars.find(c => c.id === alvoId);
  if (!u || !alvo) return;
  const mapa = useMapStore.getState();
  const distancia = distanceBetweenChars(usuarioId, alvoId, mapa.entities, mapa.gridConfig, { casterProfileId: u.profileId, targetProfileId: alvo.profileId });
  emitirEvento(resultado.hit ? 'aoAcertarAtaque' : 'aoErrarAtaque', {
    usuarioId, alvoId, origemNome: arma.name,
    dano: montarMetadadosDano({ source: fonte, attack: { ...meta, kind: arma.range === 'melee' ? 'melee' : 'ranged', critical: resultado.critical, criticalFail: resultado.criticalFail } }, distancia),
  });
}

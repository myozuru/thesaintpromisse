/**
 * Especialista em Combate — Artes do Combate: Técnicas de Avanço (4º nível).
 *  • Avanço Bumerangue (3 PP): na ação Atacar, salta até 6 m em direção a um
 *    inimigo a até 6 m (jogador escolhe onde parar), ataca e volta ao ponto de
 *    partida. Sem AdO. No retorno, 1 PP: ataque de arremesso/distância no mesmo alvo.
 *  • Sombra Descendente (3 PP, Ação Comum): avança até um inimigo a até 6 m e
 *    ataca; opcionalmente ataca outro inimigo a até 6 m do primeiro e cai num
 *    espaço livre a até 3 m dele (escolhido no mapa). Sem outro alvo, fica ao lado do primeiro.
 */
import type { Character } from '@/types';
import type { Entity } from '@/stores/useMapStore';
import { hasArtesCombate } from '@/lib/artesCombate';
import { useMapStore } from '@/stores/useMapStore';

export const TECNICAS_AVANCO_ID = 'ec-tecnicas-avanco';
export const BUMERANGUE_CUSTO = 3;
export const RETORNO_CUSTO = 1;
export const SOMBRA_CUSTO = 3;
export const AVANCO_M = 6;
export const QUEDA_M = 3;

export function hasTecnicasAvanco(c: Character | null | undefined): boolean {
  return !!c && hasArtesCombate(c) && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === TECNICAS_AVANCO_ID);
}

export function entDe(ch: Character): Entity | undefined {
  const ents = Object.values(useMapStore.getState().entities ?? {}) as Entity[];
  return ents.find((e) => e?.characterId === ch.id)
    ?? ents.find((e) => (e?.avatarProfileId ?? e?.ownerProfileId) && (e.avatarProfileId === ch.profileId || e.ownerProfileId === ch.profileId));
}

export function pxPorMetro(): number {
  const g = useMapStore.getState().gridConfig;
  return (g?.dpi || 70) / (g?.metersPerCell || 1.5);
}

export function distPontosM(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y) / pxPorMetro();
}

/** Ponto livre: nenhuma outra peça com centro a menos de meia casa. */
export function pontoLivre(p: { x: number; y: number }, ignorarId?: string): boolean {
  const ents = Object.values(useMapStore.getState().entities ?? {}) as Entity[];
  const g = useMapStore.getState().gridConfig;
  const meia = (g?.dpi || 70) / 2;
  return !ents.some((e) => e && e.id !== ignorarId && e.characterId && Math.hypot(e.x - p.x, e.y - p.y) < meia);
}

/** Pede ao jogador um ponto no mapa (marcador pequeno). */
export async function escolherPonto(label: string, origem: { x: number; y: number }, maxM: number) {
  const t = await useMapStore.getState().requestAoEPlacement({
    kind: 'circle', sizeMeters: 0.75, sourceLabel: label, color: '#f5b342', originWorld: origem, maxRangeMeters: maxM,
  });
  return t ? { x: t.x, y: t.y } : null;
}

/** Posição a `passoM` metros de `de` em direção a `para`. */
export function passoEmDirecao(de: { x: number; y: number }, para: { x: number; y: number }, passoM: number) {
  const d = distPontosM(de, para);
  if (d <= 0) return { x: de.x, y: de.y };
  const f = Math.min(1, passoM / d);
  return { x: de.x + (para.x - de.x) * f, y: de.y + (para.y - de.y) * f };
}

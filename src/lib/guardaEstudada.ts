/**
 * Especialista em Combate — Habilidade de 4º nível: Guarda Estudada.
 *
 * Você soma METADE do seu modificador de Sabedoria na Defesa, limitado pelo
 * seu nível de personagem. Além disso, escolhe UM Teste de Resistência para
 * receber +2 (a escolha pode ser trocada em um descanso).
 *
 * Regras de borda:
 *  • Mod. SAB positivo → ⌊mod ÷ 2⌋, teto = nível do personagem.
 *  • Mod. SAB negativo → a metade (arredondada para baixo) entra como
 *    PENALIDADE na Defesa; o teto por nível não se aplica a penalidades.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';

export const GUARDA_ESTUDADA_ID = 'ec-guarda-estudada';
export const GUARDA_ESTUDADA_TR_BONUS = 2;

export type SaveName = 'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade' | 'Integridade';

export const GUARDA_ESTUDADA_SAVES: SaveName[] = [
  'Astúcia', 'Fortitude', 'Integridade', 'Reflexos', 'Vontade',
];

export function hasGuardaEstudada(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === GUARDA_ESTUDADA_ID);
}

/** Modificador de Sabedoria da ficha (valor + bônus externo). */
export function guardaEstudadaSabMod(c: Character): number {
  const attr = (c.attributes ?? []).find((a) => (a.name ?? '').toLowerCase().startsWith('sabed'));
  if (!attr) return 0;
  return Math.floor((((attr.value ?? 10) + (attr.externalBonus ?? 0)) - 10) / 2);
}

/** Delta de Defesa concedido (ou penalizado) pela habilidade. */
export function guardaEstudadaDefesa(c: Character | null | undefined): number {
  if (!c || !hasGuardaEstudada(c)) return 0;
  const half = Math.floor(guardaEstudadaSabMod(c) / 2);
  if (half <= 0) return half;
  return Math.min(half, Math.max(1, c.level ?? 1));
}

function normalize(s: string): string {
  return (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** TR escolhido para o +2 (null enquanto a escolha estiver pendente). */
export function guardaEstudadaSave(c: Character | null | undefined): SaveName | null {
  if (!c || !hasGuardaEstudada(c)) return null;
  const v = c.specAbilityChoices?.[GUARDA_ESTUDADA_ID];
  if (v && v.kind === 'save') return v.save as SaveName;
  return null;
}

/** +2 quando o teste pedido é o TR escolhido. */
export function guardaEstudadaTrBonus(
  c: Character | null | undefined,
  testName: string,
  isSave = true,
): number {
  if (!isSave) return 0;
  const escolhido = guardaEstudadaSave(c);
  if (!escolhido) return 0;
  return normalize(escolhido) === normalize(testName) ? GUARDA_ESTUDADA_TR_BONUS : 0;
}

import type { Character } from '@/types';
import { getTrainingBonus, getLevelSkillBonus } from '@/types';
import { getAttrModifier } from '@/components/fichas/CharacterCard';

/** Bônus de perícia da ficha (½ nível + atributo + treino + externo + inspiração). */
export function bonusPericia(c: Character, nome: string): number {
  const sk = c.skills.find((s) => s.name === nome);
  if (!sk) return 0;
  const level = c.level || 1;
  const linked = sk.linkedAttribute ? c.attributes.find((a) => a.name === sk.linkedAttribute) : undefined;
  return (linked ? getAttrModifier(linked.value) : 0) + getTrainingBonus(level, sk.trained, sk.mastery)
    + getLevelSkillBonus(level) + (sk.externalBonus ?? 0) + (c.inspiracaoBonus ?? 0);
}
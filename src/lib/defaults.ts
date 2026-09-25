import { Attribute } from '@/types';

/** Atributos básicos atribuídos por padrão a toda nova ficha. */
export const DEFAULT_ATTRIBUTE_NAMES = [
  'Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Presença',
] as const;

/** Perícias básicas (com atributo vinculado) atribuídas por padrão. */
export interface DefaultSkill {
  name: string;
  linkedAttr: string;
}

export const DEFAULT_SKILLS: DefaultSkill[] = [
  { name: 'Atletismo', linkedAttr: 'Força' },
  { name: 'Acrobacia', linkedAttr: 'Destreza' },
  { name: 'Furtividade', linkedAttr: 'Destreza' },
  { name: 'Prestidigitação', linkedAttr: 'Destreza' },
  { name: 'Feitiçaria', linkedAttr: 'Inteligência' },
  { name: 'História', linkedAttr: 'Inteligência' },
  { name: 'Investigação', linkedAttr: 'Inteligência' },
  { name: 'Ofício 1', linkedAttr: 'Inteligência' },
  { name: 'Ofício 2', linkedAttr: 'Inteligência' },
  { name: 'Ofício 3', linkedAttr: 'Inteligência' },
  { name: 'Tecnologia', linkedAttr: 'Inteligência' },
  { name: 'Teologia', linkedAttr: 'Inteligência' },
  { name: 'Direção', linkedAttr: 'Sabedoria' },
  { name: 'Intuição', linkedAttr: 'Sabedoria' },
  { name: 'Medicina', linkedAttr: 'Sabedoria' },
  { name: 'Ocultismo', linkedAttr: 'Sabedoria' },
  { name: 'Percepção', linkedAttr: 'Sabedoria' },
  { name: 'Sobrevivência', linkedAttr: 'Sabedoria' },
  { name: 'Enganação', linkedAttr: 'Presença' },
  { name: 'Intimidação', linkedAttr: 'Presença' },
  { name: 'Performance', linkedAttr: 'Presença' },
  { name: 'Persuasão', linkedAttr: 'Presença' },
];

export function buildDefaultAttributes(): Attribute[] {
  return DEFAULT_ATTRIBUTE_NAMES.map((name) => ({
    id: crypto.randomUUID(),
    name,
    value: 10,
  }));
}

/** Cria perícias padrão já vinculadas (por nome) aos atributos básicos passados. */
export function buildDefaultSkills(attrs: Attribute[]): Attribute[] {
  const byName = new Map(attrs.map((a) => [a.name, a.id]));
  return DEFAULT_SKILLS.map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    value: 0,
    linkedAttribute: byName.get(s.linkedAttr) ?? '',
    trained: false,
    mastery: false,
    externalBonus: 0,
  }));
}

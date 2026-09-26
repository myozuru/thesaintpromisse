/**
 * useTempTemplateStore — presets de fichas temporárias.
 *
 * O Mestre salva snapshots de fichas temporárias ("Goblin 10 HP", "Mago 25/15
 * com RD fogo 5") e clona em 1 clique. Cada template guarda os campos que
 * importam para mestrar fora do sistema: HP/PE máximos, deslocamento, RD
 * geral, RD por tipo, anotações e bônus base de atributos/perícias/TRs.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Character, DamageType } from '@/types';

export interface TempTemplate {
  id: string;
  label: string;
  createdAt: string;
  data: {
    hpMax: number;
    peMax: number;
    movement: number;
    rd: number;
    rdByType: Record<DamageType, number>;
    notes?: string;
    /** Bônus simples por nome de atributo/perícia/TR. */
    attributes?: Record<string, number>;
    skills?: Record<string, number>;
    saves?: Record<string, number>;
  };
}

interface State {
  templates: TempTemplate[];
  addFromCharacter: (label: string, c: Character) => string;
  remove: (id: string) => void;
  rename: (id: string, label: string) => void;
}

export function createTempTemplate(label: string, c: Character, id: string = crypto.randomUUID()): TempTemplate {
  const attributes: Record<string, number> = {};
  (c.attributes ?? []).forEach((a) => { attributes[a.name] = a.value ?? 10; });
  const skills: Record<string, number> = {};
  (c.skills ?? []).forEach((s) => { skills[s.name] = s.externalBonus ?? 0; });
  const saves: Record<string, number> = {};
  (c.savingThrows ?? []).forEach((s) => { saves[s.name] = s.value ?? 0; });
  return {
    id,
    label: label.trim() || c.name,
    createdAt: new Date().toISOString(),
    data: {
      hpMax: c.hpMax,
      peMax: c.peMax,
      movement: c.movement,
      rd: c.rd ?? 0,
      rdByType: { ...c.rdByType },
      notes: c.notes ?? '',
      attributes,
      skills,
      saves,
    },
  };
}

export function mergeTempTemplates(local: TempTemplate[], remote: TempTemplate[]): TempTemplate[] {
  const merged = new Map<string, TempTemplate>();
  for (const template of remote) merged.set(template.id, template);
  for (const template of local) if (!merged.has(template.id)) merged.set(template.id, template);
  return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function tempTemplateCharacterPatch(c: Character, template: TempTemplate): Partial<Character> {
  const data = template.data;
  return {
    hpMax: data.hpMax,
    hpCurrent: data.hpMax,
    peMax: data.peMax,
    peCurrent: data.peMax,
    movement: data.movement,
    rd: data.rd,
    rdByType: { ...c.rdByType, ...data.rdByType },
    notes: data.notes ?? c.notes,
    attributes: c.attributes.map((a) => ({ ...a, value: data.attributes?.[a.name] ?? a.value })),
    skills: c.skills.map((s) => ({ ...s, externalBonus: data.skills?.[s.name] ?? s.externalBonus })),
    savingThrows: (c.savingThrows ?? []).map((s) => ({ ...s, value: data.saves?.[s.name] ?? s.value })),
  };
}

export const useTempTemplateStore = create<State>()(
  persist(
    (set) => ({
      templates: [],
      addFromCharacter: (label, c) => {
        const tpl = createTempTemplate(label, c);
        set((s) => ({ templates: [tpl, ...s.templates] }));
        return tpl.id;
      },
      remove: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      rename: (id, label) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, label } : t)),
        })),
    }),
    { name: 'rpg-temp-templates' },
  ),
);

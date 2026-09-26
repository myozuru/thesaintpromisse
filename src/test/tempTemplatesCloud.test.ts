import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyRdByType, type Character } from '@/types';
import { createTempTemplate, mergeTempTemplates, tempTemplateCharacterPatch, useTempTemplateStore, type TempTemplate } from '@/stores/useTempTemplateStore';
import { createFakeMesa, type FakeClient } from './helpers/fakeMesa';

const character = {
  id: 'char-1', name: 'Goblin', hpCurrent: 3, hpMax: 10, peCurrent: 1, peMax: 4,
  movement: 9, rd: 2, rdByType: { ...createEmptyRdByType(), DQ: 5 }, notes: 'Emboscador',
  attributes: [{ id: 'for', name: 'Força', value: 14 }],
  skills: [{ id: 'furt', name: 'Furtividade', value: 0, externalBonus: 3 }],
  savingThrows: [{ id: 'ref', name: 'Reflexos', value: 6 }],
} as Character;

const template = (id: string, label: string, createdAt: string): TempTemplate => ({ ...createTempTemplate(label, character, id), createdAt });

describe('modelos temporários compartilhados', () => {
  beforeEach(() => useTempTemplateStore.setState({ templates: [] }));

  it('salva e aplica todos os valores necessários', () => {
    const saved = createTempTemplate('Goblin 10 PV', character, 'tpl-1');
    const target = {
      ...character, hpMax: 1, peMax: 0, movement: 3, rd: 0, rdByType: createEmptyRdByType(), notes: '',
      attributes: [{ id: 'for', name: 'Força', value: 8 }],
      skills: [{ id: 'furt', name: 'Furtividade', value: 0, externalBonus: 0 }],
      savingThrows: [{ id: 'ref', name: 'Reflexos', value: 0 }],
    } as Character;
    const patch = tempTemplateCharacterPatch(target, saved);
    expect(patch).toMatchObject({ hpMax: 10, hpCurrent: 10, peMax: 4, peCurrent: 4, movement: 9, rd: 2, notes: 'Emboscador' });
    expect(patch.rdByType?.DQ).toBe(5);
    expect(patch.attributes?.[0].value).toBe(14);
    expect(patch.skills?.[0].externalBonus).toBe(3);
    expect(patch.savingThrows?.[0].value).toBe(6);
  });

  it('mescla modelos antigos e remotos sem duplicar ids', () => {
    const localOnly = template('local', 'Local', '2026-09-25T10:00:00.000Z');
    const remoteOnly = template('remote', 'Nuvem', '2026-09-26T10:00:00.000Z');
    const sameRemote = template('same', 'Versão da nuvem', '2026-09-26T09:00:00.000Z');
    const sameLocal = { ...sameRemote, label: 'Cópia local antiga' };
    expect(mergeTempTemplates([localOnly, sameLocal], [remoteOnly, sameRemote]).map((t) => [t.id, t.label])).toEqual([
      ['remote', 'Nuvem'], ['same', 'Versão da nuvem'], ['local', 'Local'],
    ]);
  });

  it('propaga criação, edição e exclusão entre duas telas simuladas', () => {
    type SharedState = { templates: TempTemplate[] };
    const mesa = createFakeMesa<SharedState>(() => ({ templates: [] }), {
      slice: (client: FakeClient<SharedState>, payload) => {
        if (payload.slice === 'tempTemplates' && Array.isArray(payload.data)) client.state.templates = structuredClone(payload.data as TempTemplate[]);
      },
    });
    const masterA = mesa.join({ name: 'Mestre A', role: 'MASTER', profileId: 'master-a' });
    const masterB = mesa.join({ name: 'Mestre B', role: 'MASTER', profileId: 'master-b' });
    const saved = template('shared', 'Goblin', '2026-09-26T10:00:00.000Z');
    masterA.state.templates = [saved];
    masterA.send('slice', { slice: 'tempTemplates', data: masterA.state.templates });
    expect(masterB.state.templates[0]?.label).toBe('Goblin');
    masterB.state.templates = [{ ...masterB.state.templates[0], label: 'Goblin Elite' }];
    masterB.send('slice', { slice: 'tempTemplates', data: masterB.state.templates });
    expect(masterA.state.templates[0]?.label).toBe('Goblin Elite');
    masterA.state.templates = [];
    masterA.send('slice', { slice: 'tempTemplates', data: [] });
    expect(masterB.state.templates).toEqual([]);
  });
});
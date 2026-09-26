import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { isProtegidoPreAnalise, preAnaliseShortRestPatch, getRecompensaBonus, recompensaPEPatch, canEscolherAliadoPreAnalise, hasRecompensaNote, maybeApplyRecompensa, RECOMPENSA_SOURCE_TAG } from '@/lib/suportePreAnaliseRecompensa';
import { darComando } from '@/lib/suporteComandoTerreno';
import { consumeFlatBonusFor } from '@/lib/omni/rollAdvantage';

const mk = (o: any) => ({ id: o.id, name: o.id, category: 'PLAYER', level: 5, peCurrent: 10, peMax: 10, activeConditions: [], ...o, chosenSpecAbilities: (o.specAbilities ?? []).map((abilityId: string) => ({ abilityId })) });

describe('Pré-Análise', () => {
  it('protege dono e aliado; outros não', () => {
    const s = mk({ id: 's', specAbilities: ['sup-pre-analise'], preAnaliseAllyId: 'a' });
    const a = mk({ id: 'a' }); const b = mk({ id: 'b' });
    const all = [s, a, b] as any;
    expect(isProtegidoPreAnalise(s, all)).toBe(true);
    expect(isProtegidoPreAnalise(a, all)).toBe(true);
    expect(isProtegidoPreAnalise(b, all)).toBe(false);
  });
  it('uma escolha por descanso curto; aliado perde ao descansar', () => {
    const s = mk({ id: 's', specAbilities: ['sup-pre-analise'], preAnaliseAllyId: 'a', preAnaliseEscolhaUsada: true });
    expect(canEscolherAliadoPreAnalise(s as any, mk({ id: 'b' }) as any).ok).toBe(false);
    expect(preAnaliseShortRestPatch(s as any, 'a')).toEqual({ preAnaliseAllyId: undefined });
    expect(preAnaliseShortRestPatch(s as any, 's')).toEqual({ preAnaliseEscolhaUsada: false });
  });
});

describe('Recompensa pelo Sucesso', () => {
  it('bônus arredondado para cima', () => {
    expect(getRecompensaBonus({ level: 5 })).toBeGreaterThanOrEqual(1);
    expect(getRecompensaBonus({ level: 1 })).toBe(Math.ceil(getRecompensaBonus({ level: 1 }) * 2 / 2));
  });
  it('PE excedente vira temporário', () => {
    expect(recompensaPEPatch(mk({ id: 'x', peCurrent: 9, peMax: 10 }) as any)).toEqual({ peCurrent: 10, tempPE: 1 });
    expect(recompensaPEPatch(mk({ id: 'x', peCurrent: 5, peMax: 10 }) as any)).toEqual({ peCurrent: 7, tempPE: 0 });
  });
  beforeEach(() => {
    useCharacterStore.setState({ characters: [
      mk({ id: 's', specAbilities: ['sup-comando-motivador', 'sup-recompensa-sucesso'] }), mk({ id: 'a' }),
    ] } as any);
  });
  it('Comando com recompensa marca o bônus e o teste identifica', () => {
    const [s, a] = useCharacterStore.getState().characters;
    const r = darComando(s, a, '', true);
    expect(r.ok).toBe(true);
    expect(r.bonus).toBe(getRecompensaBonus(s));
    const flat = consumeFlatBonusFor('a', { kind: 'skill', name: 'Atletismo' } as any);
    expect(flat.bonus).toBe(r.bonus);
    expect(hasRecompensaNote(flat.notes)).toBe(true);
  });
});

describe('maybeApplyRecompensa — rolagens sem CD conhecida', () => {
  it('concede 2 PE quando o bônus reduzido do Comando é consumido numa rolagem sem CD', () => {
    const ally = mk({ id: 'a', peCurrent: 3, peMax: 10 }) as any;
    const updates: [string, any][] = [];
    const logs: string[] = [];
    const ok = maybeApplyRecompensa(ally.id, { bonus: 2, notes: [`+2 Comando Motivador (Suporte) · ${RECOMPENSA_SOURCE_TAG}`] }, {
      find: (id) => (id === ally.id ? ally : undefined),
      update: (id, p) => updates.push([id, p]),
      log: (m) => logs.push(m),
    });
    expect(ok).toBe(true);
    expect(updates[0][1].peCurrent).toBe(5);
    expect(logs[0]).toContain('Recompensa pelo Sucesso');
  });

  it('excedente vira PE temporário e não dispara sem a nota de Recompensa', () => {
    const ally = mk({ id: 'a', peCurrent: 9, peMax: 10, tempPE: 0 }) as any;
    const updates: [string, any][] = [];
    maybeApplyRecompensa(ally.id, { bonus: 2, notes: [RECOMPENSA_SOURCE_TAG] }, {
      find: () => ally, update: (id, p) => updates.push([id, p]), log: () => {},
    });
    expect(updates[0][1].peCurrent).toBe(10);
    expect(updates[0][1].tempPE).toBe(1);
    const none: unknown[] = [];
    const ok = maybeApplyRecompensa(ally.id, { bonus: 3, notes: ['+3 Comando Motivador'] }, {
      find: () => ally, update: () => none.push(1), log: () => {},
    });
    expect(ok).toBe(false);
    expect(none).toHaveLength(0);
  });
});

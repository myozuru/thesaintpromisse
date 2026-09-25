import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '../stores/useCharacterStore';

describe('Transferência de Aura — Fase A', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  it('aplica buff sustentado no aliado e remove ao revogar', () => {
    const s = useCharacterStore.getState();
    s.addCharacter('Alice', 'PLAYER', 'PLAYER');
    s.addCharacter('Bob', 'PLAYER', 'PLAYER');
    const [alice, bob] = useCharacterStore.getState().characters;
    useCharacterStore.setState({
      characters: useCharacterStore.getState().characters.map(c =>
        c.id === alice.id
          ? { ...c, chosenAuraAptitudes: ['transferencia_de_aura', 'aura_reforcada'] }
          : c,
      ),
    });
    const r = useCharacterStore.getState().transferAuraTo(alice.id, bob.id, 'aura_reforcada');
    expect(r.ok).toBe(true);
    const bobAfter = useCharacterStore.getState().characters.find(c => c.id === bob.id)!;
    const tBuff = (bobAfter.activeBuffs ?? []).find(b => b.spellName === 'Transferência de Aura');
    expect(tBuff).toBeDefined();
    expect(tBuff?.targetName).toBe('aura_reforcada');
    expect(tBuff?.sourceCharId).toBe(alice.id);
    expect(tBuff?.isSustained).toBe(true);

    useCharacterStore.getState().revokeTransferAura(alice.id);
    const bobFinal = useCharacterStore.getState().characters.find(c => c.id === bob.id)!;
    expect((bobFinal.activeBuffs ?? []).some(b => b.spellName === 'Transferência de Aura')).toBe(false);
  });

  it('falha se source não tem a aptidão de transferência', () => {
    const s = useCharacterStore.getState();
    s.addCharacter('Alice', 'PLAYER', 'PLAYER');
    s.addCharacter('Bob', 'PLAYER', 'PLAYER');
    const [alice, bob] = useCharacterStore.getState().characters;
    const r = useCharacterStore.getState().transferAuraTo(alice.id, bob.id, 'aura_reforcada');
    expect(r.ok).toBe(false);
  });
});

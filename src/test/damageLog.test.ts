import { afterEach, describe, expect, it } from 'vitest';
import { formatDamageBreakdown } from '@/lib/damageLog';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

// applyDamage despacha eventos por import assíncrono: aguarda antes de encerrar o ambiente.
afterEach(async () => { await import('@/lib/omni/eventBus'); await new Promise(resolve => setTimeout(resolve, 0)); });

describe('registro detalhado de dano', () => {
  it('mostra dano total, RD aplicada e dano final', () => {
    expect(formatDamageBreakdown('Yuji', {
      total: 24,
      rd: 7,
      final: 17,
      damageType: 'DCO',
    })).toBe('💥 Yuji — Dano total: 24 | RD: 7 | Dano final: 17 · DCO');
  });

  it('mantém números fracionários legíveis quando existirem', () => {
    expect(formatDamageBreakdown('Maki', { total: 10.5, rd: 2, final: 8.5 }))
      .toContain('Dano total: 10.5 | RD: 2 | Dano final: 8.5');
  });

  it('registra a RD e o dano final calculados pelo fluxo real de combate', () => {
    useCharacterStore.setState({ characters: [] });
    useLogStore.setState({ logs: [] });
    useCharacterStore.getState().addCharacter('Alvo', 'NPC', 'MASTER');
    const target = useCharacterStore.getState().characters[0];
    expect(target).toBeDefined();
    if (!target) return;
    useCharacterStore.getState().updateCharacter(target.id, {
      hpCurrent: 30,
      hpMax: 30,
      escCurrent: 0,
      rd: 5,
    });

    useCharacterStore.getState().applyDamage(target.id, 18, 'DCO');

    const updated = useCharacterStore.getState().characters.find((character) => character.id === target.id);
    expect(updated?.hpCurrent).toBe(17);
    expect(useLogStore.getState().logs[0]?.message)
      .toBe('💥 Alvo — Dano total: 18 | RD: 5 | Dano final: 13 · DCO');
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import type { Character } from '@/types';
import { montarVariaveisDoPersonagem, lerCaminhoOmni } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { DICIONARIO_CHAVES_OMNI } from '@/lib/omni/constantesDoSistema';
import { DICIONARIO_AUTOCOMPLETE } from '@/lib/omni/dicionarioAutocomplete';
import { useCharacterStore } from '@/stores/useCharacterStore';

const hero = {
  id: 'pool-hero', name: 'Hero', level: 3,
  hpCurrent: 20, hpMax: 40, peCurrent: 7, peMax: 20,
  escCurrent: 5, escMax: 10, tempPE: 3, economiaPEReserve: 8,
  ca: 14, movement: 9, attributes: [], skills: [], savingThrows: [],
} as unknown as Character;
const NEW_KEYS = [
  'vida_temp_pct', 'vida_total', 'pe_faltante', 'pe_faltante_pct',
  'reserva_pe_disponivel', 'reserva_pe_recuperavel',
];

beforeEach(() => useCharacterStore.setState({ characters: [hero] }));

describe('Pools reais da ficha', () => {
  it.each([
    ['vida_temp', 5], ['vida_temp_max', 10], ['vida_temp_pct', 50],
    ['vida_total', 25], ['pe_faltante', 13], ['pe_faltante_pct', 65],
    ['reserva_pe', 8], ['reserva_pe_atual', 8], ['reserva_pe_max', 0],
    ['reserva_pe_disponivel', 1], ['reserva_pe_recuperavel', 8],
  ])('%s resolve %s nas fórmulas e nas referências', (key, esperado) => {
    expect(lerCaminhoOmni(hero, key)).toBe(esperado);
    for (const escopo of ['USUARIO', 'ALVO'] as const) {
      const bag = montarVariaveisDoPersonagem(hero, escopo);
      expect(bag[`${escopo}_${key.toUpperCase()}`]).toBe(esperado);
      expect(avaliarFormula(`@${escopo}.${key}`, bag).valor).toBe(esperado);
    }
  });

  it('vida_temp e seu máximo não dependem do campo inexistente tempHp', () => {
    const c = { ...hero, tempHp: 99 } as Character;
    const bag = montarVariaveisDoPersonagem(c);
    expect(bag.VIDA_TEMP).toBe(5);
    expect(bag.VIDA_TEMP_MAX).toBe(10);
  });

  it('recalcula após concessão real de PVTs e edição de PE', () => {
    useCharacterStore.getState().applyShield(hero.id, 2);
    useCharacterStore.getState().updateCharacter(hero.id, { peCurrent: 17 });
    const c = useCharacterStore.getState().characters.find(x => x.id === hero.id)!;
    const bag = montarVariaveisDoPersonagem(c);
    expect([bag.VIDA_TEMP, bag.VIDA_TEMP_MAX, bag.VIDA_TEMP_PCT, bag.VIDA_TOTAL]).toEqual([7, 10, 70, 27]);
    expect([bag.PE_FALTANTE, bag.PE_FALTANTE_PCT, bag.RESERVA_PE_RECUPERAVEL]).toEqual([3, 15, 3]);
  });

  it('máximos zero geram percentuais zero e preservam recursos já concedidos', () => {
    const bag = montarVariaveisDoPersonagem({ ...hero, escMax: 0, peMax: 0 });
    expect(bag.VIDA_TEMP).toBe(5);
    expect(bag.VIDA_TEMP_PCT).toBe(0);
    expect(bag.PE_FALTANTE).toBe(0);
    expect(bag.PE_FALTANTE_PCT).toBe(0);
    expect(bag.RESERVA_PE_RECUPERAVEL).toBe(0);
  });

  it('saldo de PE cheio ou acima do máximo não gera falta nem recuperação negativa', () => {
    for (const peCurrent of [20, 25]) {
      const bag = montarVariaveisDoPersonagem({ ...hero, peCurrent });
      expect([bag.PE_FALTANTE, bag.PE_FALTANTE_PCT, bag.RESERVA_PE_RECUPERAVEL]).toEqual([0, 0, 0]);
    }
  });

  it('reserva vazia ou negativa não oferece recuperação', () => {
    for (const economiaPEReserve of [0, -2]) {
      const bag = montarVariaveisDoPersonagem({ ...hero, economiaPEReserve });
      expect(bag.RESERVA_PE_DISPONIVEL).toBe(0);
      expect(bag.RESERVA_PE_RECUPERAVEL).toBe(0);
    }
  });

  it('PVTs acima do máximo configurado não são cortados pela leitura', () => {
    const bag = montarVariaveisDoPersonagem({ ...hero, escCurrent: 15 });
    expect(bag.VIDA_TEMP).toBe(15);
    expect(bag.VIDA_TEMP_MAX).toBe(10);
    expect(bag.VIDA_TEMP_PCT).toBe(150);
    expect(bag.VIDA_TOTAL).toBe(35);
  });

  it('valores opcionais ausentes retornam zero', () => {
    const c = { ...hero, escCurrent: undefined, escMax: undefined, economiaPEReserve: undefined } as unknown as Character;
    const bag = montarVariaveisDoPersonagem(c);
    expect([bag.VIDA_TEMP, bag.VIDA_TEMP_MAX, bag.VIDA_TEMP_PCT]).toEqual([0, 0, 0]);
    expect([bag.RESERVA_PE, bag.RESERVA_PE_DISPONIVEL, bag.RESERVA_PE_RECUPERAVEL]).toEqual([0, 0, 0]);
  });

  it.each(NEW_KEYS)('%s aparece no dicionário e no autocomplete', key => {
    const pool = DICIONARIO_CHAVES_OMNI.find(c => c.grupo === '🩺 Pools')!;
    expect(pool.escopos).toEqual(['USUARIO', 'ALVO']);
    expect(pool.itens.filter(i => i.id === key)).toHaveLength(1);
    expect(DICIONARIO_AUTOCOMPLETE.filter(s => s.valor === key)).toHaveLength(1);
  });
});

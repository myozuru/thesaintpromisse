/**
 * PR-8 — Auditoria: Magia & Técnicas.
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import type { Character } from '@/types';

const base: Character = {
  id: 'hero-pr8',
  name: 'Hero',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
  spells: [
    { id: 'esp-bola-fogo', name: 'Bola de Fogo', costPE: 3, spellType: 'damage', damageType: 'Fogo', isPrepared: true },
    { id: 'esp-cura-leve', name: 'Cura Leve',   costPE: 2, spellType: 'heal' },
    { id: 'esp-escudo',    name: 'Escudo',      costPE: 1, spellType: 'buff' },
    { id: 'esp-cinzas',    name: 'Cinzas',      costPE: 4, spellType: 'damage', damageType: 'Fogo' },
  ],
  activeBuffs: [
    { id: 'b1', spellName: 'Escudo', type: 'ca', value: 2, remainingTurns: 3, peCostPerRound: 1, isSustained: true },
  ],
  tecnicaAmaldicoada: 'Chamas Negras',
  tecnicaFundamentos: ['Destruir', 'Refinar'],
  tecnicaFoco: 'Destruição',
  spellAttackBonus: 4,
  imbuedSpell: 'esp-bola-fogo',
  lastSpellUsedId: 'esp-cura-leve',
} as unknown as Character;

const r = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-8 — Magia & Técnicas', () => {
  it('contagem por tipo e PE min/max', () => {
    expect(r(base, 'qtd_feiticos')).toBe(4);
    expect(r(base, 'qtd_feiticos_dano')).toBe(2);
    expect(r(base, 'qtd_feiticos_cura')).toBe(1);
    expect(r(base, 'qtd_feiticos_buff')).toBe(1);
    expect(r(base, 'pe_minimo_feitico')).toBe(1);
    expect(r(base, 'pe_maximo_feitico')).toBe(4);
  });

  it('feitiços prontos (Memorização Imediata)', () => {
    expect(r(base, 'qtd_feiticos_prontos')).toBe(1);
    expect(r(base, 'tem_feitico_pronto')).toBe(1);
  });

  it('buffs ativos / sustentados / PE por rodada', () => {
    expect(r(base, 'qtd_buffs_ativos')).toBe(1);
    expect(r(base, 'qtd_buffs_sustentados')).toBe(1);
    expect(r(base, 'pe_por_rodada_sustentado')).toBe(1);
    expect(r(base, 'tem_buff_escudo')).toBe(1);
  });

  it('predicates: tem_feitico_<id> e qtd por elemento', () => {
    expect(r(base, 'tem_feitico_esp_bola_fogo')).toBe(1);
    expect(r(base, 'tem_feitico_inexistente')).toBe(0);
    expect(r(base, 'qtd_feiticos_elemento_fogo')).toBe(2);
  });

  it('técnica & foco', () => {
    expect(r(base, 'tecnica_amaldicoada_definida')).toBe(1);
    expect(r(base, 'qtd_fundamentos_tecnica')).toBe(2);
    expect(r(base, 'foco_destruicao')).toBe(1);
    expect(r(base, 'foco_economia')).toBe(0);
    expect(r(base, 'spell_attack_bonus')).toBe(4);
    expect(r(base, 'imbuir_armado')).toBe(1);
    expect(r(base, 'tem_ultimo_feitico')).toBe(1);
  });

  it('vazio → tudo zero', () => {
    const c = { ...base, spells: [], activeBuffs: [], tecnicaAmaldicoada: undefined, tecnicaFundamentos: [], tecnicaFoco: undefined, imbuedSpell: undefined, lastSpellUsedId: undefined } as unknown as Character;
    expect(r(c, 'qtd_feiticos')).toBe(0);
    expect(r(c, 'pe_minimo_feitico')).toBe(0);
    expect(r(c, 'qtd_buffs_ativos')).toBe(0);
    expect(r(c, 'tecnica_amaldicoada_definida')).toBe(0);
    expect(r(c, 'imbuir_armado')).toBe(0);
    expect(r(c, 'tem_ultimo_feitico')).toBe(0);
  });
});

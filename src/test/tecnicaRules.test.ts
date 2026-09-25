/**
 * Testes das regras canônicas do Especialista em Técnica.
 * Garante que os bugs corrigidos não voltem a aparecer.
 */
import { describe, it, expect } from 'vitest';
import {
  getConjuracaoAprimoradaBonus,
  computeTecnicaPeMax,
  getTecnicaMaxSpellLevel,
  canMulticlassFromTecnica,
  TECNICA_FUNDAMENTO_DETAILS,
} from '@/lib/tecnicaProgression';
import {
  getRapidoExtraPe,
  getDuplicadoExtraPe,
  getCuidadosoExtraPe,
  computeFundamentosModifiers,
} from '@/lib/tecnicaFundamentos';
import { getClassHitDie } from '@/lib/levelEngine';

describe('Especialista em Técnica — Regras canônicas', () => {
  describe('Hit Die', () => {
    it('é d8 mesmo se characterClass for "Não-Feiticeiro"', () => {
      expect(getClassHitDie('Não-Feiticeiro' as any, 'Especialista em Técnica')).toBe(8);
      expect(getClassHitDie('Feiticeiro' as any, 'Especialista em Técnica')).toBe(8);
    });
  });

  describe('PE Máximo (6 × Nv + Mod do Atributo-Chave)', () => {
    const attrs = [
      { id: '1', name: 'Inteligência', value: 16 }, // mod +3
      { id: '2', name: 'Sabedoria', value: 10 },
    ];
    it('Nv 1 com INT 16 → 6 + 3 = 9', () => {
      expect(computeTecnicaPeMax(1, attrs as any, 'Inteligência')).toBe(9);
    });
    it('Nv 5 com INT 16 → 30 + 3 = 33', () => {
      expect(computeTecnicaPeMax(5, attrs as any, 'Inteligência')).toBe(33);
    });
    it('Nv 10 → 60 + 3 = 63', () => {
      expect(computeTecnicaPeMax(10, attrs as any, 'Inteligência')).toBe(63);
    });
  });

  describe('Conjuração Aprimorada (tabela oficial)', () => {
    const km = 4; // mod do atributo-chave
    const cl = 5; // nível do personagem
    it('Nv 0 → 0', () => expect(getConjuracaoAprimoradaBonus('0', km, cl)).toBe(0));
    it('Nv 1 → keyMod', () => expect(getConjuracaoAprimoradaBonus('1', km, cl)).toBe(km));
    it('Nv 2 → keyMod', () => expect(getConjuracaoAprimoradaBonus('2', km, cl)).toBe(km));
    it('Nv 3 → 2 × keyMod', () => expect(getConjuracaoAprimoradaBonus('3', km, cl)).toBe(km * 2));
    it('Nv 4 → 2 × keyMod + Nível', () => expect(getConjuracaoAprimoradaBonus('4', km, cl)).toBe(km * 2 + cl));
    it('Nv 5 → 2 × keyMod + 2 × Nível', () => expect(getConjuracaoAprimoradaBonus('5', km, cl)).toBe(km * 2 + cl * 2));
    it('Técnica Máxima → 3 × keyMod + 3 × Nível', () => {
      expect(getConjuracaoAprimoradaBonus('Técnica Máxima', km, cl)).toBe(km * 3 + cl * 3);
    });
    it('Técnica Reversa → 0', () => expect(getConjuracaoAprimoradaBonus('Técnica Reversa', km, cl)).toBe(0));
  });

  describe('Adiantar a Evolução (gate)', () => {
    it('Nv 1-3 → 1', () => {
      expect(getTecnicaMaxSpellLevel(1)).toBe(1);
      expect(getTecnicaMaxSpellLevel(3)).toBe(1);
    });
    it('Nv 4 → 2', () => expect(getTecnicaMaxSpellLevel(4)).toBe(2));
    it('Nv 7 → 3', () => expect(getTecnicaMaxSpellLevel(7)).toBe(3));
    it('Nv 11 → 4', () => expect(getTecnicaMaxSpellLevel(11)).toBe(4));
    it('Nv 15 → 5', () => expect(getTecnicaMaxSpellLevel(15)).toBe(5));
  });

  describe('Multiclasse: INT OU SAB ≥ 16 (não AND)', () => {
    it('só INT 16 já libera', () => {
      const attrs = [
        { id: '1', name: 'Inteligência', value: 16 },
        { id: '2', name: 'Sabedoria', value: 10 },
      ];
      expect(canMulticlassFromTecnica(attrs as any)).toBe(true);
    });
    it('só SAB 16 já libera', () => {
      const attrs = [
        { id: '1', name: 'Inteligência', value: 10 },
        { id: '2', name: 'Sabedoria', value: 16 },
      ];
      expect(canMulticlassFromTecnica(attrs as any)).toBe(true);
    });
    it('ambos < 16 bloqueia', () => {
      const attrs = [
        { id: '1', name: 'Inteligência', value: 14 },
        { id: '2', name: 'Sabedoria', value: 14 },
      ];
      expect(canMulticlassFromTecnica(attrs as any)).toBe(false);
    });
  });

  describe('Custos de PE dos Fundamentos', () => {
    it('Duplicado: 2 × nível (mín 1)', () => {
      expect(getDuplicadoExtraPe('0' as any)).toBe(1);
      expect(getDuplicadoExtraPe('1' as any)).toBe(2);
      expect(getDuplicadoExtraPe('3' as any)).toBe(6);
      expect(getDuplicadoExtraPe('5' as any)).toBe(10);
    });
    it('Rápido: 2 × nível (mín 1) — corrigido (era apenas n)', () => {
      expect(getRapidoExtraPe('0' as any)).toBe(1);
      expect(getRapidoExtraPe('1' as any)).toBe(2);
      expect(getRapidoExtraPe('3' as any)).toBe(6);
      expect(getRapidoExtraPe('5' as any)).toBe(10);
    });
    it('Cuidadoso: igual ao Mod INT/SAB (mín 1) — corrigido (não escala com nível)', () => {
      expect(getCuidadosoExtraPe(0)).toBe(1);
      expect(getCuidadosoExtraPe(3)).toBe(3);
      expect(getCuidadosoExtraPe(5)).toBe(5);
    });
  });

  describe('Fundamentos: requisito de nível na metadata', () => {
    it('Feitiço Rápido → unlockLevel 6', () => {
      expect(TECNICA_FUNDAMENTO_DETAILS['Feitiço Rápido'].unlockLevel).toBe(6);
    });
    it('Demais fundamentos → unlockLevel 1', () => {
      const ones = ['Feitiço Cruel', 'Feitiço Cuidadoso', 'Feitiço Distante',
        'Feitiço Duplicado', 'Feitiço Expansivo', 'Feitiço Potente', 'Feitiço Preciso'] as const;
      for (const f of ones) {
        expect(TECNICA_FUNDAMENTO_DETAILS[f].unlockLevel).toBe(1);
      }
    });
  });

  describe('computeFundamentosModifiers — efeitos isolados', () => {
    const baseSpell = {
      id: 'sp1', name: 'Bola de Fogo', spellLevel: '3' as any,
      range: '18m', spellType: 'damage' as any,
    } as any;

    it('Cruel t1: -1 PE, +2 CD', () => {
      const out = computeFundamentosModifiers({
        spell: baseSpell, activation: { 'Feitiço Cruel': 't1' },
      });
      expect(out.extraPe).toBe(1);
      expect(out.cdBonus).toBe(2);
    });
    it('Cruel t2: -2 PE, +4 CD', () => {
      const out = computeFundamentosModifiers({
        spell: baseSpell, activation: { 'Feitiço Cruel': 't2' },
      });
      expect(out.extraPe).toBe(2);
      expect(out.cdBonus).toBe(4);
    });
    it('Preciso t1/t2: +2/+4 acerto', () => {
      const t1 = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Preciso': 't1' } });
      expect(t1.extraPe).toBe(1); expect(t1.hitBonus).toBe(2);
      const t2 = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Preciso': 't2' } });
      expect(t2.extraPe).toBe(2); expect(t2.hitBonus).toBe(4);
    });
    it('Distante: -2 PE, dobra alcance (18m → 36m)', () => {
      const out = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Distante': 't1' } });
      expect(out.extraPe).toBe(2);
      expect(out.rangeOverride).toContain('36');
    });
    it('Distante CaC → 9m de fallback', () => {
      const cac = { ...baseSpell, range: 'Corpo-a-corpo' };
      const out = computeFundamentosModifiers({ spell: cac, activation: { 'Feitiço Distante': 't1' } });
      expect(out.rangeOverride).toContain('9m');
    });
    it('Expansivo: -3 PE, área ×1,5', () => {
      const out = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Expansivo': 't1' } });
      expect(out.extraPe).toBe(3);
      expect(out.areaOverride).toContain('27.0'); // 18 × 1.5
    });
    it('Potente: -3 PE, ativa re-roll', () => {
      const out = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Potente': 't1' } });
      expect(out.extraPe).toBe(3);
      expect(out.rerollLowDamage).toBe(true);
    });
    it('Cuidadoso: usa keyAttrMod do ctx (não nível do feitiço)', () => {
      const out = computeFundamentosModifiers({
        spell: baseSpell, activation: { 'Feitiço Cuidadoso': 't1' }, keyAttrMod: 4,
      });
      expect(out.extraPe).toBe(4);
    });
    it('Duplicado: -2×Nv PE, castCount = 2', () => {
      const out = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Duplicado': 't1' } });
      expect(out.extraPe).toBe(6); // 2 × 3
      expect(out.castCount).toBe(2);
    });
    it('Rápido: -2×Nv PE, vira ação bônus', () => {
      const out = computeFundamentosModifiers({ spell: baseSpell, activation: { 'Feitiço Rápido': 't1' } });
      expect(out.extraPe).toBe(6); // 2 × 3
      expect(out.asBonusAction).toBe(true);
    });
  });
});

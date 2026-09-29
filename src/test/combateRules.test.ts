/**
 * Regras canônicas do Especialista em Combate (reforma).
 *
 * Livro:
 *   • PV Nv 1: 12 + Mod CON (wizard — verificado em derivedStats).
 *   • PV níveis seguintes: 1d10 + CON ou fixo 6 + CON → dado de vida d10.
 *   • PE: 4 por nível, SEM mod de atributo.
 *   • Atributo-chave (CD das habilidades): Força | Destreza | Sabedoria.
 *   • Treinamentos: todas as armas + escudos; 1 TR (Fortitude|Reflexos);
 *     2 perícias entre Ofício/Atletismo/Acrobacia + 3 quaisquer.
 */
import { describe, it, expect } from 'vitest';
import { getClassHitDie, getDieAvg, getPePerLevelMult, recalcPeMaxBySpec } from '@/lib/levelEngine';
import type { Attribute } from '@/types';

describe('Especialista em Combate — Regras canônicas', () => {
  describe('Dado de vida', () => {
    it('é d10 (Feiticeiro)', () => {
      expect(getClassHitDie('Feiticeiro' as any, 'Especialista em Combate')).toBe(10);
    });
    it('é d10 mesmo se characterClass for "Não-Feiticeiro" (ficha migrada)', () => {
      expect(getClassHitDie('Não-Feiticeiro' as any, 'Especialista em Combate')).toBe(10);
    });
    it('média fixa do d10 é 6 (opção "6 + CON" do livro)', () => {
      expect(getDieAvg(10)).toBe(6);
    });
  });

  describe('PE (4 por nível, sem mod de atributo)', () => {
    const attrs: Attribute[] = [
      { id: '1', name: 'Força', value: 18 }, // mod +4 — NÃO pode entrar no PE
      { id: '2', name: 'Sabedoria', value: 16 },
    ] as Attribute[];

    it('multiplicador é 4', () => {
      expect(getPePerLevelMult('Especialista em Combate')).toBe(4);
    });
    it('Nv 1 → 4 (sem mod mesmo com FOR 18)', () => {
      expect(recalcPeMaxBySpec(1, 'Especialista em Combate', attrs, 0, 'Força')).toBe(4);
    });
    it('Nv 5 → 20', () => {
      expect(recalcPeMaxBySpec(5, 'Especialista em Combate', attrs, 0, 'Força')).toBe(20);
    });
    it('Nv 10 → 40', () => {
      expect(recalcPeMaxBySpec(10, 'Especialista em Combate', attrs, 0, 'Destreza')).toBe(40);
    });
  });
});

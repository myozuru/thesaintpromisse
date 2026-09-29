// @vitest-environment jsdom
/** Renovação pelo Sangue — regras puras (nível, teto de PE). */
import { describe, it, expect } from 'vitest';
import { renovacaoSangueAtiva, aplicarRenovacao } from '@/lib/renovacaoSangue';
import { implementoMarcialBonus } from '@/lib/golpeEspecial';
import type { Character } from '@/types';

const esp = (level: number, extra: Partial<Character> = {}): Character =>
  ({
    id: 'x', name: 'X', level,
    characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
    peCurrent: 5, peMax: 10, ...extra,
  }) as unknown as Character;

describe('Renovação pelo Sangue — ativação', () => {
  it('não ativa antes do nível 6', () => {
    expect(renovacaoSangueAtiva(esp(5))).toBe(false);
  });
  it('ativa no nível 6+', () => {
    expect(renovacaoSangueAtiva(esp(6))).toBe(true);
    expect(renovacaoSangueAtiva(esp(20))).toBe(true);
  });
  it('não ativa para outra especialização', () => {
    expect(renovacaoSangueAtiva(esp(10, { specialization: 'Suporte' } as never))).toBe(false);
  });
});

describe('Renovação pelo Sangue — recuperação', () => {
  it('recupera 1 PE', () => {
    const c = esp(6);
    let patch: Partial<Character> | null = null;
    expect(aplicarRenovacao(c, (_id, p) => { patch = p; })).toBe(true);
    expect(patch).toEqual({ peCurrent: 6 });
  });
  it('não ultrapassa o máximo nem recupera quando cheio', () => {
    const c = esp(6, { peCurrent: 10, peMax: 10 });
    let chamou = false;
    expect(aplicarRenovacao(c, () => { chamou = true; })).toBe(false);
    expect(chamou).toBe(false);
  });
  it('não recupera abaixo do nível 6', () => {
    const c = esp(5);
    let chamou = false;
    expect(aplicarRenovacao(c, () => { chamou = true; })).toBe(false);
    expect(chamou).toBe(false);
  });
});

describe('Implemento Marcial — escalonamento de CD', () => {
  it('0 abaixo do nv 4; +2 no nv 4; +3 no nv 8; +4 no nv 16', () => {
    expect(implementoMarcialBonus(esp(3))).toBe(0);
    expect(implementoMarcialBonus(esp(4))).toBe(2);
    expect(implementoMarcialBonus(esp(7))).toBe(2);
    expect(implementoMarcialBonus(esp(8))).toBe(3);
    expect(implementoMarcialBonus(esp(15))).toBe(3);
    expect(implementoMarcialBonus(esp(16))).toBe(4);
  });
});

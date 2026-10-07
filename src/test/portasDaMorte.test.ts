import { describe, it, expect } from 'vitest';
import { aplicarUltimoSegundo, cdEstabilizar, limiarFerimento, morteMassiva, resultadoTesteMorte, ULTIMO_SEGUNDO_ID } from '@/lib/portasDaMorte';
import { effectiveMovement } from '@/lib/movementBudget';
import type { Character } from '@/types';

describe('Portas da Morte — regras do livro', () => {
  it('d20: 1 = 2 falhas; 2–9 = 1 falha; 10–19 = 1 sucesso; 20 = 2 sucessos', () => {
    expect(resultadoTesteMorte(1)).toEqual({ sucessos: 0, falhas: 2 });
    expect(resultadoTesteMorte(2)).toEqual({ sucessos: 0, falhas: 1 });
    expect(resultadoTesteMorte(9)).toEqual({ sucessos: 0, falhas: 1 });
    expect(resultadoTesteMorte(10)).toEqual({ sucessos: 1, falhas: 0 });
    expect(resultadoTesteMorte(19)).toEqual({ sucessos: 1, falhas: 0 });
    expect(resultadoTesteMorte(20)).toEqual({ sucessos: 2, falhas: 0 });
  });
  it('CD de Medicina: 15 +1 a cada 5 PV negativos', () => {
    expect(cdEstabilizar(0)).toBe(15);
    expect(cdEstabilizar(-4)).toBe(15);
    expect(cdEstabilizar(-5)).toBe(16);
    expect(cdEstabilizar(-23)).toBe(19);
  });
  it('morte massiva só quando o negativo passa do PV máximo', () => {
    expect(morteMassiva(-40, 40)).toBe(false);
    expect(morteMassiva(-41, 40)).toBe(true);
  });
  it('Ferimento Complexo: metade do PV máximo, mínimo 50', () => {
    expect(limiarFerimento(60)).toBe(50);
    expect(limiarFerimento(200)).toBe(100);
  });
});

const ch = (id: string, o: Partial<Character> = {}) => ({ id, category: 'PLAYER', hpCurrent: 20, activeConditions: [], chosenSpecAbilities: [], ...o }) as unknown as Character;

describe('No Último Segundo', () => {
  const sup = ch('sup', { chosenSpecAbilities: [{ abilityId: ULTIMO_SEGUNDO_ID, chosenAtLevel: 4 }] as never });
  const ordem = [{ charId: 'ini', total: 18 }, { charId: 'cai', total: 15 }, { charId: 'sup', total: 12 }];
  it('aliado com 2 falhas: +5 e passa a agir antes dele → benefício', () => {
    const r = aplicarUltimoSegundo(ordem, [sup, ch('ini', { category: 'INIMIGO' }), ch('cai', { hpCurrent: -3, portasMorte: { sucessos: 0, falhas: 2 } })]);
    expect(r.ordem.map((e) => e.charId)).toEqual(['ini', 'sup', 'cai']);
    expect(r.ordem.find((e) => e.charId === 'sup')!.total).toBe(17);
    expect(r.beneficiados).toEqual(['sup']);
  });
  it('aliado com 1 falha: nada muda', () => {
    const r = aplicarUltimoSegundo(ordem, [sup, ch('ini'), ch('cai', { hpCurrent: -3, portasMorte: { sucessos: 0, falhas: 1 } })]);
    expect(r.ordem).toBe(ordem);
    expect(r.beneficiados).toEqual([]);
  });
  it('+5 sem ultrapassar o aliado: ganha iniciativa, mas não o benefício', () => {
    const r = aplicarUltimoSegundo([{ charId: 'cai', total: 20 }, { charId: 'sup', total: 10 }], [sup, ch('cai', { hpCurrent: -1, portasMorte: { sucessos: 0, falhas: 2 } })]);
    expect(r.impulsionados).toEqual(['sup']);
    expect(r.beneficiados).toEqual([]);
  });
  it('benefício: +4,5 m de movimento', () => {
    expect(effectiveMovement({ movement: 9, slotsCurrent: 0, slotsMax: 10, ultimoSegundoAtivo: true })).toBe(13.5);
  });
});

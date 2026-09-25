/**
 * Testes para o engine de ativação DOM — funções puras de Domínio.
 * Valida fórmulas oficiais do livro (pp. 182-184).
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import {
  calcularRevestimento,
  calcularAnularTecnica,
  calcularExpansaoIncompleta,
  calcularExpansaoCompleta,
} from '@/lib/domActivation';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test',
    name: 'Tester',
    level: 10,
    peCurrent: 100,
    peMax: 100,
    hpCurrent: 100,
    hpMax: 100,
    attributes: [
      { id: '1', name: 'Força', value: 12 },
      { id: '2', name: 'Destreza', value: 12 },
      { id: '3', name: 'Constituição', value: 12 },
      { id: '4', name: 'Inteligência', value: 16 }, // +3
      { id: '5', name: 'Sabedoria', value: 14 },
      { id: '6', name: 'Presença', value: 14 },
    ],
    skills: [
      { id: 's1', name: 'Feitiçaria', linkedAttribute: 'Inteligência', trained: true, mastery: false, externalBonus: 0 },
    ],
    cursedAptitudes: { AU: 0, CL: 3, BAR: 3, DOM: 3, ER: 0 },
    ...overrides,
  } as unknown as Character;
}

describe('Revestimento de Domínio', () => {
  it('custa 5 PE, ativa flag e calcula limiar de anulação = ceil(DOM/2)', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 3, ER: 0 } });
    const r = calcularRevestimento(c, { sustain: false });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(5);
    expect(r.omniFlagPatch?.revestimento_dominio).toBe(1);
    expect(r.details?.limiarAnulacao).toBe(2); // ceil(3/2) = 2
    expect(r.details?.reducao).toBe(10); // = nível
  });

  it('limiar de anulação para DOM 5 = 3', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 5, ER: 0 } });
    const r = calcularRevestimento(c, { sustain: false });
    expect(r.details?.limiarAnulacao).toBe(3);
  });

  it('falha sem PE suficiente', () => {
    const c = makeChar({ peCurrent: 3 });
    const r = calcularRevestimento(c, { sustain: false });
    expect(r.ok).toBe(false);
  });
});

describe('Anular Técnica', () => {
  const fixedRoll = (val: number) => () => val;

  it('gasta PE igual ao do atacante e resolve teste oposto', () => {
    const c = makeChar();
    const r = calcularAnularTecnica(c, {
      peInimigo: 8,
      feiticariaInimigo: 5,
      usosGastos: 0,
      rollFn: fixedRoll(15),
    });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(8);
    // meu d20=15 + bônus(int+3, treinamento level 10 → 2) = 15+5=20
    // inimigo d20=15 + 5 = 20 → empate ≥ é sucesso
    expect(r.details?.sucesso).toBe(1);
  });

  it('respeita limite de usos por descanso (DOM × por descanso longo)', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 3, ER: 0 } });
    const r = calcularAnularTecnica(c, {
      peInimigo: 5,
      feiticariaInimigo: 5,
      usosGastos: 3, // já gastou DOM=3
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Usos esgotados');
  });

  it('falha se PE insuficiente para igualar o do atacante', () => {
    const c = makeChar({ peCurrent: 3 });
    const r = calcularAnularTecnica(c, {
      peInimigo: 10,
      feiticariaInimigo: 5,
      usosGastos: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe('Expansão de Domínio Incompleta', () => {
  it('custa 15 PE; raio = 4,5 × bônus de treinamento; duração = 1 + DOM', () => {
    const c = makeChar({ level: 10, cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 3, ER: 0 } });
    const r = calcularExpansaoIncompleta(c);
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(15);
    expect(r.details?.duracao).toBe(4); // 1 + 3
    // bônus de treinamento varia conforme tabela; só validar que veio um número > 0
    expect(typeof r.details?.raio).toBe('number');
    expect((r.details!.raio as number) > 0).toBe(true);
    expect(r.omniFlagPatch?.expansao_incompleta).toBe(4);
  });
});

describe('Expansão de Domínio Completa', () => {
  it('custa 20 PE sem Acerto Garantido; duração = 3 + DOM', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 3, DOM: 3, ER: 0 } });
    const r = calcularExpansaoCompleta(c, { comAcertoGarantido: false, semBarreiras: false });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(20);
    expect(r.details?.duracao).toBe(6); // 3 + 3
    expect(r.omniFlagPatch?.expansao_completa).toBe(6);
  });

  it('custa 25 PE com Acerto Garantido (+5)', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 4, DOM: 4, ER: 0 } });
    const r = calcularExpansaoCompleta(c, { comAcertoGarantido: true, semBarreiras: false });
    expect(r.peSpent).toBe(25);
  });

  it('Sem Barreiras custa 25 PE e usa flag distinta', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 5, DOM: 5, ER: 0 } });
    const r = calcularExpansaoCompleta(c, { comAcertoGarantido: true, semBarreiras: true });
    expect(r.peSpent).toBe(25);
    expect(r.omniFlagPatch?.expansao_sem_barreiras).toBeDefined();
    expect(r.omniFlagPatch?.expansao_completa).toBeUndefined();
  });

  it('falha sem PE suficiente', () => {
    const c = makeChar({ peCurrent: 10 });
    const r = calcularExpansaoCompleta(c, { comAcertoGarantido: false, semBarreiras: false });
    expect(r.ok).toBe(false);
  });
});

/**
 * Testes para o engine de ativação CL — funções puras de Controle e Leitura.
 * Valida fórmulas oficiais do livro (pp. 178-181).
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import {
  calcularCobrirSe,
  calcularCanalizar,
  calcularProjetar,
  calcularEstimulo,
  calcularExpandirAura,
} from '@/lib/clActivation';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test',
    name: 'Tester',
    level: 1,
    peCurrent: 100,
    peMax: 100,
    hpCurrent: 100,
    hpMax: 100,
    attributes: [
      { id: '1', name: 'Força', value: 14 },
      { id: '2', name: 'Destreza', value: 12 },
      { id: '3', name: 'Constituição', value: 16 }, // mod = +3 → maior
      { id: '4', name: 'Inteligência', value: 10 },
      { id: '5', name: 'Sabedoria', value: 8 },
      { id: '6', name: 'Presença', value: 10 },
    ],
    cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 },
    ...overrides,
  } as unknown as Character;
}

describe('Cobrir-se / Cobertura Avançada', () => {
  it('básico concede 4 PVs temp por PE; limite = 2 + CL × 2', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularCobrirSe(c, { peSpent: 6, hasCoberturaAvancada: false });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(6);
    expect(r.shieldGranted).toBe(24); // 6 × 4
  });

  it('avançado concede 8 PVs temp por PE', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularCobrirSe(c, { peSpent: 6, hasCoberturaAvancada: true });
    expect(r.shieldGranted).toBe(48); // 6 × 8
  });

  it('rejeita PE acima do limite', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularCobrirSe(c, { peSpent: 7, hasCoberturaAvancada: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Limite/);
  });
});

describe('Canalizar em Golpe / Avançada / Máxima', () => {
  it('básico: limite = CL, dado d6, sem flat', () => {
    const c = makeChar({ cursedAptitudes: { AU: 5, CL: 3, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularCanalizar(c, { peSpent: 3, tier: 'basica' });
    expect(r.ok).toBe(true);
    expect(r.damageFormula).toBe('3d6 de dano adicional energético');
  });

  it('máxima: limite = CL+1, dado d10, soma AU', () => {
    const c = makeChar({ cursedAptitudes: { AU: 4, CL: 4, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularCanalizar(c, { peSpent: 5, tier: 'maxima' });
    expect(r.ok).toBe(true);
    expect(r.damageFormula).toBe('5d10 + 4 (AU) de dano adicional energético');
  });

  it('máxima rejeita CL+2', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 4, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularCanalizar(c, { peSpent: 6, tier: 'maxima' });
    expect(r.ok).toBe(false);
  });
});

describe('Projetar Energia / Avançada / Máxima', () => {
  it('básica: dado 1d10, mod×1, limite 1+CL', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularProjetar(c, { peSpent: 3, resolution: 'attack', tier: 'basica' });
    expect(r.ok).toBe(true);
    // mod do maior atributo (CON 16) = +3
    expect(r.damageFormula).toBe('31d10 + 3 (mod) dano de força');
  });

  it('avançada: 2d8, mod×2, +2 acerto/CD', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularProjetar(c, { peSpent: 2, resolution: 'save', tier: 'avancada' });
    expect(r.ok).toBe(true);
    expect(r.damageFormula).toBe('22d8 + 6 (2× mod) dano de força');
    expect(r.details?.cdBonus).toBe(2);
  });

  it('máxima: TR sucesso causa metade (não anula)', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 4, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularProjetar(c, { peSpent: 5, resolution: 'save', tier: 'maxima' });
    expect(r.ok).toBe(true);
    expect(r.logMessage).toMatch(/METADE do dano/);
    expect(r.details?.attackBonus).toBe(6);
  });

  it('rejeita PE > 1 + CL', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularProjetar(c, { peSpent: 4, resolution: 'attack', tier: 'basica' });
    expect(r.ok).toBe(false);
  });
});

describe('Estímulo Muscular', () => {
  it('Movimento básico: 1 PE = +metade do deslocamento', () => {
    const c = makeChar();
    const r = calcularEstimulo(c, { submodo: 'movimento', peSpent: 1, isAvancado: false, baseSpeedM: 9 });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(1);
    expect(r.logMessage).toMatch(/\+4\.5 m/);
  });

  it('Movimento avançado: 2 PE = +deslocamento total', () => {
    const c = makeChar();
    const r = calcularEstimulo(c, { submodo: 'movimento', peSpent: 2, isAvancado: true, baseSpeedM: 9 });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(2);
    expect(r.logMessage).toMatch(/\+9 m/);
  });

  it('Teste avançado: +2 por PE', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularEstimulo(c, { submodo: 'teste', peSpent: 3, isAvancado: true });
    expect(r.ok).toBe(true);
    expect(r.logMessage).toMatch(/\+6 no teste/);
  });

  it('Teste rejeita PE > CL', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 2, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularEstimulo(c, { submodo: 'teste', peSpent: 3, isAvancado: false });
    expect(r.ok).toBe(false);
  });

  it('Manobra avançada: 2 PE = CL × 3 m', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularEstimulo(c, { submodo: 'manobra', peSpent: 2, isAvancado: true });
    expect(r.ok).toBe(true);
    expect(r.logMessage).toMatch(/\+9 m/);
  });

  it('Pular: 1 PE dobra a distância', () => {
    const c = makeChar();
    const r = calcularEstimulo(c, { submodo: 'pular', peSpent: 1, isAvancado: false });
    expect(r.ok).toBe(true);
    expect(r.logMessage).toMatch(/DOBRADA/);
  });
});

describe('Expandir Aura', () => {
  it('ativação inicial custa 2 PE', () => {
    const c = makeChar();
    const r = calcularExpandirAura(c, { sustain: false });
    expect(r.peSpent).toBe(2);
    expect(r.omniFlagPatch?.aura_expandida).toBe(1);
  });

  it('manutenção custa 1 PE', () => {
    const c = makeChar();
    const r = calcularExpandirAura(c, { sustain: true });
    expect(r.peSpent).toBe(1);
  });

  it('rejeita se PE insuficiente', () => {
    const c = makeChar({ peCurrent: 0 });
    const r = calcularExpandirAura(c, { sustain: false });
    expect(r.ok).toBe(false);
  });
});

import {
  calcularLeituraDeAura,
  calcularLeituraRapida,
  calcularProjecaoDividida,
  calcularPetalaOfensiva,
  calcularRastreio,
} from '@/lib/clActivation';

describe('Leitura de Aura', () => {
  it('sucesso revela propriedades', () => {
    const c = makeChar({ skills: [{ id: 's', name: 'Feitiçaria', value: 0, linkedAttribute: 'Inteligência', trained: true }] } as Partial<Character>);
    const r = calcularLeituraDeAura(c, { cdAmaldicoada: 10, rollFn: () => 20 });
    expect(r.logMessage).toMatch(/SUCESSO/);
  });
  it('falha quando rola baixo', () => {
    const c = makeChar();
    const r = calcularLeituraDeAura(c, { cdAmaldicoada: 25, rollFn: () => 1 });
    expect(r.logMessage).toMatch(/FALHA/);
  });
});

describe('Leitura Rápida de Energia', () => {
  it('sucesso seta flag de cena', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularLeituraRapida(c, { cdAmaldicoada: 10, rollFn: () => 15 });
    expect(r.omniFlagPatch?.leitura_rapida_ativa).toBe(1);
  });
});

describe('Projeção Dividida', () => {
  it('rejeita PE > metade do original', () => {
    const c = makeChar();
    const r = calcularProjecaoDividida(c, { peOriginal: 4, peDuplicata: 3, tier: 'avancada' });
    expect(r.ok).toBe(false);
  });
  it('aceita PE = metade do original', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 0, ER: 0 } });
    const r = calcularProjecaoDividida(c, { peOriginal: 4, peDuplicata: 2, tier: 'avancada' });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(2);
  });
});

describe('Pétala Decadente ofensiva', () => {
  it('custa 5 PE e seta flag de penalidade', () => {
    const c = makeChar();
    const r = calcularPetalaOfensiva(c);
    expect(r.peSpent).toBe(5);
    expect(r.omniFlagPatch?.petala_ofensiva_penalidade).toBe(1);
  });
  it('rejeita se PE < 5', () => {
    const c = makeChar({ peCurrent: 3 });
    const r = calcularPetalaOfensiva(c);
    expect(r.ok).toBe(false);
  });
});

describe('Rastreio Avançado', () => {
  it('origem conhecida = identificação automática', () => {
    const c = makeChar();
    const r = calcularRastreio(c, { cdAmaldicoada: 0, skill: 'Investigação', alreadyKnown: true });
    expect(r.logMessage).toMatch(/automaticamente/);
  });
  it('teste de Percepção contra CD', () => {
    const c = makeChar();
    const r = calcularRastreio(c, { cdAmaldicoada: 12, skill: 'Percepção', rollFn: () => 18 });
    expect(r.logMessage).toMatch(/SUCESSO/);
  });
});

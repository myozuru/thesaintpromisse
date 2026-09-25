/**
 * LOTE 2 — Corretude semântica (32 chaves)
 *   🗺️ Mapa & Distância (13)
 *   🩹 Recursos Detalhados (6)
 *   🗡️ Empunhadura (14 — incluindo predicate arma_grupo_<grupo>)
 *
 * Para cada chave, comparamos o valor retornado pelo resolvedor com o
 * valor ESPERADO calculado à mão a partir do estado do Character.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetStores, makeChar, vEval } from './_helper';
import type { Character } from '@/types';

beforeEach(resetStores);

// ─── 🗺️ Mapa & Distância ────────────────────────────────────────────────
describe('Lote 2 — 🗺️ Mapa & Distância (13)', () => {
  it('CENA.distancia_xy / manhattan / elevacao_diff lêem omniCounters', () => {
    const c = makeChar({
      omniCounters: {
        cena_distancia_xy: 7,
        cena_distancia_manhattan: 9,
        cena_elevacao_diff: -2,
      },
    } as Partial<Character>);
    expect(vEval(c, 'NENHUM', 'CENA.distancia_xy')).toBe(7);
    expect(vEval(c, 'NENHUM', 'CENA.distancia_manhattan')).toBe(9);
    expect(vEval(c, 'NENHUM', 'CENA.elevacao_diff')).toBe(-2);
  });

  it('CENA.terreno + em_terreno_dificil', () => {
    const c0 = makeChar();
    expect(vEval(c0, 'NENHUM', 'CENA.terreno')).toBe(0);
    expect(vEval(c0, 'USUARIO', 'em_terreno_dificil')).toBe(0);
    const c1 = makeChar({
      omniFlags: { cena_terreno: 2, em_terreno_dificil: 1 },
    } as Partial<Character>);
    expect(vEval(c1, 'NENHUM', 'CENA.terreno')).toBe(2);
    expect(vEval(c1, 'USUARIO', 'em_terreno_dificil')).toBe(1);
  });

  it('voando / prono / agachado / usou_corrida — flags 0/1', () => {
    const c = makeChar({
      omniFlags: { voando: 1, prono: 0, agachado: 1, usou_corrida: 1 },
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'voando')).toBe(1);
    expect(vEval(c, 'USUARIO', 'prono')).toBe(0);
    expect(vEval(c, 'USUARIO', 'agachado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'usou_corrida')).toBe(1);
  });

  it('velocidade_atual = movement; halved se sobrecarregado', () => {
    const c1 = makeChar({ movement: 9 });
    expect(vEval(c1, 'USUARIO', 'velocidade_atual')).toBe(9);
    expect(vEval(c1, 'USUARIO', 'sobrecarregado')).toBe(0);

    const c2 = makeChar({ movement: 9, slotsCurrent: 5, slotsMax: 3 } as Partial<Character>);
    expect(vEval(c2, 'USUARIO', 'sobrecarregado')).toBe(1);
    expect(vEval(c2, 'USUARIO', 'velocidade_atual')).toBe(4.5);
  });

  it('metros_movidos_neste_turno lê omniCounters.metros_movidos', () => {
    const c = makeChar({ omniCounters: { metros_movidos: 6 } } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'metros_movidos_neste_turno')).toBe(6);
  });
});

// ─── 🩹 Recursos Detalhados ────────────────────────────────────────────
describe('Lote 2 — 🩹 Recursos Detalhados (6)', () => {
  it('vida_pct_abaixo_50 / 25, bloodied, criticamente_ferido', () => {
    const cheio = makeChar({ hpCurrent: 10, hpMax: 10 });
    expect(vEval(cheio, 'USUARIO', 'vida_pct_abaixo_50')).toBe(0);
    expect(vEval(cheio, 'USUARIO', 'vida_pct_abaixo_25')).toBe(0);
    expect(vEval(cheio, 'USUARIO', 'bloodied')).toBe(0);
    expect(vEval(cheio, 'USUARIO', 'criticamente_ferido')).toBe(0);

    const bloodied = makeChar({ hpCurrent: 5, hpMax: 10 });
    expect(vEval(bloodied, 'USUARIO', 'bloodied')).toBe(1);
    expect(vEval(bloodied, 'USUARIO', 'criticamente_ferido')).toBe(0);

    const critico = makeChar({ hpCurrent: 2, hpMax: 10 });
    expect(vEval(critico, 'USUARIO', 'vida_pct_abaixo_50')).toBe(1);
    expect(vEval(critico, 'USUARIO', 'vida_pct_abaixo_25')).toBe(1);
    expect(vEval(critico, 'USUARIO', 'criticamente_ferido')).toBe(1);
  });

  it('pe_pct_abaixo_50 / 25', () => {
    const cheio = makeChar({ peCurrent: 10, peMax: 10 });
    expect(vEval(cheio, 'USUARIO', 'pe_pct_abaixo_50')).toBe(0);
    expect(vEval(cheio, 'USUARIO', 'pe_pct_abaixo_25')).toBe(0);

    const baixo = makeChar({ peCurrent: 2, peMax: 10 });
    expect(vEval(baixo, 'USUARIO', 'pe_pct_abaixo_50')).toBe(1);
    expect(vEval(baixo, 'USUARIO', 'pe_pct_abaixo_25')).toBe(1);
  });
});

// ─── 🗡️ Empunhadura ────────────────────────────────────────────────────
describe('Lote 2 — 🗡️ Empunhadura (14)', () => {
  it('desarmado quando nenhuma arma equipada', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'desarmado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'duas_maos')).toBe(0);
    expect(vEval(c, 'USUARIO', 'dual_wield')).toBe(0);
  });

  it('duas_maos quando main e off são a MESMA arma', () => {
    const c = makeChar({
      mainHandWeaponName: 'Espada Grande',
      offHandWeaponName: 'Espada Grande',
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'duas_maos')).toBe(1);
    expect(vEval(c, 'USUARIO', 'dual_wield')).toBe(0);
    expect(vEval(c, 'USUARIO', 'desarmado')).toBe(0);
  });

  it('dual_wield quando armas diferentes', () => {
    const c = makeChar({
      mainHandWeaponName: 'Adaga',
      offHandWeaponName: 'Espada Curta',
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'dual_wield')).toBe(1);
    expect(vEval(c, 'USUARIO', 'duas_maos')).toBe(0);
  });

  it('arma_principal_eh_cac vs eh_distancia', () => {
    const cac = makeChar({ mainHandWeaponName: 'Adaga' } as Partial<Character>);
    expect(vEval(cac, 'USUARIO', 'arma_principal_eh_cac')).toBe(1);
    expect(vEval(cac, 'USUARIO', 'arma_principal_eh_distancia')).toBe(0);

    const ranged = makeChar({ mainHandWeaponName: 'Arco Curto' } as Partial<Character>);
    expect(ranged != null).toBe(true);
    // Arco Curto tem range='ranged'
    expect(vEval(ranged, 'USUARIO', 'arma_principal_eh_distancia')).toBe(1);
    expect(vEval(ranged, 'USUARIO', 'arma_principal_eh_cac')).toBe(0);
  });

  it('propriedades — leve / versatil / fineza / pesada', () => {
    // Adaga: fineza + leve
    const adaga = makeChar({ mainHandWeaponName: 'Adaga' } as Partial<Character>);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_leve')).toBe(1);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_fineza')).toBe(1);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_versatil')).toBe(0);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_pesada')).toBe(0);

    // Espada Longa: versátil
    const longa = makeChar({ mainHandWeaponName: 'Espada Longa' } as Partial<Character>);
    expect(vEval(longa, 'USUARIO', 'arma_principal_versatil')).toBe(1);

    // Espada Grande: pesada
    const grande = makeChar({ mainHandWeaponName: 'Espada Grande' } as Partial<Character>);
    expect(vEval(grande, 'USUARIO', 'arma_principal_pesada')).toBe(1);
  });

  it('escudo_id_equipado / swaps / ataques / ultimo_ataque', () => {
    const c = makeChar({
      equippedShieldId: 'escudo-medio',
      weaponSwapsThisTurn: 2,
      attacksThisTurn: 3,
      lastAttackHit: true,
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'escudo_id_equipado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'swaps_armas_neste_turno')).toBe(2);
    expect(vEval(c, 'USUARIO', 'ataques_neste_turno')).toBe(3);
    expect(vEval(c, 'USUARIO', 'ultimo_ataque_acertou')).toBe(1);
    expect(vEval(c, 'USUARIO', 'ultimo_ataque_errou')).toBe(0);

    const errou = makeChar({ lastAttackHit: false } as Partial<Character>);
    expect(vEval(errou, 'USUARIO', 'ultimo_ataque_errou')).toBe(1);
    expect(vEval(errou, 'USUARIO', 'ultimo_ataque_acertou')).toBe(0);
  });

  it('predicate arma_grupo_<grupo> — 1 se main ou off é desse grupo', () => {
    // Adaga = Faca; Espada Curta = Espada
    const c = makeChar({
      mainHandWeaponName: 'Adaga',
      offHandWeaponName: 'Espada Curta',
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'arma_grupo_faca')).toBe(1);
    expect(vEval(c, 'USUARIO', 'arma_grupo_espada')).toBe(1);
    expect(vEval(c, 'USUARIO', 'arma_grupo_machado')).toBe(0);
  });
});

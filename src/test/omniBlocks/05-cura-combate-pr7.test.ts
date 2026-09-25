/**
 * LOTE 5 — Corretude semântica (40 chaves)
 *   🩹 Cura & Recursos Avançados (~19)
 *   ⚔️ Combate Avançado PR-7 (~21)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetStores, makeChar, vEval } from './_helper';
import type { Character } from '@/types';

beforeEach(resetStores);

// ─── 🩹 Cura & Recursos Avançados ──────────────────────────────────────
describe('Lote 5 — 🩹 Cura & Recursos Avançados (19)', () => {
  it('pode_ser_curado / vida_faltante / vida_faltante_pct', () => {
    const cheio = makeChar({ hpCurrent: 10, hpMax: 10 });
    expect(vEval(cheio, 'USUARIO', 'pode_ser_curado')).toBe(0);
    expect(vEval(cheio, 'USUARIO', 'vida_faltante')).toBe(0);
    expect(vEval(cheio, 'USUARIO', 'vida_faltante_pct')).toBe(0);

    const ferido = makeChar({ hpCurrent: 3, hpMax: 10 });
    expect(vEval(ferido, 'USUARIO', 'pode_ser_curado')).toBe(1);
    expect(vEval(ferido, 'USUARIO', 'vida_faltante')).toBe(7);
    expect(vEval(ferido, 'USUARIO', 'vida_faltante_pct')).toBe(70);

    // Morto oficial (HP≤0 + exhaustionLevel=6) não pode ser curado
    const morto = makeChar({ hpCurrent: 0, hpMax: 10, exhaustionLevel: 6 } as Partial<Character>);
    expect(vEval(morto, 'USUARIO', 'pode_ser_curado')).toBe(0);
    // Morrendo também não
    const morrendo = makeChar({ hpCurrent: 0, hpMax: 10, dying: true } as Partial<Character>);
    expect(vEval(morrendo, 'USUARIO', 'pode_ser_curado')).toBe(0);
  });

  it('cura_recebida + dano_recebido (omniCounters) e alias vida_perdida_nesta_rodada', () => {
    const c = makeChar({
      omniCounters: {
        cura_recebida: 5,
        cura_recebida_nesta_rodada: 3,
        ultimo_dano_recebido: 8,
        dano_recebido_nesta_rodada: 12,
      },
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'cura_recebida')).toBe(5);
    expect(vEval(c, 'USUARIO', 'cura_recebida_nesta_rodada')).toBe(3);
    expect(vEval(c, 'USUARIO', 'ultimo_dano_recebido')).toBe(8);
    expect(vEval(c, 'USUARIO', 'dano_recebido_nesta_rodada')).toBe(12);
    expect(vEval(c, 'USUARIO', 'vida_perdida_nesta_rodada')).toBe(12);
  });

  it('acao / bonus_acao / movimento disponíveis', () => {
    const c = makeChar({ actionsCurrent: 1, bonusActionsCurrent: 0, movement: 9 });
    expect(vEval(c, 'USUARIO', 'acao_disponivel')).toBe(1);
    expect(vEval(c, 'USUARIO', 'bonus_acao_disponivel')).toBe(0);
    expect(vEval(c, 'USUARIO', 'movimento_disponivel')).toBe(1);

    const sem = makeChar({ actionsCurrent: 0, bonusActionsCurrent: 0, movement: 0 });
    expect(vEval(sem, 'USUARIO', 'acao_disponivel')).toBe(0);
    expect(vEval(sem, 'USUARIO', 'movimento_disponivel')).toBe(0);
  });

  it('slots_descanso_curto (hit dice) e %', () => {
    const c = makeChar({ hitDiceCurrent: 3, hitDiceMax: 5 } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'slots_descanso_curto')).toBe(3);
    expect(vEval(c, 'USUARIO', 'slots_descanso_curto_max')).toBe(5);
    expect(vEval(c, 'USUARIO', 'slots_descanso_curto_pct')).toBe(60);
  });

  it('vigor_maldito_usos / max / disponivel', () => {
    const sem = makeChar();
    expect(vEval(sem, 'USUARIO', 'vigor_maldito_disponivel')).toBe(0);

    const c = makeChar({ vigorMalditoUses: 2, vigorMalditoMax: 4 } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'vigor_maldito_usos')).toBe(2);
    expect(vEval(c, 'USUARIO', 'vigor_maldito_max')).toBe(4);
    expect(vEval(c, 'USUARIO', 'vigor_maldito_disponivel')).toBe(1);
  });

  it('hp_sacrificado e sacrificio_pct', () => {
    const c = makeChar({ hpMax: 20, hpSacrificedTotal: 5 } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'hp_sacrificado')).toBe(5);
    expect(vEval(c, 'USUARIO', 'sacrificio_pct')).toBe(25);
  });
});

// ─── ⚔️ Combate Avançado PR-7 ──────────────────────────────────────────
describe('Lote 5 — ⚔️ Combate Avançado PR-7 (21)', () => {
  it('sem modificadores: tudo zero', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'tem_vantagem')).toBe(0);
    expect(vEval(c, 'USUARIO', 'tem_desvantagem')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_vantagens')).toBe(0);
    expect(vEval(c, 'USUARIO', 'vantagem_proximo_ataque')).toBe(0);
    expect(vEval(c, 'USUARIO', 'vantagem_proximo_tr')).toBe(0);
    expect(vEval(c, 'USUARIO', 'vantagem_proxima_pericia')).toBe(0);
  });

  it('omniAdvMods alimenta contagens e scope routing', () => {
    const c = makeChar({
      omniAdvMods: {
        m1: { kind: 'advantage',    scope: 'attack_melee' },
        m2: { kind: 'advantage',    scope: 'save_specific' },
        m3: { kind: 'disadvantage', scope: 'next_skill'   },
      },
    } as unknown as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'qtd_vantagens')).toBe(2);
    expect(vEval(c, 'USUARIO', 'qtd_desvantagens')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_vantagem')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_desvantagem')).toBe(1);
    // Roteamento por escopo
    expect(vEval(c, 'USUARIO', 'vantagem_proximo_ataque')).toBe(1);
    expect(vEval(c, 'USUARIO', 'vantagem_proximo_tr')).toBe(1);
    expect(vEval(c, 'USUARIO', 'vantagem_proxima_pericia')).toBe(0);
    expect(vEval(c, 'USUARIO', 'desvantagem_proxima_pericia')).toBe(1);
    expect(vEval(c, 'USUARIO', 'desvantagem_proximo_ataque')).toBe(0);
  });

  it('cobertura — meia (+2), 3/4 (+5), total (imune)', () => {
    const meia = makeChar({ omniFlags: { cobertura_meia: 1 } } as Partial<Character>);
    expect(vEval(meia, 'USUARIO', 'cobertura_meia')).toBe(1);
    expect(vEval(meia, 'USUARIO', 'bonus_defesa_cobertura')).toBe(2);
    expect(vEval(meia, 'USUARIO', 'imune_por_cobertura')).toBe(0);

    const tq = makeChar({ omniFlags: { cobertura_tres_quartos: 1 } } as Partial<Character>);
    expect(vEval(tq, 'USUARIO', 'bonus_defesa_cobertura')).toBe(5);

    const tot = makeChar({ omniFlags: { cobertura_total: 1 } } as Partial<Character>);
    expect(vEval(tot, 'USUARIO', 'cobertura_total')).toBe(1);
    expect(vEval(tot, 'USUARIO', 'imune_por_cobertura')).toBe(1);
    expect(vEval(tot, 'USUARIO', 'bonus_defesa_cobertura')).toBe(999);
  });

  it('alcances e crítico da arma principal', () => {
    // Arco Curto: ranged, rangeShort=24, rangeLong=48, critRange 19 → ampliado
    const arco = makeChar({ mainHandWeaponName: 'Arco Curto' } as Partial<Character>);
    expect(vEval(arco, 'USUARIO', 'arma_principal_alcance')).toBe(0);  // não-melee
    expect(vEval(arco, 'USUARIO', 'arma_principal_alcance_curto')).toBe(24);
    expect(vEval(arco, 'USUARIO', 'arma_principal_alcance_longo')).toBe(48);
    expect(vEval(arco, 'USUARIO', 'arma_principal_crit_range')).toBe(19);
    expect(vEval(arco, 'USUARIO', 'arma_principal_crit_ampliado')).toBe(1);

    // Adaga: melee → reach 1.5
    const adaga = makeChar({ mainHandWeaponName: 'Adaga' } as Partial<Character>);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_alcance')).toBe(1.5);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_crit_range')).toBe(18);
    expect(vEval(adaga, 'USUARIO', 'arma_principal_crit_ampliado')).toBe(1);

    // Espada Grande: critRange 20 → não ampliado
    const grande = makeChar({ mainHandWeaponName: 'Espada Grande' } as Partial<Character>);
    expect(vEval(grande, 'USUARIO', 'arma_principal_crit_range')).toBe(20);
    expect(vEval(grande, 'USUARIO', 'arma_principal_crit_ampliado')).toBe(0);

    // Sem arma: critRange default 20, reach 0
    const semArma = makeChar();
    expect(vEval(semArma, 'USUARIO', 'arma_principal_crit_range')).toBe(20);
    expect(vEval(semArma, 'USUARIO', 'arma_principal_alcance')).toBe(0);
  });

  it('reacoes_usadas_nesta_rodada = max - atual', () => {
    const cheia = makeChar({ reactionsMax: 1, reactionsCurrent: 1 });
    expect(vEval(cheia, 'USUARIO', 'reacoes_usadas_nesta_rodada')).toBe(0);

    const usou = makeChar({ reactionsMax: 1, reactionsCurrent: 0 });
    expect(vEval(usou, 'USUARIO', 'reacoes_usadas_nesta_rodada')).toBe(1);

    const tres = makeChar({ reactionsMax: 3, reactionsCurrent: 1 });
    expect(vEval(tres, 'USUARIO', 'reacoes_usadas_nesta_rodada')).toBe(2);
  });
});

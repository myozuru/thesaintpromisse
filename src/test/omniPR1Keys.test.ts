/**
 * PR-1 — Auditoria das novas chaves: AdO, Visão/Iluminação e Dano expandido.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import type { Character } from '@/types';

const baseChar: Character = {
  id: 'pr1-1',
  name: 'PR1',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  reactionsMax: 1, reactionsCurrent: 1,
  attributes: [],
  skills: [],
  savingThrows: [],
} as unknown as Character;

describe('PR-1 — Visão & Iluminação (lê omniFlags com default 0)', () => {
  it('todas as chaves de visão resolvem 0 sem flags setadas', () => {
    const vars = montarVariaveisDoPersonagem(baseChar);
    for (const k of [
      'visao_normal', 'visao_penumbra', 'visao_escuridao',
      'na_escuridao', 'na_penumbra', 'esta_iluminado',
      'esta_oculto', 'linha_de_visao', 'atras_de_cobertura', 'fonte_de_luz_ativa',
    ]) {
      expect(avaliarFormula(`@USUARIO.${k}`, vars).valor).toBe(0);
    }
  });
  it('mestre pode setar visao_penumbra via omniFlags e a key reflete', () => {
    const c = { ...baseChar, omniFlags: { visao_penumbra: 1 } } as unknown as Character;
    const vars = montarVariaveisDoPersonagem(c);
    expect(avaliarFormula('@USUARIO.visao_penumbra', vars).valor).toBe(1);
    expect(avaliarFormula('@USUARIO.na_penumbra', vars).valor).toBe(1); // alias
  });
});

describe('PR-1 — AdO & Reações', () => {
  beforeEach(() => useOpportunityStore.setState({ grants: {}, pending: null }));

  it('sem grant: ado_concedida=0, modo=0, consumida=0, restrita=0', () => {
    const vars = montarVariaveisDoPersonagem(baseChar);
    expect(avaliarFormula('@USUARIO.ado_concedida', vars).valor).toBe(0);
    expect(avaliarFormula('@USUARIO.ado_modo', vars).valor).toBe(0);
    expect(avaliarFormula('@USUARIO.ado_consumida', vars).valor).toBe(0);
    expect(avaliarFormula('@USUARIO.ado_restrita', vars).valor).toBe(0);
  });

  it('grant reaction → ado_concedida=1, ado_modo=1', () => {
    useOpportunityStore.getState().grant([baseChar.id], 'reaction');
    const vars = montarVariaveisDoPersonagem(baseChar);
    expect(avaliarFormula('@USUARIO.ado_concedida', vars).valor).toBe(1);
    expect(avaliarFormula('@USUARIO.ado_modo', vars).valor).toBe(1);
  });

  it('grant action restrito → modo=2, restrita=1', () => {
    useOpportunityStore.getState().grant([baseChar.id], 'action', 'outro');
    const vars = montarVariaveisDoPersonagem(baseChar);
    expect(avaliarFormula('@USUARIO.ado_modo', vars).valor).toBe(2);
    expect(avaliarFormula('@USUARIO.ado_restrita', vars).valor).toBe(1);
  });

  it('grant either + consumed → modo=3, consumida=1', () => {
    useOpportunityStore.getState().grant([baseChar.id], 'either');
    useOpportunityStore.getState().consume(baseChar.id, 'reaction');
    const vars = montarVariaveisDoPersonagem(baseChar);
    expect(avaliarFormula('@USUARIO.ado_modo', vars).valor).toBe(3);
    expect(avaliarFormula('@USUARIO.ado_consumida', vars).valor).toBe(1);
  });

  it('reacoes_max / reacoes_restantes / reacao_usada_nesta_rodada', () => {
    const vars1 = montarVariaveisDoPersonagem(baseChar);
    expect(avaliarFormula('@USUARIO.reacoes_max', vars1).valor).toBe(1);
    expect(avaliarFormula('@USUARIO.reacoes_restantes', vars1).valor).toBe(1);
    expect(avaliarFormula('@USUARIO.reacao_usada_nesta_rodada', vars1).valor).toBe(0);

    const c2 = { ...baseChar, reactionsCurrent: 0 } as unknown as Character;
    const vars2 = montarVariaveisDoPersonagem(c2);
    expect(avaliarFormula('@USUARIO.reacao_usada_nesta_rodada', vars2).valor).toBe(1);
  });
});

describe('PR-1 — Dano (contexto) expandido', () => {
  it('todas as novas DANO.* resolvem finito (default 0 sem contexto)', () => {
    const vars = montarVariaveisDoPersonagem(baseChar);
    for (const k of [
      'DANO.valor_inicial', 'DANO.valor_final', 'DANO.absorvido',
      'DANO.id_origem', 'DANO.id_alvo', 'DANO.alcance',
      'DANO.foi_ataque_oportunidade', 'DANO.foi_furtivo', 'DANO.tipo_ataque',
    ]) {
      const v = avaliarFormula(`@USUARIO.${k}`, vars).valor;
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

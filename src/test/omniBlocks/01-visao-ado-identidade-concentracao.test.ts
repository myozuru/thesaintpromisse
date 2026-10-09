/**
 * LOTE 1 — Corretude semântica.
 * Grupos cobertos: 👁️ Visão (10), ⚡ AdO (7), 🪪 Identidade (3),
 * 🌀 Concentração (4). TOTAL: 24 chaves.
 *
 * Cada `it` configura um estado conhecido e compara o valor da chave
 * com o resultado calculado à mão a partir das regras do resolvedor.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetStores, makeChar, vEval } from './_helper';
import { useOpportunityStore } from '@/stores/useOpportunityStore';

beforeEach(() => resetStores());

// ════════════════════════════════════════════════════════════════════
// 👁️  VISÃO & ILUMINAÇÃO  (10 chaves — todas vêm de omniFlags)
// ════════════════════════════════════════════════════════════════════
describe('👁️ Visão & Iluminação', () => {
  it('default tudo = 0 quando omniFlags vazio', () => {
    const c = makeChar();
    for (const k of [
      'visao_normal','visao_penumbra','visao_escuridao',
      'na_escuridao','na_penumbra','esta_iluminado','esta_oculto',
      'linha_de_visao','atras_de_cobertura','fonte_de_luz_ativa',
    ]) {
      expect(vEval(c, 'USUARIO', k), k).toBe(0);
    }
  });

  it('flag ligada → 1', () => {
    const c = makeChar({ omniFlags: {
      visao_normal: 1, visao_penumbra: 1, visao_escuridao: 1,
      esta_iluminado: 1, esta_oculto: 1, linha_de_visao: 1,
      atras_de_cobertura: 1, fonte_de_luz_ativa: 1,
    } } as never);
    for (const k of [
      'visao_normal','visao_penumbra','visao_escuridao',
      'esta_iluminado','esta_oculto','linha_de_visao',
      'atras_de_cobertura','fonte_de_luz_ativa',
    ]) {
      expect(vEval(c, 'USUARIO', k), k).toBe(1);
    }
  });

  it('na_escuridao herda de visao_escuridao (fallback)', () => {
    const c = makeChar({ omniFlags: { visao_escuridao: 1 } } as never);
    expect(vEval(c, 'USUARIO', 'na_escuridao')).toBe(1);
  });

  it('na_penumbra herda de visao_penumbra (fallback)', () => {
    const c = makeChar({ omniFlags: { visao_penumbra: 1 } } as never);
    expect(vEval(c, 'USUARIO', 'na_penumbra')).toBe(1);
  });

  it('na_escuridao explícito vence o fallback', () => {
    const c = makeChar({ omniFlags: { visao_escuridao: 1, na_escuridao: 0 } } as never);
    expect(vEval(c, 'USUARIO', 'na_escuridao')).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// ⚡  ADO & REAÇÕES  (7 chaves)
// ════════════════════════════════════════════════════════════════════
describe('⚡ AdO & Reações', () => {
  it('default: 1 reação máxima, 1 disponível, nenhuma AdO concedida', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'reacoes_max')).toBe(1);
    expect(vEval(c, 'USUARIO', 'reacoes_restantes')).toBe(1);
    expect(vEval(c, 'USUARIO', 'reacao_usada_nesta_rodada')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ado_concedida')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ado_modo')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ado_consumida')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ado_restrita')).toBe(0);
  });

  it('reactionsCurrent < reactionsMax → reacao_usada_nesta_rodada = 1', () => {
    const c = makeChar({ reactionsCurrent: 0, reactionsMax: 2 });
    expect(vEval(c, 'USUARIO', 'reacoes_max')).toBe(2);
    expect(vEval(c, 'USUARIO', 'reacoes_restantes')).toBe(0);
    expect(vEval(c, 'USUARIO', 'reacao_usada_nesta_rodada')).toBe(1);
  });

  it('AdO concedida mode=either, restrita a alvo → modo=3, restrita=1', () => {
    useOpportunityStore.setState({
      grants: { hero: { mode: 'either', consumed: false, restrictToCharId: 'foe' } },
      pending: null,
    } as never);
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'ado_concedida')).toBe(1);
    expect(vEval(c, 'USUARIO', 'ado_modo')).toBe(3);
    expect(vEval(c, 'USUARIO', 'ado_consumida')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ado_restrita')).toBe(1);
  });

  it('mode=reaction → 1; mode=action → 2', () => {
    useOpportunityStore.setState({
      grants: { hero: { mode: 'reaction', consumed: false } }, pending: null,
    } as never);
    expect(vEval(makeChar(), 'USUARIO', 'ado_modo')).toBe(1);
    useOpportunityStore.setState({
      grants: { hero: { mode: 'action', consumed: false } }, pending: null,
    } as never);
    expect(vEval(makeChar(), 'USUARIO', 'ado_modo')).toBe(2);
  });

  it('consumed=true → ado_consumida = 1', () => {
    useOpportunityStore.setState({
      grants: { hero: { mode: 'reaction', consumed: true } }, pending: null,
    } as never);
    expect(vEval(makeChar(), 'USUARIO', 'ado_consumida')).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// 🪪  IDENTIDADE  (3 chaves — mutuamente exclusivas)
// ════════════════════════════════════════════════════════════════════
describe('🪪 Identidade', () => {
  it('PLAYER → eh_player=1, demais=0', () => {
    const c = makeChar({ category: 'PLAYER' });
    expect(vEval(c, 'USUARIO', 'eh_player')).toBe(1);
    expect(vEval(c, 'USUARIO', 'eh_npc')).toBe(0);
    expect(vEval(c, 'USUARIO', 'eh_inimigo')).toBe(0);
  });
  it('NPC → eh_npc=1, demais=0', () => {
    const c = makeChar({ category: 'NPC' as never });
    expect(vEval(c, 'USUARIO', 'eh_player')).toBe(0);
    expect(vEval(c, 'USUARIO', 'eh_npc')).toBe(1);
    expect(vEval(c, 'USUARIO', 'eh_inimigo')).toBe(0);
  });
  it('INIMIGO → eh_inimigo=1, demais=0', () => {
    const c = makeChar({ category: 'INIMIGO' });
    expect(vEval(c, 'USUARIO', 'eh_player')).toBe(0);
    expect(vEval(c, 'USUARIO', 'eh_npc')).toBe(0);
    expect(vEval(c, 'USUARIO', 'eh_inimigo')).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// 🌀  CONCENTRAÇÃO & SUSTENTADOS  (4 chaves)
// ════════════════════════════════════════════════════════════════════
describe('🌀 Concentração & Sustentados', () => {
  it('default: nada concentrando, slots = max (1/1)', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'qtd_concentrando')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_sustentados')).toBe(0);
    expect(vEval(c, 'USUARIO', 'slots_concentracao_livres')).toBe(1);
    expect(vEval(c, 'USUARIO', 'slots_sustentado_livres')).toBe(1);
  });

  it('lastSpellUsedId é histórico e não marca concentração ativa', () => {
    const c = makeChar({ lastSpellUsedId: 'fb1', maxConcentrationSlots: 3 } as never);
    expect(vEval(c, 'USUARIO', 'qtd_concentrando')).toBe(0);
    expect(vEval(c, 'USUARIO', 'concentrando')).toBe(0);
    expect(vEval(c, 'USUARIO', 'slots_concentracao_livres')).toBe(3);
  });

  it('concentrações ativas persistidas alimentam quantidade, estado e slots livres', () => {
    const c = makeChar({
      maxConcentrationSlots: 2,
      activeConcentrations: [
        { instanceId: 'c1', spellId: 's1', spellName: 'Névoa', targetIds: [], startedAt: 1 },
        { instanceId: 'c2', spellId: 's2', spellName: 'Barreira', targetIds: ['ally'], startedAt: 2 },
      ],
    } as never);
    expect(vEval(c, 'USUARIO', 'qtd_concentrando')).toBe(2);
    expect(vEval(c, 'USUARIO', 'concentrando')).toBe(1);
    expect(vEval(c, 'USUARIO', 'slots_concentracao_livres')).toBe(0);
  });

  it('vários buffs de uma mesma conjuração ocupam um único espaço sustentado', () => {
    const c = makeChar({
      maxSustainedSpells: 3,
      activeBuffs: [
        { spellName: 'Aura', isSustained: true, sustainInstanceId: 'cast-a' },
        { spellName: 'Aura', isSustained: true, sustainInstanceId: 'cast-a' },
        { spellName: 'Escudo', isSustained: true, sustainInstanceId: 'cast-b' },
      ],
    } as never);
    expect(vEval(c, 'USUARIO', 'qtd_sustentados')).toBe(2);
    expect(vEval(c, 'USUARIO', 'slots_sustentado_livres')).toBe(1);
  });

  it('activeBuffs isSustained / durationRounds=-1 contam como sustentados', () => {
    const c = makeChar({
      maxSustainedSpells: 4,
      activeBuffs: [
        { spellName: 'A', isSustained: true, durationRounds: 5 },
        { spellName: 'B', isSustained: false, durationRounds: -1 }, // permanente
        { spellName: 'C', isSustained: false, durationRounds: 3 },  // não sustentado
      ],
    } as never);
    expect(vEval(c, 'USUARIO', 'qtd_sustentados')).toBe(2);
    expect(vEval(c, 'USUARIO', 'slots_sustentado_livres')).toBe(2); // 4-2
  });

  it('slots de sustentação são limitados a zero; histórico não ocupa concentração', () => {
    const c = makeChar({
      maxConcentrationSlots: 1,
      lastSpellUsedId: 'x',
      maxSustainedSpells: 1,
      activeBuffs: [
        { spellName: 'A', isSustained: true },
        { spellName: 'B', isSustained: true },
        { spellName: 'C', isSustained: true },
      ],
    } as never);
    expect(vEval(c, 'USUARIO', 'slots_concentracao_livres')).toBe(1);
    expect(vEval(c, 'USUARIO', 'slots_sustentado_livres')).toBe(0);
  });
});

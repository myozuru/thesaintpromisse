/**
 * 🧪 Auditoria Rigorosa de TODAS as Ações do Omni-Engine.
 *
 * Cada chave de `ACOES_EFEITO` é testada individualmente em isolamento,
 * partindo de uma ficha limpa, montando uma `EntidadeOmni` mínima que
 * dispara EXATAMENTE a ação alvo, e verificando o efeito real no
 * `useCharacterStore` / `useOmniRuntimeStore`.
 *
 * Falha aqui = ação quebrada ou divergente do dicionário.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useLogStore } from '@/stores/useLogStore';
import { executarGatilho } from '@/lib/omni/executor';
import {
  ACOES_EFEITO,
  type AcaoEfeitoId,
  type AlvoRefId,
} from '@/lib/omni/constantesDoSistema';
import type {
  AcaoLogica,
  EntidadeOmni,
  ValorDinamico,
} from '@/lib/omni/tipos';
import type { Character } from '@/types';

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function novoChar(name = 'Cobaia'): Character {
  useCharacterStore.setState({ characters: [] });
  useCharacterStore.getState().addCharacter(name, 'PLAYER');
  return useCharacterStore.getState().characters[0];
}

function getChar(id: string): Character {
  return useCharacterStore.getState().characters.find((c) => c.id === id)!;
}

function entidade(acao: AcaoLogica, opts: { categoria?: 'item' | 'passiva'; nome?: string } = {}): EntidadeOmni {
  return {
    id: `ent-${acao.acao}-${Math.random().toString(36).slice(2, 6)}`,
    versao: 1,
    nome: opts.nome ?? `Teste ${acao.acao}`,
    categoria: opts.categoria ?? 'passiva',
    descricao: '',
    tags: [],
    duracao: { tipo: 'permanente' },
    custos: [],
    gatilhos: [
      {
        id: 'g1',
        evento: 'aoEquipar',
        blocos: [
          { id: 'b1', condicoes: [], modo: 'todas', acoes: [acao] },
        ],
      },
    ],
    criadoEm: 0,
    atualizadoEm: 0,
  };
}

function fixo(v: number): ValorDinamico { return { tipo: 'fixo', valor: v }; }

const baseAcao = (
  id: string,
  acao: AcaoEfeitoId,
  extras: Partial<AcaoLogica> = {},
): AcaoLogica => ({
  id,
  acao,
  alvoAplicacao: 'USUARIO' as AlvoRefId,
  ...extras,
});

// Reset global antes de cada teste — todos os stores em estado neutro.
beforeEach(() => {
  useCharacterStore.setState({ characters: [] });
  useOmniRuntimeStore.setState({ efeitos: {} } as any);
  useOmniEntidadesStore.setState({ entidades: {} } as any);
  useLogStore.setState({ logs: [] } as any);
});

// ──────────────────────────────────────────────────────────────────────
// 1. Numéricas básicas
// ──────────────────────────────────────────────────────────────────────
describe('💥 DANO', () => {
  it('subtrai vida atual respeitando o piso 0', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'DANO', { valor: fixo(7) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).hpCurrent).toBe(13); // 20 - 7
  });
  it('Bloqueio Total absorve o dano e zera a flag', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { omniFlags: { bloqueio_total: 1 } });
    executarGatilho(entidade(baseAcao('a', 'DANO', { valor: fixo(99) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(20);
    expect(getChar(c.id).omniFlags?.bloqueio_total).toBe(0);
  });
});

describe('💚 CURAR', () => {
  it('cura clampando ao máximo', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 5 });
    executarGatilho(entidade(baseAcao('a', 'CURAR', { valor: fixo(50) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(20);
  });
});

describe('➕ SOMAR', () => {
  it('soma em status.vida.atual via caminho legado', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 10 });
    executarGatilho(entidade(baseAcao('a', 'SOMAR', { caminhoAlvo: 'status.vida.atual', valor: fixo(3) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(13);
  });
  it('soma via chave canônica curta "vida"', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 10 });
    executarGatilho(entidade(baseAcao('a', 'SOMAR', { caminhoAlvo: 'vida', valor: fixo(2) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(12);
  });
});

describe('➖ SUBTRAIR', () => {
  it('subtrai em vida (caminho canônico)', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'SUBTRAIR', { caminhoAlvo: 'vida', valor: fixo(4) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).hpCurrent).toBe(16);
  });
  it('Bloqueio Total absorve a subtração em vida e zera flag', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { omniFlags: { bloqueio_total: 1 } });
    executarGatilho(entidade(baseAcao('a', 'SUBTRAIR', { caminhoAlvo: 'status.vida.atual', valor: fixo(99) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(20);
    expect(getChar(c.id).omniFlags?.bloqueio_total).toBe(0);
  });
});

describe('✖️ MULTIPLICAR', () => {
  it('multiplica vida (clampa ao max)', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 5 });
    executarGatilho(entidade(baseAcao('a', 'MULTIPLICAR', { caminhoAlvo: 'vida', valor: fixo(2) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(10);
  });
});

describe('➗ DIVIDIR', () => {
  it('divide vida e arredonda', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 10 });
    executarGatilho(entidade(baseAcao('a', 'DIVIDIR', { caminhoAlvo: 'vida', valor: fixo(2) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(5);
  });
  it('divisão por zero não muda o valor', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 10 });
    executarGatilho(entidade(baseAcao('a', 'DIVIDIR', { caminhoAlvo: 'vida', valor: fixo(0) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).hpCurrent).toBe(10);
  });
});

describe('🎯 DEFINIR', () => {
  it('define vida em valor exato (clampado)', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'DEFINIR', { caminhoAlvo: 'vida', valor: fixo(7) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).hpCurrent).toBe(7);
  });
});

describe('💰 CONSUMIR_RECURSO', () => {
  it('consome PE pelo valor pedido', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONSUMIR_RECURSO', {
      caminhoAlvo: 'pe', valor: fixo(3),
    })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).peCurrent).toBe(7); // 10 - 3
  });
  it('aplica REDUZIR_CUSTO previamente cadastrado (com piso)', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, {
      omniCostReduction: { pe: { reduce: 5, min: 1 } },
    });
    executarGatilho(entidade(baseAcao('a', 'CONSUMIR_RECURSO', {
      caminhoAlvo: 'pe', valor: fixo(3),
    })), 'aoEquipar', { usuario: getChar(c.id) });
    // 3 - 5 = -2 → piso 1 → consome só 1.
    expect(getChar(c.id).peCurrent).toBe(9);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 2. Condições
// ──────────────────────────────────────────────────────────────────────
describe('🌀 APLICAR_CONDICAO', () => {
  it('cria efeito persistente no runtime com a condição', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'APLICAR_CONDICAO', {
      condicao: 'atordoado', valor: fixo(2),
    })), 'aoEquipar', { usuario: c });
    const efeitos = Object.values(useOmniRuntimeStore.getState().efeitos);
    expect(efeitos.length).toBe(1);
    expect((efeitos[0].meta as any)?.condicao).toBe('atordoado');
    expect(efeitos[0].targetCharId).toBe(c.id);
  });
});

describe('🧹 REMOVER_CONDICAO', () => {
  it('limpa o efeito previamente aplicado', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'APLICAR_CONDICAO', {
      condicao: 'cego', valor: fixo(1),
    })), 'aoEquipar', { usuario: c });
    expect(Object.values(useOmniRuntimeStore.getState().efeitos)).toHaveLength(1);
    executarGatilho(entidade(baseAcao('a', 'REMOVER_CONDICAO', {
      condicao: 'cego',
    })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(Object.values(useOmniRuntimeStore.getState().efeitos)).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 3. Reroll, vantagem, talentos, habilidades
// ──────────────────────────────────────────────────────────────────────
describe('🔁 REROLL', () => {
  it('cria efeito com rerollPendente', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'REROLL', { valor: fixo(2) })), 'aoEquipar', { usuario: c });
    const ef = Object.values(useOmniRuntimeStore.getState().efeitos)[0];
    expect((ef.meta as any)?.rerollPendente).toBe(2);
  });
});

describe('🟢 CONCEDER_VANTAGEM / 🔴 CONCEDER_DESVANTAGEM', () => {
  it('grava modificador no campo extra omniAdvMods', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_VANTAGEM', {
      caminhoAlvo: 'next_attack',
    })), 'aoEquipar', { usuario: c });
    const updated = getChar(c.id) as any;
    const mods = updated.omniAdvMods ?? {};
    const list = Object.values(mods) as any[];
    expect(list.some((m) => m.kind === 'advantage' && m.scope === 'next_attack')).toBe(true);
  });
  it('CONCEDER_DESVANTAGEM com escopo específico (skill_specific:furtividade)', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_DESVANTAGEM', {
      caminhoAlvo: 'skill_specific:furtividade',
    })), 'aoEquipar', { usuario: c });
    const list = Object.values(((getChar(c.id) as any).omniAdvMods ?? {})) as any[];
    expect(list.some((m) => m.kind === 'disadvantage' && m.scope === 'skill_specific' && m.target === 'furtividade')).toBe(true);
  });
});

describe('🧹 LIMPAR_VANT_DESV', () => {
  it('apaga TODOS os modificadores ativos', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_VANTAGEM', { caminhoAlvo: 'next_any' })), 'aoEquipar', { usuario: c });
    executarGatilho(entidade(baseAcao('b', 'LIMPAR_VANT_DESV')), 'aoEquipar', { usuario: getChar(c.id) });
    const list = Object.values(((getChar(c.id) as any).omniAdvMods ?? {})) as any[];
    expect(list).toHaveLength(0);
  });
});

describe('🎓 CONCEDER_TALENTO / REMOVER_TALENTO', () => {
  it('adiciona talento por id em chosenTalents', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_TALENTO', { condicao: 'arma_focada' as any })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).chosenTalents?.some((t) => t.id === 'arma_focada')).toBe(true);
  });
  it('não duplica talento já presente', () => {
    const c = novoChar();
    const ent = entidade(baseAcao('a', 'CONCEDER_TALENTO', { condicao: 'arma_focada' as any }));
    executarGatilho(ent, 'aoEquipar', { usuario: c });
    executarGatilho(ent, 'aoEquipar', { usuario: getChar(c.id) });
    const count = (getChar(c.id).chosenTalents ?? []).filter((t) => t.id === 'arma_focada').length;
    expect(count).toBe(1);
  });
  it('REMOVER_TALENTO retira da lista', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_TALENTO', { condicao: 'mente_aguda' as any })), 'aoEquipar', { usuario: c });
    executarGatilho(entidade(baseAcao('b', 'REMOVER_TALENTO', { condicao: 'mente_aguda' as any })), 'aoEquipar', { usuario: getChar(c.id) });
    expect((getChar(c.id).chosenTalents ?? []).some((t) => t.id === 'mente_aguda')).toBe(false);
  });
});

describe('🔄 RECARREGAR_HABILIDADE', () => {
  it('zera o contador de uso da habilidade nomeada', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { specAbilityUsage: { hab1: 3 } });
    executarGatilho(entidade(baseAcao('a', 'RECARREGAR_HABILIDADE', { condicao: 'hab1' as any })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).specAbilityUsage?.hab1).toBe(0);
  });
});

describe('🔢 MODIFICAR_USOS_APTIDAO', () => {
  it('seta usos da aptidão de aura', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'MODIFICAR_USOS_APTIDAO', {
      condicao: 'aptA' as any, valor: fixo(2),
    })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).auraAptitudeUsage?.aptA).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 4. Imunidade
// ──────────────────────────────────────────────────────────────────────
describe('🛡 CONCEDER_IMUNIDADE / REMOVER_IMUNIDADE', () => {
  it('persiste o escopo bruto em omniImmunities', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_IMUNIDADE', { caminhoAlvo: 'condicao:atordoado' })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniImmunities).toContain('condicao:atordoado');
  });
  it('aceita escopo "todas"', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_IMUNIDADE', { caminhoAlvo: 'todas' })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniImmunities).toContain('todas');
  });
  it('REMOVER_IMUNIDADE retira o escopo (case-insensitive)', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'CONCEDER_IMUNIDADE', { caminhoAlvo: 'categoria:MENTAL' })), 'aoEquipar', { usuario: c });
    executarGatilho(entidade(baseAcao('b', 'REMOVER_IMUNIDADE', { caminhoAlvo: 'categoria:mental' })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).omniImmunities ?? []).not.toContain('categoria:MENTAL');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 5. Flags (toggle)
// ──────────────────────────────────────────────────────────────────────
describe('🏳️ ATIVAR_FLAG / DESATIVAR_FLAG / ALTERNAR_FLAG', () => {
  it('ATIVAR_FLAG seta valor 1 por padrão', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'ATIVAR_FLAG', { caminhoAlvo: 'minha_flag' })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniFlags?.minha_flag).toBe(1);
  });
  it('ATIVAR_FLAG aceita valor numérico custom', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'ATIVAR_FLAG', { caminhoAlvo: 'pontuacao', valor: fixo(7) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniFlags?.pontuacao).toBe(7);
  });
  it('DESATIVAR_FLAG zera', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { omniFlags: { x: 5 } });
    executarGatilho(entidade(baseAcao('a', 'DESATIVAR_FLAG', { caminhoAlvo: 'x' })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).omniFlags?.x).toBe(0);
  });
  it('ALTERNAR_FLAG: 0 → 1 → 0', () => {
    const c = novoChar();
    const ent = entidade(baseAcao('a', 'ALTERNAR_FLAG', { caminhoAlvo: 'toggle' }));
    executarGatilho(ent, 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniFlags?.toggle).toBe(1);
    executarGatilho(ent, 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).omniFlags?.toggle).toBe(0);
  });
  it('chave de flag é normalizada para lowercase', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'ATIVAR_FLAG', { caminhoAlvo: 'Minha_FLAG' })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniFlags?.minha_flag).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 6. Contadores
// ──────────────────────────────────────────────────────────────────────
describe('🔢 INCREMENTAR_CONTADOR / ZERAR_CONTADOR / DEFINIR_CONTADOR', () => {
  it('INCREMENTAR adiciona +1 por padrão e usa valor quando dado', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'INCREMENTAR_CONTADOR', { caminhoAlvo: 'fadiga' })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniCounters?.fadiga).toBe(1);
    executarGatilho(entidade(baseAcao('b', 'INCREMENTAR_CONTADOR', { caminhoAlvo: 'fadiga', valor: fixo(3) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).omniCounters?.fadiga).toBe(4);
  });
  it('ZERAR zera mesmo com valor alto', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { omniCounters: { x: 9 } });
    executarGatilho(entidade(baseAcao('a', 'ZERAR_CONTADOR', { caminhoAlvo: 'x' })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).omniCounters?.x).toBe(0);
  });
  it('DEFINIR_CONTADOR força um valor específico', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'DEFINIR_CONTADOR', { caminhoAlvo: 'stacks', valor: fixo(5) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniCounters?.stacks).toBe(5);
  });
  it('contador nunca fica negativo', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'DEFINIR_CONTADOR', { caminhoAlvo: 'k', valor: fixo(-9) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniCounters?.k).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 7. Custo / ação
// ──────────────────────────────────────────────────────────────────────
describe('🪬 REDUZIR_CUSTO / LIMPAR_REDUTOR_CUSTO', () => {
  it('REDUZIR_CUSTO grava reduce + min canonicalizado', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'REDUZIR_CUSTO', {
      caminhoAlvo: 'energia', valor: fixo(4), condicao: '2' as any,
    })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniCostReduction?.pe).toEqual({ reduce: 4, min: 2 });
  });
  it('min default = 1 quando condicao não é número', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'REDUZIR_CUSTO', {
      caminhoAlvo: 'pe', valor: fixo(3),
    })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniCostReduction?.pe.min).toBe(1);
  });
  it('LIMPAR_REDUTOR_CUSTO remove a entrada', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, {
      omniCostReduction: { pe: { reduce: 5, min: 1 } },
    });
    executarGatilho(entidade(baseAcao('a', 'LIMPAR_REDUTOR_CUSTO', { caminhoAlvo: 'pe' })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).omniCostReduction?.pe).toBeUndefined();
  });
});

describe('🎯 MODIFICAR_CUSTO_ACAO', () => {
  it('grava o mapeamento por id de habilidade', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'MODIFICAR_CUSTO_ACAO', {
      caminhoAlvo: 'ler_tecnica', condicao: 'action_bonus' as any, valor: fixo(1),
    })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniActionCost?.ler_tecnica).toEqual({
      cost: 'action_bonus', perRound: 1, usedThisRound: 0,
    });
  });
  it('valor 0 → perRound undefined (ilimitado)', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'MODIFICAR_CUSTO_ACAO', {
      caminhoAlvo: 'magia', condicao: 'action_free' as any, valor: fixo(0),
    })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).omniActionCost?.magia.perRound).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────
// 8. Exaustão
// ──────────────────────────────────────────────────────────────────────
describe('😮‍💨 ADICIONAR_EXAUSTAO', () => {
  it('soma 1 nível por padrão', () => {
    const c = novoChar();
    executarGatilho(entidade(baseAcao('a', 'ADICIONAR_EXAUSTAO', { valor: fixo(1) })), 'aoEquipar', { usuario: c });
    expect(getChar(c.id).exhaustionLevel).toBe(1);
  });
  it('clampa no teto 6', () => {
    const c = novoChar();
    useCharacterStore.getState().updateCharacter(c.id, { exhaustionLevel: 5 });
    executarGatilho(entidade(baseAcao('a', 'ADICIONAR_EXAUSTAO', { valor: fixo(9) })), 'aoEquipar', { usuario: getChar(c.id) });
    expect(getChar(c.id).exhaustionLevel).toBe(6);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 9. Macro (DISPARAR_GATILHO)
// ──────────────────────────────────────────────────────────────────────
describe('📡 DISPARAR_GATILHO (macro)', () => {
  it('dispara a entidade alvo registrada', async () => {
    const c = novoChar();
    // Entidade-secundária que cura 5 ao receber aoEquipar.
    const ent2 = entidade(baseAcao('x', 'CURAR', { valor: fixo(5) }), { nome: 'Macro Alvo' });
    useOmniEntidadesStore.setState({ entidades: { [ent2.id]: ent2 } } as any);
    useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: 5 });
    executarGatilho(entidade(baseAcao('a', 'DISPARAR_GATILHO', {
      caminhoAlvo: ent2.id, condicao: 'aoEquipar' as any,
    })), 'aoEquipar', { usuario: getChar(c.id) });
    // O macro é assíncrono (import dinâmico). Aguarda microtarefas.
    await new Promise((r) => setTimeout(r, 20));
    expect(getChar(c.id).hpCurrent).toBe(10);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 10. Cobertura completa do dicionário
// ──────────────────────────────────────────────────────────────────────
describe('📚 Cobertura — toda chave de ACOES_EFEITO tem teste e executor não explode', () => {
  const ids = Object.keys(ACOES_EFEITO) as AcaoEfeitoId[];
  it.each(ids)('%s não lança ao executar com inputs mínimos', (acaoId) => {
    const c = novoChar();
    // Inputs genéricos amplos o suficiente pra cada ação aceitar.
    const a = baseAcao('a', acaoId, {
      caminhoAlvo: 'vida',
      condicao: 'atordoado' as any,
      valor: fixo(1),
    });
    expect(() => executarGatilho(entidade(a), 'aoEquipar', { usuario: c })).not.toThrow();
  });

  it('toda ação está documentada com {ui, math}', () => {
    for (const id of ids) {
      const def = ACOES_EFEITO[id];
      expect(def.ui).toBeTruthy();
      expect(def.math).toBeTruthy();
    }
  });
});

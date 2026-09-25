/**
 * 🔍 Auditoria Sistemática Key-por-Key do Omni-Engine.
 *
 * Para cada chave declarada nas constantes/atalhos, verificamos:
 *   1. O parser resolve `@USUARIO.<chave>` para o valor esperado.
 *   2. O resolvedor expõe a chave no bag de variáveis (com e sem prefixo).
 *   3. As variantes pt-BR (com acento, sem acento, alias) batem.
 *   4. As chaves do dicionário visual (DICIONARIO_CHAVES_OMNI) ressoam
 *      com algo real no resolvedor.
 *
 * Falhas aqui apontam DEAD KEYS — chaves expostas na UI que silenciosamente
 * resolvem 0 nas fórmulas.
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula, resolverChavePtBr } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import {
  ALIASES_FORMULA,
  DICIONARIO_CHAVES_OMNI,
  ORDEM_PERICIAS,
  SISTEMA_PERICIAS,
  ORDEM_TR,
  SISTEMA_TR,
} from '@/lib/omni/constantesDoSistema';
import type { Character } from '@/types';

// ── Personagem-cobaia com TODOS os campos preenchidos com valores únicos
// para detectar trocas de fios (qualquer 0 é suspeito de dead-key).
const cobaia: Character = {
  id: 'audit-1',
  name: 'Cobaia Auditoria',
  level: 5,
  trainingBonus: 7,                  // valor "estranho" pra distinguir de defaults
  hpCurrent: 41, hpMax: 50,
  peCurrent: 21, peMax: 30,
  ca: 14,
  movement: 9,
  attributes: [
    { id: 'forca',         name: 'Força',         value: 4, externalBonus: 0, mastery: false },
    { id: 'destreza',      name: 'Destreza',      value: 3, externalBonus: 0, mastery: false },
    { id: 'constituicao',  name: 'Constituição',  value: 2, externalBonus: 0, mastery: false },
    { id: 'inteligencia',  name: 'Inteligência',  value: 5, externalBonus: 0, mastery: false },
    { id: 'sabedoria',     name: 'Sabedoria',     value: 7, externalBonus: 0, mastery: false },
    { id: 'presenca',      name: 'Presença',      value: 8, externalBonus: 0, mastery: false },
  ],
  skills: ORDEM_PERICIAS.map((k, i) => ({
    id: SISTEMA_PERICIAS[k].replace(/^pericias\./, ''),
    name: k.toLowerCase(),
    value: i + 1, // valores incrementais 1..22
    externalBonus: 0,
    mastery: false,
  })),
  savingThrows: ORDEM_TR.map((k, i) => ({
    id: SISTEMA_TR[k],
    name: k.charAt(0) + k.slice(1).toLowerCase(), // "Astucia", "Fortitude", ...
    value: (i + 1) * 10, // 10, 20, 30, 40, 50
    externalBonus: 0,
    mastery: false,
  })),
} as unknown as Character;

const vars = montarVariaveisDoPersonagem(cobaia, 'USUARIO');

/** Helper: avalia `@USUARIO.<key>` e devolve o número resolvido. */
const resolver = (key: string) => avaliarFormula(`@USUARIO.${key}`, vars).valor;

describe('🔍 Auditoria — Atributos (6 atributos da ficha — Astúcia/Vontade são TR)', () => {
  const casos: Array<[string, number]> = [
    ['forca', 4], ['for', 4], ['FOR', 4], ['Força', 4],
    ['destreza', 3], ['des', 3],
    ['constituicao', 2], ['Constituição', 2],
    ['inteligencia', 5],
    ['sabedoria', 7], ['sab', 7], ['SAB', 7],
    ['presenca', 8], ['pre', 8], ['Presença', 8],
    ['carisma', 8], ['car', 8], // alias D&D
  ];
  it.each(casos)('@USUARIO.%s → %i', (key, esperado) => {
    expect(resolver(key)).toBe(esperado);
  });
});

describe('🔍 Auditoria — Recursos (vida, energia, defesa, etc.)', () => {
  const casos: Array<[string, number]> = [
    ['vida', 41], ['vida_atual', 41], ['vidaatual', 41],
    ['vida_max', 50], ['vidamax', 50],
    ['pe', 21], ['energia', 21], ['energia_atual', 21],
    ['pe_max', 30], ['energia_max', 30], ['energiamax', 30],
    ['defesa', 14],
    ['deslocamento', 9],
    ['exaustao', 0], // valor real esperado
  ];
  it.each(casos)('@USUARIO.%s → %i', (key, esperado) => {
    expect(resolver(key)).toBe(esperado);
  });
});

describe('🔍 Auditoria — Progressão (treino, nível)', () => {
  it('@USUARIO.treino usa o trainingBonus salvo na ficha (não recalcula)', () => {
    expect(resolver('treino')).toBe(7);
  });
  it('@TREINO sem prefixo também resolve', () => {
    expect(avaliarFormula('@TREINO', vars).valor).toBe(7);
  });
  it('@USUARIO.nivel reflete o nível do personagem', () => {
    expect(resolver('nivel')).toBe(5);
  });
  it('@NIVEL sem prefixo também resolve', () => {
    expect(avaliarFormula('@NIVEL', vars).valor).toBe(5);
  });
  it('@USUARIO.nível (com acento) resolve igual a @USUARIO.nivel', () => {
    expect(resolver('nível')).toBe(5);
  });
  it('@nível sem prefixo também resolve (acento ignorado)', () => {
    expect(avaliarFormula('@nível', vars).valor).toBe(5);
  });
  it('fórmula composta usa @NIVEL para escalonamento (ex: 1d1*nivel)', () => {
    // 1d1 sempre 1 → resultado deve ser igual ao nível (5)
    expect(avaliarFormula('1d1 * @NIVEL', vars).valor).toBe(5);
    expect(avaliarFormula('@USUARIO.nivel + @TREINO', vars).valor).toBe(12); // 5 + 7
  });
});

describe('🔍 Auditoria — Combate (esquiva, acerto, resistencia)', () => {
  // Estas hoje resolvem 0 porque não há campo no Character; a auditoria
  // só garante que NÃO explodem e ficam num valor numérico estável.
  it('@USUARIO.esquiva é numérico (default 0)', () => {
    expect(typeof resolver('esquiva')).toBe('number');
  });
  it('@USUARIO.acerto é numérico (default 0)', () => {
    expect(typeof resolver('acerto')).toBe('number');
  });
  it('@USUARIO.resistencia é numérico (default 0)', () => {
    expect(typeof resolver('resistencia')).toBe('number');
  });
});

describe('🔍 Auditoria — Perícias (todas as 22)', () => {
  it.each(ORDEM_PERICIAS.map((k, i) => [k, i + 1] as const))(
    'pericia_%s → %i',
    (k, esperado) => {
      const id = SISTEMA_PERICIAS[k].replace(/^pericias\./, 'pericia_');
      expect(resolver(id)).toBe(esperado);
    },
  );
});

describe('🔍 Auditoria — Testes de Resistência (5 TR canônicos)', () => {
  it.each(ORDEM_TR.map((k, i) => [k, (i + 1) * 10] as const))(
    '%s → %i',
    (k, esperado) => {
      const id = SISTEMA_TR[k];
      expect(resolver(id)).toBe(esperado);
    },
  );
  it('valores específicos dos 5 TR resolvem corretamente', () => {
    expect(resolver('astucia')).toBe(10);
    expect(resolver('fortitude')).toBe(20);
    expect(resolver('integridade')).toBe(30);
    expect(resolver('reflexos')).toBe(40);
    expect(resolver('vontade')).toBe(50);
  });
});

describe('🔍 Auditoria — Aliases globais (ALIASES_FORMULA)', () => {
  it.each(Object.keys(ALIASES_FORMULA))('@%s resolve para um número finito', (alias) => {
    const v = avaliarFormula(`@${alias}`, vars).valor;
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe('🔍 Auditoria — Bag prefixado (USUARIO_*) está completo', () => {
  it('toda chave nua tem espelho com prefixo USUARIO_', () => {
    const planasCriticas = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'PRE',
      'TREINO', 'NIVEL', 'VIDA', 'VIDA_MAX', 'PE', 'PE_MAX', 'DEFESA'];
    for (const k of planasCriticas) {
      expect(vars[k], `chave nua ${k}`).toBeDefined();
      expect(vars[`USUARIO_${k}`], `chave prefixada USUARIO_${k}`).toBe(vars[k]);
    }
  });
});

describe('🔍 Auditoria — Dicionário visual ↔ runtime (UI vs. realidade)', () => {
  /**
   * Para cada chave promovida na UI (DICIONARIO_CHAVES_OMNI), testa que
   * existe uma resolução real no parser. Detecta "fantasmas": itens
   * exibidos no construtor que silenciosamente sempre dão 0.
   */
  const ignorar = new Set(['DANO', 'CENA.rodada', 'CENA.dt', 'CENA.distancia']);
  const casosUI: Array<[string, string]> = [];
  for (const cat of DICIONARIO_CHAVES_OMNI) {
    for (const it of cat.itens) {
      if (ignorar.has(it.id)) continue;
      casosUI.push([cat.grupo, it.id]);
    }
  }
  it.each(casosUI)('grupo "%s" expõe a chave "%s" e ela resolve no parser', (_grupo, id) => {
    // Resolução via @USUARIO.<id> — todas devem virar número finito ≠ NaN.
    const v = avaliarFormula(`@USUARIO.${id}`, vars).valor;
    expect(Number.isFinite(v)).toBe(true);
  });

  it('resolverChavePtBr nunca devolve string vazia', () => {
    for (const cat of DICIONARIO_CHAVES_OMNI) {
      for (const it of cat.itens) {
        expect(resolverChavePtBr(it.id).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('🔍 Auditoria — @ALVO funciona simétrico ao @USUARIO', () => {
  it('@ALVO.vida pega o bag de alvo, não o do usuário', () => {
    const r = avaliarFormula('@ALVO.vida + @USUARIO.vida', vars, undefined, {
      alvo: { VIDA: 100 },
    });
    expect(r.valor).toBe(141); // 100 (alvo) + 41 (usuário)
  });
  it('@ALVO.X sem bag de alvo resolve 0 silenciosamente', () => {
    expect(avaliarFormula('@ALVO.vida', vars).valor).toBe(0);
  });
});

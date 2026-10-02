import { describe, it, expect } from 'vitest';
import type { Character } from '@/types';
import type { EntidadeOmni, ValorDinamico } from '@/lib/omni/tipos';
import { novaEntidade } from '@/lib/omni/tipos';
import { simplificarKeysEntidade } from '@/lib/omni/simplificarKeys';
import { lerCaminhoOmni, montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { executarGatilho } from '@/lib/omni/executor';

const usuario = {
  id: 'scoped-user', name: 'Usuário', level: 3, trainingBonus: 2,
  hpCurrent: 17, hpMax: 30, peCurrent: 6, peMax: 12,
  ca: 14, movement: 9, exhaustionLevel: 3,
  attributes: [{ id: 'forca', name: 'Força', value: 4 }],
  skills: [{ id: 'feiticaria', name: 'Feitiçaria', value: 7 }],
  savingThrows: [{ id: 'fortitude', name: 'Fortitude', value: 5 }],
  omniFlags: { flag_foco: 1 }, omniCounters: { rancor: 8 },
} as unknown as Character;
const alvo = { ...usuario, id: 'scoped-target', hpCurrent: 23,
  attributes: [{ id: 'forca', name: 'Força', value: 11 }],
} as unknown as Character;

function entidadeComFormula(expressao: string): EntidadeOmni {
  return {
    ...novaEntidade('item', 'Teste de escopos'),
    gatilhos: [{ id: 'g', evento: 'aoEquipar', blocos: [{
      id: 'b', condicoes: [], modo: 'todas', acoes: [{
        id: 'a', acao: 'SOMAR', alvoAplicacao: 'ALVO', caminhoAlvo: 'vida',
        valor: { tipo: 'formula', expressao },
      }],
    }] }],
  };
}

function migrarFormula(expressao: string): string {
  const ent = simplificarKeysEntidade(entidadeComFormula(expressao));
  const valor = ent.gatilhos[0].blocos[0].acoes[0].valor as ValorDinamico;
  if (valor.tipo !== 'formula') throw new Error('Fórmula esperada');
  return valor.expressao;
}

describe('Migração de fórmulas preserva escopos', () => {
  it.each([
    ['@ALVO.forca + @USUARIO.forca', '@ALVO.for + @USUARIO.for'],
    ['@ALVO.status.vida.atual', '@ALVO.vida'],
    ['@USUARIO.atributos.forca', '@USUARIO.for'],
    ['@USUARIO.pericias.oficio1', '@USUARIO.pericia_oficio1'],
    ['@CENA.distancia + @ITEM.usos_restantes', '@CENA.distancia + @ITEM.usos_restantes'],
    ['@CENA.defesa + @ITEM.forca', '@CENA.defesa + @ITEM.forca'],
    ['@AREA.raio', '@AREA.raio'],
    ['atributos.forca + status.bonusTreinamento', 'for + treino'],
  ])('%s → %s', (entrada, esperado) => {
    expect(migrarFormula(entrada)).toBe(esperado);
    expect(migrarFormula(esperado)).toBe(esperado);
  });

  it('mantém valores distintos do usuário, alvo, cena e item', () => {
    const vars = { ...montarVariaveisDoPersonagem(usuario, 'USUARIO'),
      ...montarVariaveisDoPersonagem(alvo, 'ALVO') };
    const expr = migrarFormula('@ALVO.forca - @USUARIO.forca + @CENA.distancia + @ITEM.usos_restantes');
    expect(avaliarFormula(expr, vars, undefined, {
      cena: { DISTANCIA: 13 }, item: { usos_restantes: 2 },
    }).valor).toBe(22);
  });

  it('o alias curto de deslocamento continua avaliável após a migração', () => {
    const expr = migrarFormula('@USUARIO.status.deslocamento');
    expect(expr).toBe('@USUARIO.desloc');
    expect(avaliarFormula(expr, montarVariaveisDoPersonagem(usuario)).valor).toBe(9);
  });

  it('migra fórmulas nos custos e nos dois operandos das condições', () => {
    const ent = entidadeComFormula('@ALVO.forca');
    ent.custos = [{ caminhoRecurso: 'pe', valor: { tipo: 'formula', expressao: '@USUARIO.forca' } }];
    ent.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'MAIOR_QUE',
      esquerdo: { tipo: 'formula', expressao: '@ALVO.status.vida.atual' },
      direito: { tipo: 'formula', expressao: '@USUARIO.status.vida.atual' },
    }];
    const migrada = simplificarKeysEntidade(ent);
    expect(migrada.custos[0].valor).toEqual({ tipo: 'formula', expressao: '@USUARIO.for' });
    expect(migrada.gatilhos[0].blocos[0].condicoes[0].esquerdo).toEqual({ tipo: 'formula', expressao: '@ALVO.vida' });
    expect(migrada.gatilhos[0].blocos[0].condicoes[0].direito).toEqual({ tipo: 'formula', expressao: '@USUARIO.vida' });
    expect(simplificarKeysEntidade(migrada)).toEqual(migrada);
  });
});

describe('Leitura de referências curtas do construtor', () => {
  it.each([
    ['vida', 17], ['status.vida.atual', 17], ['@USUARIO.vida', 17],
    ['hp', 17], ['vida_max', 30], ['pe', 6], ['energia', 6],
    ['for', 4], ['atributos.forca', 4], ['Força', 4],
    ['desloc', 9], ['deslocamento', 9], ['treino', 2],
    ['exaustao', 3], ['status.nivelExaustao', 3],
    ['pericia_feiticaria', 7], ['pericias.feiticaria', 7], ['Feitiçaria', 7],
    ['fortitude', 5], ['tr.fortitude', 5],
    ['contador_rancor', 8], ['flag_foco', 1], ['vida_pct', 57],
    ['key_inexistente', 0], ['', 0],
  ])('%s resolve %s', (key, esperado) => {
    expect(lerCaminhoOmni(usuario, key)).toBe(esperado);
  });

  it('usa a ficha recebida ao ler uma referência de alvo', () => {
    expect(lerCaminhoOmni(alvo, '@ALVO.vida')).toBe(23);
  });

  it('condições do construtor mantêm o resultado após simplificação', () => {
    const ent = entidadeComFormula('1');
    ent.gatilhos[0].blocos[0].acoes = [];
    ent.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'MAIOR_QUE',
      esquerdo: { tipo: 'ref', ref: { alvo: 'ALVO', caminho: 'status.vida.atual' } },
      direito: { tipo: 'ref', ref: { alvo: 'USUARIO', caminho: 'status.vida.atual' } },
    }];
    const migrada = simplificarKeysEntidade(ent);
    expect(executarGatilho(ent, 'aoEquipar', { usuario, alvo })).toBe(1);
    expect(executarGatilho(migrada, 'aoEquipar', { usuario, alvo })).toBe(1);
    expect(executarGatilho(migrada, 'aoEquipar', { usuario: alvo, alvo: usuario })).toBe(0);
  });
});

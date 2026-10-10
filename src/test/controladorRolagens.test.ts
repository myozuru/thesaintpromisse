import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';
import {
  calcularBonusAtaqueInvocacao,
  calcularBonusPericiaInvocacao,
  calcularBonusDanoInvocacao,
  calcularCDInvocacao,
  multiplicarDadosCriticos,
  parseFormulaDanoInvocacao,
  resolverAcertoInvocacao,
} from '@/lib/controlador/rolagens';

const dono = (level: number) => ({ level }) as Character;
function modelo(overrides: Partial<InvocacaoControlador> = {}): InvocacaoControlador {
  return {
    id: 'shiki', nome: 'Shiki', donoCharacterId: 'dono', tipo: 'shikigami',
    hpAtual: 20, hpMaximo: 20, defesa: 14, deslocamentoM: 9, porte: 'Médio',
    custoInvocacaoPE: 2, acoes: [],
    atributos: { forca: 16, destreza: 14, constituicao: 12, inteligencia: 10, sabedoria: 12, presenca: 14 },
    ...overrides,
  };
}

describe('Rolagens independentes do Shikigami', () => {
  it('soma atributo, metade do nível, treino por tipo e bônus configurado no ataque', () => {
    const ficha = modelo({ ataqueTreinado: { tipo: 'corpo_a_corpo', atributo: 'forca', bonus: 1 } });
    const resultado = calcularBonusAtaqueInvocacao(dono(6), ficha, {
      id: 'mordida', nome: 'Mordida', tipo: 'ataque', tipoAtaque: 'corpo_a_corpo',
      atributoAtaque: 'forca', bonusAtaque: 2,
    });
    expect(resultado).toMatchObject({
      total: 12, modificadorAtributo: 3, metadeNivel: 3, treinamento: 3,
      bonusConfigurado: 3, atributo: 'forca', tipo: 'corpo_a_corpo',
    });
  });

  it('aplica perícia treinada com o atributo base da ficha e mantém o caso sem treino', () => {
    const ficha = modelo({ atributoBasePericias: 'sabedoria', periciasTreinadas: ['acrobacia'] });
    expect(calcularBonusPericiaInvocacao(dono(6), ficha, 'acrobacia')).toEqual({
      total: 7, atributo: 'sabedoria', modificadorAtributo: 1, metadeNivel: 3, treinamento: 3, treinada: true,
    });
    expect(calcularBonusPericiaInvocacao(dono(6), ficha, 'furtividade')).toMatchObject({
      total: 4, treinada: false, treinamento: 0,
    });
    expect(calcularBonusPericiaInvocacao(dono(6), modelo(), 'acrobacia')).toBeNull();
  });

  it('calcula CD de TR com metade do nível mínima 1 e atributo escolhido', () => {
    expect(calcularCDInvocacao(dono(1), modelo(), 'presenca')).toBe(13);
    expect(calcularCDInvocacao(dono(6), modelo(), undefined)).toBeNull();
  });

  it('soma o modificador relevante ao dano e dobra no grau especial, com opção de regra própria', () => {
    const ataque = { id: 'mordida', nome: 'Mordida', tipoAtaque: 'corpo_a_corpo' as const, atributoAtaque: 'forca' as const };
    expect(calcularBonusDanoInvocacao(modelo(), ataque, 'ataque')).toBe(3);
    expect(calcularBonusDanoInvocacao(modelo({ grau: 'especial' }), ataque, 'ataque')).toBe(6);
    expect(calcularBonusDanoInvocacao(modelo(), { ...ataque, atributoDano: 'presenca', multiplicadorDanoAtributo: 0 }, 'ataque')).toBe(0);
  });

  it('trata 1 natural como falha e crítico conforme a margem configurada', () => {
    expect(resolverAcertoInvocacao(1, 50, 10)).toMatchObject({ total: 51, acertou: false, critico: false, falhaCritica: true });
    expect(resolverAcertoInvocacao(19, 0, 30, 19)).toMatchObject({ total: 19, acertou: true, critico: true, falhaCritica: false });
    expect(resolverAcertoInvocacao(10, 2, 12)).toMatchObject({ acertou: true, critico: false });
  });

  it('aceita dano com grupos diferentes e bônus fixo, e rejeita expressões fora da gramática', () => {
    expect(parseFormulaDanoInvocacao('2d12 + 1d6 + 3')).toEqual({ dados: [{ count: 2, sides: 12 }, { count: 1, sides: 6 }], fixo: 3 });
    expect(parseFormulaDanoInvocacao('41d6')).toBeNull();
    expect(parseFormulaDanoInvocacao('1d30')).toBeNull();
    expect(parseFormulaDanoInvocacao('1d6; alert(1)')).toBeNull();
    expect(parseFormulaDanoInvocacao('-2+1d6')).toBeNull();
  });

  it('multiplica os dados críticos sem multiplicar o bônus fixo', () => {
    expect(multiplicarDadosCriticos([{ count: 1, sides: 12 }, { count: 1, sides: 6 }], 2))
      .toEqual([{ count: 2, sides: 12 }, { count: 2, sides: 6 }]);
  });
});

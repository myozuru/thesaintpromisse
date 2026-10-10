import { describe, expect, it } from 'vitest';
import { calcularEfeitoSuporte } from '@/lib/controlador/suporte';
import { bonusPericiaCaracteristicas, bonusPVCaracteristicas, reducaoDanoCaracteristicas } from '@/lib/controlador/passivas';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';

function acao(
  efeito: NonNullable<InvocacaoControlador['acoes'][number]['efeitoSuporte']>,
  categoriaAcao: NonNullable<InvocacaoControlador['acoes'][number]['categoriaAcao']> = 'acao_complexa',
) {
  return { categoriaAcao, efeitoSuporte: efeito };
}

function modelo(grau: NonNullable<InvocacaoControlador['grau']>, caracteristicas: unknown[] = []): Pick<InvocacaoControlador, 'grau' | 'atributos' | 'caracteristicas'> {
  return {
    grau,
    atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 16, presenca: 14 },
    caracteristicas,
  };
}

describe('efeitos tabelados de suporte do Shikigami', () => {
  it('calcula as fórmulas de cura unitária por grau e o modificador de atributo', () => {
    const esperado = {
      quarto: [{ count: 1, sides: 4 }],
      terceiro: [{ count: 1, sides: 8 }],
      segundo: [{ count: 1, sides: 12 }],
      primeiro: [{ count: 1, sides: 12 }, { count: 1, sides: 8 }],
      especial: [{ count: 2, sides: 12 }, { count: 1, sides: 6 }],
    } as const;
    for (const [grau, dados] of Object.entries(esperado) as Array<[keyof typeof esperado, typeof esperado[keyof typeof esperado]]>) {
      const resultado = calcularEfeitoSuporte(modelo(grau), acao({ efeito: 'cura', atributoCura: 'sabedoria', alvos: 'unico' }));
      expect(resultado).toEqual({ ok: true, efeito: { tipo: 'cura', dados, bonus: grau === 'especial' ? 6 : 3, alvos: 'unico' } });
    }
  });

  it('aplica a tabela de cura em múltiplos alvos e recusa o grau sem linha definida', () => {
    expect(calcularEfeitoSuporte(modelo('quarto'), acao({ efeito: 'cura', atributoCura: 'presenca', alvos: 'multiplos' }))).toMatchObject({ ok: false });
    expect(calcularEfeitoSuporte(modelo('terceiro'), acao({ efeito: 'cura', atributoCura: 'presenca', alvos: 'multiplos' }))).toMatchObject({
      ok: true, efeito: { dados: [{ count: 1, sides: 4 }], bonus: 2, alvos: 'multiplos' },
    });
    expect(calcularEfeitoSuporte(modelo('especial'), acao({ efeito: 'cura', atributoCura: 'sabedoria', alvos: 'multiplos' }))).toMatchObject({
      ok: true, efeito: { dados: [{ count: 1, sides: 12 }, { count: 1, sides: 4 }], bonus: 6 },
    });
  });

  it('aplica os bônus por grau, penalidade de repetição e validação de ação simples', () => {
    const simples = acao({ efeito: 'acerto', alvos: 'unico' }, 'acao_simples');
    expect(calcularEfeitoSuporte(modelo('especial'), simples)).toEqual({ ok: true, efeito: { tipo: 'acerto', valor: 5 } });
    expect(calcularEfeitoSuporte(modelo('especial'), simples, 2)).toEqual({ ok: true, efeito: { tipo: 'acerto', valor: 3 } });
    expect(calcularEfeitoSuporte(modelo('quarto'), simples, 4)).toEqual({ ok: true, efeito: { tipo: 'acerto', valor: 0 } });
    expect(calcularEfeitoSuporte(modelo('quarto'), acao({ efeito: 'defesa', alvos: 'unico' }))).toMatchObject({ ok: false });
  });

  it('escala dano adicional por categoria, repetição e limite mínimo', () => {
    const dano = acao({ efeito: 'dano_adicional', alvos: 'unico' }, 'acao_simples');
    expect(calcularEfeitoSuporte(modelo('quarto'), dano)).toEqual({ ok: true, efeito: { tipo: 'dano_adicional', formula: '1d6' } });
    expect(calcularEfeitoSuporte(modelo('quarto'), acao({ efeito: 'dano_adicional', alvos: 'unico' }))).toEqual({ ok: true, efeito: { tipo: 'dano_adicional', formula: '1d12' } });
    expect(calcularEfeitoSuporte(modelo('quarto'), dano, 1)).toEqual({ ok: true, efeito: { tipo: 'dano_adicional', formula: '1d4' } });
    expect(calcularEfeitoSuporte(modelo('especial'), dano, 100)).toEqual({ ok: true, efeito: { tipo: 'dano_adicional', formula: '1d4' } });
  });

  it('aplica redução de dano por tipo, quantidade de tipos, categoria e repetição', () => {
    const simples = acao({ efeito: 'reducao_dano', tiposDano: ['DCO', 'DI'], alvos: 'unico' }, 'acao_simples');
    expect(calcularEfeitoSuporte(modelo('especial'), simples)).toEqual({ ok: true, efeito: { tipo: 'reducao_dano', valor: 8, tiposDano: ['DCO', 'DI'] } });
    expect(calcularEfeitoSuporte(modelo('especial'), acao({ efeito: 'reducao_dano', tiposDano: ['DCO', 'DI'], alvos: 'unico' }))).toEqual({ ok: true, efeito: { tipo: 'reducao_dano', valor: 12, tiposDano: ['DCO', 'DI'] } });
    expect(calcularEfeitoSuporte(modelo('quarto'), acao({ efeito: 'reducao_dano', tiposDano: ['DCO'], alvos: 'unico' }, 'acao_simples'), 3)).toMatchObject({ ok: true, efeito: { valor: 0 } });
  });
});

describe('características passivas estruturadas', () => {
  it('usa o maior bônus equivalente e mantém redução de dano limitada ao tipo configurado', () => {
    const shiki = modelo('especial', [
      { efeitoOperacional: { tipo: 'pv_maximo' } },
      { efeitoOperacional: { tipo: 'pv_maximo' } },
      { efeitoOperacional: { tipo: 'bonus_pericia', pericia: 'furtividade' } },
      { efeitoOperacional: { tipo: 'bonus_pericia', pericia: 'FURTIVIDADE' } },
      { efeitoOperacional: { tipo: 'reducao_dano', tipoDano: 'DCO' } },
    ]);
    expect(bonusPVCaracteristicas(shiki)).toBe(30);
    expect(bonusPericiaCaracteristicas(shiki, 'Furtividade')).toBe(10);
    expect(bonusPericiaCaracteristicas(shiki, 'Atletismo')).toBe(0);
    expect(reducaoDanoCaracteristicas(shiki, 'DCO')).toBe(12);
    expect(reducaoDanoCaracteristicas(shiki, 'DI')).toBe(0);
  });
});

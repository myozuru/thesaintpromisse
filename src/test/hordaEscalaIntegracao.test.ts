import { describe, expect, it } from 'vitest';
import {
  calcularEscalaHorda,
  validarLimiteHorda,
  vagasInvocacaoEmCampo,
  verificarPerdaMembrosHorda,
} from '@/lib/controlador/hordas';
import { calcularEfeitoSuporte } from '@/lib/controlador/suporte';
import { stepDamage, parseDamage, formatDamage } from '@/lib/damageStep';
import { resolverPerdaMembrosHorda, acumularCuraParaLimiarHorda } from '@/lib/controlador/hordas';
import { calcularPrejuizoRepeticaoHorda, calcularTamanhoEfetivoHorda } from '@/lib/controlador/hordas';

describe('escala verificada de Horda', () => {
  it('conta cada integrante da Horda no limite de invocações, apesar do token compartilhado', () => {
    expect(vagasInvocacaoEmCampo({})).toBe(1);
    expect(vagasInvocacaoEmCampo({
      invocationHordeId: 'horda-1',
      invocationHordeMemberIds: ['membro-1'],
    })).toBe(2);
    expect(vagasInvocacaoEmCampo({
      invocationHordeId: 'horda-1',
      invocationHordeMemberIds: ['membro-1', 'membro-2'],
    })).toBe(3);
  });

  it('recusa criar invocação quando Horda mais indivíduos excedem as vagas efetivas', () => {
    expect(validarLimiteHorda({
      limiteInvocacoesEmCampo: 4,
      hordasAtivas: 1,
      invocacoesIndividuaisAposCriacao: 2,
      vagasOcupadasPorHordas: 2,
      vagasNovaHorda: 1,
    })).toMatchObject({ ok: false, codigo: 'limite_invocacoes_em_campo' });
    expect(validarLimiteHorda({
      limiteInvocacoesEmCampo: 4,
      hordasAtivas: 1,
      invocacoesIndividuaisAposCriacao: 1,
      vagasOcupadasPorHordas: 2,
      vagasNovaHorda: 1,
    })).toEqual({ ok: true });
  });

  it('aplica um uso adicional por par e resolve tamanho pela composição atual', () => {
    const membros = [{ grau: 'quarto' as const }, { grau: 'segundo' as const }];
    expect([0, 1, 2, 3, 4].map(usos => calcularPrejuizoRepeticaoHorda(usos, membros))).toEqual([0, 0, 1, 1, 2]);
    expect(calcularTamanhoEfetivoHorda('Médio', membros)).toMatchObject({ tamanho: 'Grande', categoria: 3 });
    expect(calcularTamanhoEfetivoHorda('Médio', membros.slice(0, 1))).toMatchObject({ tamanho: 'Médio', categoria: 2 });
    expect(calcularTamanhoEfetivoHorda('Grande', [...membros, ...membros])).toMatchObject({ tamanho: 'Colossal', categoria: 5 });
  });
  it('não remove o único membro adicional e conserva a razão negativa de PV em golpes que atravessam outros limiares', () => {
    const membros = ['a', 'b'].map((modeloId, index) => ({ modeloId, grau: 'quarto' as const, pvMaximoAntes: 20, ordemEntrada: index }));
    expect(resolverPerdaMembrosHorda({ pvAntes: 100, pvDepois: 40, pvMaximo: 100, membros: membros.slice(0, 1) }).removidos).toHaveLength(0);
    const perda = resolverPerdaMembrosHorda({ pvAntes: 100, pvDepois: -100, pvMaximo: 100, membros });
    expect(perda.pvAtual).toBe(-90);
    expect(perda.pvMaximo).toBe(90);
    expect(perda.removidos.map(m => m.modeloId)).toEqual(['b']);
  });
  it('remove menor grau, entrada recente e ID; mantém a porcentagem e frações de PV', () => {
    const membros = [
      { modeloId: 'segundo', grau: 'segundo' as const, pvMaximoAntes: 40, ordemEntrada: 4 },
      { modeloId: 'quarto-z', grau: 'quarto' as const, pvMaximoAntes: 21, ordemEntrada: 1 },
      { modeloId: 'quarto-b', grau: 'quarto' as const, pvMaximoAntes: 20, ordemEntrada: 2 },
      { modeloId: 'quarto-a', grau: 'quarto' as const, pvMaximoAntes: 20, ordemEntrada: 2 },
    ];
    const perda = resolverPerdaMembrosHorda({ pvAntes: 80, pvDepois: 50, pvMaximo: 150, membros });
    expect(perda.removidos.map(m => m.modeloId)).toEqual(['quarto-a', 'quarto-b']);
    expect(perda.pvMaximo).toBe(130);
    expect(perda.pvAtual).toBeCloseTo(50 / 150 * 130);
    expect(perda.limiar).toMatchObject({ armado: false, curaAcumulada: 0, pvMaximoReferencia: 130, totalAtivacoes: 1 });
    expect(membros).toHaveLength(4);
  });
  it('rearma apenas com cura efetiva acumulada de 25% e exige novo cruzamento', () => {
    const membros = [0, 1, 2, 3].map(n => ({ modeloId: `${n}`, grau: 'quarto' as const, pvMaximoAntes: 10, ordemEntrada: n }));
    const primeira = resolverPerdaMembrosHorda({ pvAntes: 100, pvDepois: 50, pvMaximo: 100, membros });
    const insuficiente = acumularCuraParaLimiarHorda(primeira.limiar!, 22.49);
    expect(insuficiente.armado).toBe(false);
    const armada = acumularCuraParaLimiarHorda(insuficiente, 0.01);
    expect(armada.armado).toBe(true);
    expect(resolverPerdaMembrosHorda({ pvAntes: 50, pvDepois: 40, pvMaximo: 90, membros: primeira.membros, limiar: insuficiente }).removidos).toHaveLength(0);
    expect(resolverPerdaMembrosHorda({ pvAntes: 50, pvDepois: 40, pvMaximo: 90, membros: primeira.membros, limiar: armada }).removidos).toHaveLength(1);
  });
  it('escala dados de cura e auxílio sem multiplicar atributo ou dano rolado', () => {
    const escala = calcularEscalaHorda([{ grau: 'segundo' }, { grau: 'segundo' }]);
    const modelo = { grau: 'primeiro' as const, atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 16, presenca: 10 } };
    const cura = calcularEfeitoSuporte(modelo, { categoriaAcao: 'acao_complexa', efeitoSuporte: { efeito: 'cura', alvos: 'unico', atributoCura: 'sabedoria' } }, 0, escala);
    expect(cura).toEqual({ ok: true, efeito: { tipo: 'cura', dados: stepDamage(parseDamage('1d12+1d8'), 4), bonus: 3, alvos: 'unico' } });
    const dano = calcularEfeitoSuporte(modelo, { categoriaAcao: 'acao_simples', efeitoSuporte: { efeito: 'dano_adicional', alvos: 'unico' } }, 0, escala);
    expect(dano).toEqual({ ok: true, efeito: { tipo: 'dano_adicional', formula: formatDamage(stepDamage(parseDamage('2d8'), 1)) } });
    for (const efeito of ['defesa', 'acerto'] as const) {
      expect(calcularEfeitoSuporte(modelo, { categoriaAcao: 'acao_simples', efeitoSuporte: { efeito, alvos: 'unico' } }, 0, escala)).toMatchObject({ ok: true, efeito: { valor: 5 } });
    }
    expect(calcularEfeitoSuporte(modelo, { categoriaAcao: 'acao_simples', efeitoSuporte: { efeito: 'reducao_dano', alvos: 'unico', tiposDano: ['DCO'] } }, 0, escala)).toMatchObject({ ok: true, efeito: { valor: 10 } });
  });
  it('conta apenas membros adicionais e dobra somente a contribuição do Segundo Grau', () => {
    expect(calcularEscalaHorda([{ grau: 'quarto' }, { grau: 'segundo' }, { grau: 'segundo' }])).toEqual({
      niveisAtaqueCura: 5, bonusDefesaAcerto: 1, niveisDanoAuxilio: 1,
      rdAuxilio: 3, categoriasTamanho: 1, usosAntesPrejuizo: 2,
    });
    expect(calcularEscalaHorda([]).niveisAtaqueCura).toBe(0);
    expect(calcularEscalaHorda([{ grau: 'quarto' }, { grau: 'terceiro' }]).bonusDefesaAcerto).toBe(0);
  });
  it('sinaliza o limiar sem remover membros ou redistribuir PV sem decisão', () => {
    expect(verificarPerdaMembrosHorda(51, 50, 100, 3)).toMatchObject({ pendente: true, quantidade: 1 });
    expect(verificarPerdaMembrosHorda(51, 49, 100, 3).pendente).toBe(true);
    expect(verificarPerdaMembrosHorda(60, 51, 100, 3).pendente).toBe(false);
    expect(verificarPerdaMembrosHorda(49, 48, 100, 3).pendente).toBe(false);
    expect(verificarPerdaMembrosHorda(51, 50, 100, 1).quantidade).toBe(0);
  });
});

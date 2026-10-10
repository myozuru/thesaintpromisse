import { describe, expect, it } from 'vitest';
import {
  auditarAtributosShikigami,
  auditarFichaShikigami,
  atributosIniciaisShikigami,
  calcularBonusTesteInvocacao,
  custoInvocacaoComOpcoes,
  grausDisponiveis,
  invocacoesConhecidasPeloLivro,
  maximoAcoesCaracteristicas,
  novasPericiasAoSubirGrau,
  periciasAdicionaisPorGrau,
  podeTreinarResistenciaInvocacao,
  pontosRestantesShikigami,
  quantidadePericiasTreinadas,
  regrasGrau,
  validarAtributosShikigami,
  valoresShikigami,
} from '@/lib/controlador/regrasShikigami';

describe('Editor de Shikigamis — texto original', () => {
  it('libera os graus nos marcos do livro', () => {
    expect(grausDisponiveis(1)).toEqual(['quarto']);
    expect(grausDisponiveis(5)).toEqual(['quarto', 'terceiro']);
    expect(grausDisponiveis(9)).toEqual(['quarto', 'terceiro', 'segundo']);
    expect(grausDisponiveis(13)).toEqual(['quarto', 'terceiro', 'segundo', 'primeiro']);
    expect(grausDisponiveis(17)).toHaveLength(5);
  });

  it('mantém a referência completa de atributos, PV, defesa e custos por grau', () => {
    expect(['quarto', 'terceiro', 'segundo', 'primeiro', 'especial'].map((grau) => {
      const regras = regrasGrau(grau as Parameters<typeof regrasGrau>[0]);
      return [regras.pontos, regras.maximo, regras.custo, regras.pvBase, regras.defesaBase, regras.fatorNivel];
    })).toEqual([
      [10, 16, 2, 10, 10, 1],
      [15, 20, 4, 25, 12, 1],
      [20, 24, 6, 40, 16, 1],
      [30, 26, 8, 60, 20, 1.5],
      [40, 30, 12, 80, 24, 2],
    ]);
  });

  it('calcula PV e Defesa usando a regra de Constituição do grau e o treinamento do nível', () => {
    const atributos = { ...atributosIniciaisShikigami(), constituicao: 12, destreza: 14 };
    const casos = [
      ['quarto', 1, 17, 14],
      ['terceiro', 5, 36, 17],
      ['segundo', 9, 61, 22],
      ['primeiro', 13, 91, 27],
      ['especial', 17, 126, 32],
    ] as const;
    for (const [grau, nivel, pv, defesa] of casos) {
      expect(valoresShikigami(grau, atributos, nivel)).toMatchObject({ pv, defesa, deslocamentoM: 9 });
    }
  });

  it('preserva as sugestões de distribuição sem bloquear valores manuais', () => {
    const atributos = { ...atributosIniciaisShikigami(), forca: 17, destreza: 5 };
    expect(pontosRestantesShikigami('quarto', atributos)).toBe(4);
    expect(validarAtributosShikigami('quarto', atributos)).toBeNull();
    expect(auditarAtributosShikigami('quarto', atributos).map((aviso) => aviso.codigo))
      .toEqual(expect.arrayContaining([
        'atributo_abaixo_referencia',
        'atributo_acima_referencia',
        'pontos_nao_distribuidos',
      ]));
    expect(validarAtributosShikigami('quarto', { ...atributos, forca: Number.NaN })).toContain('números inteiros finitos');
  });

  it('calcula perícias por atributo e grau, e mostra o ganho ao mudar de grau', () => {
    expect(['quarto', 'terceiro', 'segundo', 'primeiro', 'especial'].map((grau) =>
      quantidadePericiasTreinadas(grau as Parameters<typeof quantidadePericiasTreinadas>[0], 14),
    )).toEqual([3, 3, 4, 4, 5]);
    expect((['quarto', 'terceiro', 'segundo', 'primeiro', 'especial'] as const).map(periciasAdicionaisPorGrau))
      .toEqual([1, 1, 2, 2, 3]);
    expect(novasPericiasAoSubirGrau('quarto', 'especial')).toBe(2);
    expect(novasPericiasAoSubirGrau('segundo', 'primeiro')).toBe(0);
  });

  it('soma modificador-chave, treinamento quando treinado e metade do nível do Controlador', () => {
    const args = { modificadorAtributoChave: 2, bonusTreinamentoUsuario: 3, nivelControlador: 7, treinado: true };
    expect(calcularBonusTesteInvocacao(args)).toBe(8);
    expect(calcularBonusTesteInvocacao({ ...args, treinado: false })).toBe(5);
  });

  it('não permite Integridade como resistência treinada', () => {
    expect(podeTreinarResistenciaInvocacao('Integridade')).toBe(false);
    expect(podeTreinarResistenciaInvocacao('  INTEGRIDADE  ')).toBe(false);
    expect(podeTreinarResistenciaInvocacao('Fortitude')).toBe(true);
    expect(podeTreinarResistenciaInvocacao('')).toBe(false);
  });

  it('centraliza os espaços de ações/características e os custos adicionais', () => {
    expect(['quarto', 'terceiro', 'segundo', 'primeiro', 'especial'].map(maximoAcoesCaracteristicas))
      .toEqual([3, 4, 6, 7, 9]);
    expect(custoInvocacaoComOpcoes('terceiro', ['acao_simples', 'acao_simples', 'acao_complexa', 'caracteristica']))
      .toBe(7);
    expect(custoInvocacaoComOpcoes('quarto', ['acao_simples', 'acao_simples'])).toBe(2);
  });

  it('audita divergências de ficha sem transformá-las em bloqueios', () => {
    const avisos = auditarFichaShikigami({
      grau: 'quarto',
      nivelUsuario: 1,
      bonusTreinamentoUsuario: 2,
      atributos: { ...atributosIniciaisShikigami(), forca: 17 },
      valoresAtuais: { pv: 99, defesa: 50, deslocamentoM: 12, custoInvocacaoPE: 9 },
      acoesCaracteristicas: ['acao_simples', 'acao_simples', 'acao_complexa', 'caracteristica'],
      acoesComCusto: [
        { custoPE: 5, tipo: 'acao_simples' },
        { custoPE: 1, tipo: 'acao_complexa' },
      ],
    });
    expect(avisos.every((aviso) => aviso.severidade === 'aviso')).toBe(true);
    expect(avisos.map((aviso) => aviso.codigo)).toEqual(expect.arrayContaining([
      'atributo_acima_referencia',
      'pontos_nao_distribuidos',
      'acoes_caracteristicas_acima_referencia',
      'acoes_com_custo_acima_referencia',
      'custo_de_acao_fora_referencia',
      'acao_com_custo_exige_acao_complexa',
      'valor_derivado_divergente',
    ]));
  });

  it('audita a quantidade de perícias somente quando o atributo base está definido', () => {
    const base = {
      grau: 'segundo' as const,
      nivelUsuario: 9,
      bonusTreinamentoUsuario: 4,
      atributos: { ...atributosIniciaisShikigami(), inteligencia: 14 },
      periciasTreinadas: ['Atletismo', 'Percepção'],
    };
    expect(auditarFichaShikigami(base).map((aviso) => aviso.codigo))
      .toContain('atributo_base_pericias_nao_definido');
    expect(auditarFichaShikigami({ ...base, atributoBasePericias: 'inteligencia' })
      .map((aviso) => aviso.codigo)).toContain('quantidade_pericias_divergente');
  });

  it('mantém a progressão de invocações conhecidas do Controlador', () => {
    expect([1, 3, 4, 6, 7, 10, 19].map(invocacoesConhecidasPeloLivro)).toEqual([2, 2, 3, 3, 4, 5, 8]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  auditarValoresProvisoriosFormaDerivadaDezSombras,
  criarFormasDerivadasDezSombras,
} from '@/lib/controlador/dezSombrasDerivadas';
import { criarPacoteDezSombras } from '@/lib/controlador/dezSombras';

describe('Dez Sombras: formas derivadas e auditoria de valores provisórios', () => {
  const forms = criarFormasDerivadasDezSombras('feiticeira');

  it('cria as quatro formas da p. 69 fora da lista de indivíduos-base', () => {
    expect(forms.map(form => form.subcategoria)).toEqual([
      'dez-sombras:totalidade',
      'dez-sombras:abismo-desconhecido-do-poco',
      'dez-sombras:nue-totalidade',
      'dez-sombras:agito',
    ]);
    expect(forms.every(form => form.formaDerivada && form.domado === false)).toBe(true);
    expect(forms.every(form => form.donoCharacterId === 'feiticeira')).toBe(true);
    expect(forms.every(form => form.referenciaRegra?.includes('p. 69'))).toBe(true);
    expect(criarPacoteDezSombras('feiticeira').some(form => form.formaDerivada)).toBe(false);
  });

  it('mantém grau, composição e lacunas oficiais, sem liberar fichas provisórias', () => {
    expect(forms.map(({ grau, requisitosFormaDerivada }) => ({ grau, requisitosFormaDerivada }))).toEqual([
      { grau: 'terceiro', requisitosFormaDerivada: ['Cão Branco domado', 'Cão Preto domado', 'ritual de quimera'] },
      { grau: 'terceiro', requisitosFormaDerivada: ['Gama domado', 'Nue domado', 'ritual de quimera'] },
      { grau: 'segundo', requisitosFormaDerivada: ['Nue domado', 'Orochi domado', 'ritual de quimera'] },
      { grau: 'especial', requisitosFormaDerivada: ['Nue domado', 'Orochi domado', 'Cervo Circular domado', 'Tigre Fúnebre domado', 'ritual de quimera'] },
    ]);
    for (const form of forms) {
      expect(form.aprovacaoMestre).toBe('pendente');
      expect(form.valoresProvisoriosFormaDerivada).toEqual(
        expect.arrayContaining(['PV', 'Defesa', 'deslocamentoM', 'custoInvocacaoPE', 'porte', 'atributos', 'ações']),
      );
      expect(form.acoes).toEqual([]);
      expect(form.lacunasFormaDerivada?.join(' ')).toContain('não publica');
    }
  });

  it('compara apenas métricas numéricas que têm referência publicada para o grau', () => {
    expect(auditarValoresProvisoriosFormaDerivadaDezSombras(forms[0]!)).toEqual([
      { campo: 'PV', valorProvisorio: 35, referenciaGrau: 25, diferenca: 10 },
      { campo: 'Defesa', valorProvisorio: 22, referenciaGrau: 12, diferenca: 10 },
      { campo: 'Custo de invocação', valorProvisorio: 4, referenciaGrau: 4, diferenca: 0 },
    ]);
    expect(auditarValoresProvisoriosFormaDerivadaDezSombras(forms[3]!)).toEqual([
      { campo: 'PV', valorProvisorio: 120, referenciaGrau: 80, diferenca: 40 },
      { campo: 'Defesa', valorProvisorio: 27, referenciaGrau: 24, diferenca: 3 },
      { campo: 'Custo de invocação', valorProvisorio: 7, referenciaGrau: 12, diferenca: -5 },
    ]);
    expect(auditarValoresProvisoriosFormaDerivadaDezSombras(forms[1]!)
      .some(item => String(item.campo) === 'Deslocamento')).toBe(false);
  });

  it('ignora campos que não estão marcados como provisórios e não audita fichas comuns', () => {
    expect(auditarValoresProvisoriosFormaDerivadaDezSombras({
      ...forms[0]!,
      valoresProvisoriosFormaDerivada: ['PV'],
    })).toEqual([{ campo: 'PV', valorProvisorio: 35, referenciaGrau: 25, diferenca: 10 }]);
    expect(auditarValoresProvisoriosFormaDerivadaDezSombras({
      ...forms[0]!,
      formaDerivada: false,
    })).toEqual([]);
  });
});

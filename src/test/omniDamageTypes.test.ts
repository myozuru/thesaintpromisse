import { describe, expect, it } from 'vitest';
import { resolverTipoDano } from '@/lib/omni/contextoDano';

describe('aliases de tipos de dano OMNI', () => {
  it.each([
    ['Cortante', 'DCO'], ['corte', 'DCO'], ['ct', 'DCO'],
    ['Perfurante', 'DP'], ['perfuração', 'DP'], ['pf', 'DP'],
    ['Impactante', 'DI'], ['impacto', 'DI'], ['im', 'DI'],
    ['Ácido', 'DA'],
    ['Congelante', 'DCG'], ['gelo', 'DCG'], ['congelamento', 'DCG'],
    ['Chocante', 'DCC'], ['eletricidade', 'DCC'], ['choque', 'DCC'],
    ['Queimante', 'DQ'], ['fogo', 'DQ'], ['chamas', 'DQ'],
    ['Sônico', 'DS'], ['som', 'DS'], ['sônico', 'DS'],
    ['Psíquico', 'DPS'], ['mental', 'DPS'], ['psíquico', 'DPS'],
    ['Radiante', 'DR'], ['Necrótico', 'DN'], ['necro', 'DN'],
    ['Venenoso', 'DV'], ['veneno', 'DV'],
    ['na Alma', 'DAL'], ['Energia Reversa', 'DNR'], ['Energético', 'DE'],
  ] as const)('resolve %s para o tipo canônico %s', (nome, esperado) => {
    expect(resolverTipoDano(nome)).toBe(esperado);
  });

  it.each(['Amaldiçoado', 'Força', 'Verdadeiro', 'Cura'])(
    'não inventa equivalência para %s',
    nome => expect(resolverTipoDano(nome)).toBeUndefined(),
  );

  it('aceita códigos públicos sem depender da ordem da lista', () => {
    expect(resolverTipoDano('DNR')).toBe('DNR');
    expect(resolverTipoDano('dps')).toBe('DPS');
  });
});

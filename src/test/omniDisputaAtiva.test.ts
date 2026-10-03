import { describe, expect, it } from 'vitest';
import { melhorPericiaDaDisputa, modificadorPericiaAtiva, usuarioVenceDisputa } from '@/lib/omni/acaoAtiva';
import type { Character } from '@/types';

describe('disputas de perícia em ações ativas', () => {
  it('calcula o bônus-base da perícia com atributo, treinamento, nível e bônus externo', () => {
    const personagem = {
      level: 5,
      skills: [{ id: 'atletismo', name: 'Atletismo', value: 2, linkedAttribute: 'forca', trained: true, externalBonus: 1 }],
      attributes: [{ id: 'forca', name: 'Força', value: 14 }],
      activeConditions: [], exhaustionLevel: 0,
    } as unknown as Character;

    expect(modificadorPericiaAtiva(personagem, 'ATLETISMO')).toBe(10);
    expect(modificadorPericiaAtiva(personagem, 'Furtividade')).toBeUndefined();
  });

  it('declara vitória apenas quando o total do usuário supera o do alvo', () => {
    expect(usuarioVenceDisputa(18, 17)).toBe(true);
    expect(usuarioVenceDisputa(17, 17)).toBe(false);
    expect(usuarioVenceDisputa(16, 17)).toBe(false);
  });

  it('seleciona a maior perícia defensiva disponível entre as configuradas', () => {
    const alvo = {
      level: 1,
      skills: [
        { id: 'atletismo', name: 'Atletismo', value: 2 },
        { id: 'acro', name: 'Acrobacia', value: 5 },
      ],
      attributes: [], activeConditions: [],
    } as unknown as Character;
    expect(melhorPericiaDaDisputa(alvo, ['Atletismo', 'Acrobacia', 'Furtividade']))
      .toEqual({ nome: 'Acrobacia', bonus: 5 });
  });
});

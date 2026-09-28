import { describe, it, expect } from 'vitest';
import { pickLocalActiveScene } from '@/hooks/useMultiplayerSync';

const data = { activeSceneId: 'b', sceneOrder: ['a', 'b'], scenes: { a: {}, b: {} } };

describe('cena própria por tela', () => {
  it('mantém a cena local quando outra tela troca de cena', () => {
    expect(pickLocalActiveScene('a', data)).toBe('a');
  });
  it('adota a cena do remetente quando a local não existe', () => {
    expect(pickLocalActiveScene('', data)).toBe('b');
    expect(pickLocalActiveScene('apagada', data)).toBe('b');
  });
});

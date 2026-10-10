import { describe, it, expect } from 'vitest';
import { listarConquistas } from '@/stores/useConquistaStore';
import { CONQUISTAS_PADRAO, RARIDADES } from '@/lib/conquistas/tipos';

describe('conquistas', () => {
  it('tem as 5 raridades na ordem', () => {
    expect(RARIDADES).toEqual(['comum', 'raro', 'epico', 'lendario', 'impossivel']);
  });
  it('apagar uma padrão a remove do catálogo', () => {
    const id = CONQUISTAS_PADRAO[0].id;
    const lista = listarConquistas({ [id]: { ...CONQUISTAS_PADRAO[0], deletedAt: 1, updatedAt: 1 } });
    expect(lista.find((c) => c.id === id)).toBeUndefined();
  });
  it('primeiro combate é automático', () => {
    expect(CONQUISTAS_PADRAO.find((c) => c.id === 'primeira-vez')?.gatilho).toBe('primeiro_combate');
  });
});

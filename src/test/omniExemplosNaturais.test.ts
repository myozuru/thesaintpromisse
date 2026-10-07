import { describe, it, expect } from 'vitest';
import { parseScriptOmni } from '@/lib/omni/compilarNatural';
import { EXEMPLOS_NATURAIS } from '@/lib/omni/exemplosNaturais';

describe('Guia OMNI — exemplos em texto natural', () => {
  for (const ex of EXEMPLOS_NATURAIS) {
    it(`compila: ${ex.titulo}`, () => {
      const r = parseScriptOmni(ex.frase) as { erros?: unknown[]; efeitos?: unknown[] };
      expect(r.erros ?? []).toEqual([]);
      expect((r.efeitos ?? []).length).toBeGreaterThan(0);
    });
  }
});
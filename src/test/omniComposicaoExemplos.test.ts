import { describe, expect, it } from 'vitest';
import { EXEMPLOS_COMPONENTES_UI } from '@/lib/omni/componentes/exemplosUI';
import { parseOmniScript } from '@/lib/omni/omniScript';
describe('exemplos individuais executáveis no terminal', () => {
  it.each(EXEMPLOS_COMPONENTES_UI)('$id: $origem', c => {
    const r = parseOmniScript(c.formula);
    expect(r.erros, c.formula).toEqual([]);
    expect(r.efeitos.length).toBeGreaterThan(0);
  });
});

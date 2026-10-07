import { describe, it, expect } from 'vitest';
import { parseScriptOmni } from '@/lib/omni/compilarNatural';

const ef = (s: string) => { const r = parseScriptOmni(s) as any; expect(r.erros ?? r.errors ?? []).toEqual([]); return r.efeitos[0]; };

describe('texto natural — sinônimos e dano por contador', () => {
  it('aceita cac / corpo a corpo e "aplicar condição"', () => {
    for (const s of ['ao acertar cac então aplicar condição condenado por 2 rodadas', 'ao acertar corpo a corpo então aplicar condenado por 2 rodadas']) {
      const e = ef(s);
      expect(e.condition).toBe('@DANO.tipo_ataque == 1');
      expect(e.conditionApply).toMatchObject({ id: 'condenado', durationRounds: 2 });
    }
  });
  it('a distância vira filtro de ataque à distância', () => {
    expect(ef('ao acertar a distância então aplicar condenado por 1 rodada').condition).toBe('@DANO.tipo_ataque == 2');
  });
  it('dano escalonado por contador', () => {
    expect(ef('ao acertar corpo_a_corpo então causar 1d4 de dano psíquico por contador_rancor')).toMatchObject({ formula: '(@USUARIO.contador_rancor)d4', damageType: 'psiquico' });
    expect(ef('ao acertar cac então causar 2d6 de dano psíquico por contador_rancor').formula).toBe('(2*@USUARIO.contador_rancor)d6');
  });
});

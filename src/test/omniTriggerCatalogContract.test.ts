import { describe, expect, it } from 'vitest';
import { GATILHOS_EVENTOS } from '@/lib/omni/constantesDoSistema';
import { ALIASES_POR_EVENTO, gatilhoCasa, resolverGatilho } from '@/lib/omni/gatilhoAliases';
import { mapearAtomoEventoNatural } from '@/lib/omni/eventosNaturais';

describe('Contrato do catálogo de gatilhos OMNI', () => {
  it('cada gatilho canônico e cada alias registrado resolvem para um único evento', () => {
    const canonicos = Object.values(GATILHOS_EVENTOS);
    expect(new Set(canonicos).size).toBe(canonicos.length);
    expect(Object.keys(ALIASES_POR_EVENTO).sort()).toEqual([...canonicos].sort());

    const falhas: string[] = [];
    let totalAliases = 0;
    for (const evento of canonicos) {
      const aliases = ALIASES_POR_EVENTO[evento];
      if (!aliases.length) falhas.push(`${evento}: sem aliases`);
      if (resolverGatilho(evento) !== evento) falhas.push(`${evento}: id canônico não resolve`);
      for (const alias of aliases) {
        totalAliases++;
        if (resolverGatilho(alias) !== evento) falhas.push(`${evento}: resolverGatilho(${alias}) diverge`);
        if (!gatilhoCasa(evento, alias)) falhas.push(`${evento}: gatilhoCasa não reconhece ${alias}`);
        const mapeado = mapearAtomoEventoNatural(alias);
        if (mapeado?.evento !== evento) falhas.push(`${evento}: alias natural ${alias} → ${mapeado?.evento ?? 'sem mapeamento'}`);
      }
    }

    expect(totalAliases).toBeGreaterThan(100);
    expect(falhas, falhas.slice(0, 80).join('\n')).toEqual([]);
  });

  it('não mapeia aliases não registrados por aproximação', () => {
    expect(resolverGatilho('ao_fazer_qualquer_coisa')).toBeUndefined();
    expect(mapearAtomoEventoNatural('ao fazer qualquer coisa')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { registrarHistorico, dadosHistorico } from '@/lib/omni/componentes/eventos';
import { avaliarFormula } from '@/lib/omni/parser';
import type { Character } from '@/types';
describe('histórico e evento compostos', () => {
  it('acumula valores efetivos e separa PV temporários', () => {
    let c = registrarHistorico({ rancor: 7 }, 'cura', 3, 1);
    c = registrarHistorico(c, 'cura', 2, 1);
    c = registrarHistorico(c, 'dano', 8, 1, 5);
    expect(c).toMatchObject({ cura_recebida: 2, cura_recebida_nesta_rodada: 5, dano_recebido_nesta_rodada: 8, vida_perdida_nesta_rodada: 3, rancor: 7 });
    c = registrarHistorico(c, 'cura', 1, 2);
    expect(c).toMatchObject({ cura_recebida_nesta_rodada: 1, dano_recebido_nesta_rodada: 0, vida_perdida_nesta_rodada: 0 });
  });
  it('lê zero na nova rodada antes de um evento novo', () => {
    const c = { omniCounters: registrarHistorico({}, 'cura', 5, 1) } as Character;
    const r = avaliarFormula('cura recebida nesta rodada', {}, undefined, { composicoes: { USUARIO: dadosHistorico(c, 2) } });
    expect(r.valor).toBe(0);
  });
  it('lê contador com nome e ID da fonte intactos', () => {
    const c = { omniCounters: { brasas: 5, 'brasas__fonte__alvo-01': 3 } } as unknown as Character;
    const r = avaliarFormula('contador brasas fonte alvo-01 + contador brasas', {}, undefined, { composicoes: { USUARIO: dadosHistorico(c, 1) } });
    expect(r.valor).toBe(8);
    expect(r.diagnosticos).toEqual([]);
  });
  it.each([
    ['@DANO.dano final', 6], ['@DANO.dano tipo DQ', 1], ['@DANO.dano fonte arma', 1],
    ['@DANO.dano foi ataque oportunidade', 1], ['@DANO.foi falha_critica', 0], ['@DANO.foi dano furtivo', 1],
  ])('%s conserva o contexto do golpe', (s, valor) => {
    const r = avaliarFormula(String(s), {}, undefined, { dano: { valor_final: 6, tipo: 7, fonte: 1, foi_ataque_oportunidade: 1, foi_falha_critica: 0, foi_furtivo: 1 } });
    expect(r.valor).toBe(valor); expect(r.diagnosticos).toEqual([]);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, limparMesa, pegarFicha, comoTela, forcarDados, esperar } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';

const punicao: AcaoAtivaConfig = { id: 'p', nome: 'Punição ao Agressor', acao: 'comum', custoPE: '5', alcanceM: 0, teste: 'ataque', incluirArma: true, dano: '4d8', tipoDano: 'Impacto',
  tr_apos_acerto: true, tr: 'fortitude', cd: '15', efeitos: [{ tipo: 'condicao', condicao: 'abalado', rodadas: 2 }] };
const mesa = () => montarMesa([
  ficha('u', { attributes: [{ id: 'FOR', name: 'Força', value: 10 }], mainHandWeaponName: 'Espada Curta', meleeTrained: true, trainingBonus: 0, actionsCurrent: 1 }),
  ficha('a', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0, rd: 0, ca: 10 }),
], { u: [0, 0], a: [1, 0] });
beforeEach(() => comoTela({ profileId: null, role: 'MASTER' }));
afterEach(async () => { await esperar(); limparMesa(); });
const abalado = () => pegarFicha('a').activeConditions?.some(c => c.conditionId === 'abalado');

describe('TR após acerto', () => {
  it('acerto + falha no TR: dano entra e aplica Abalado', async () => {
    mesa(); forcarDados(18, 1, 1, 1, 1, 1, 2);
    const r = await executarAcaoAtiva('u', punicao, 'a');
    expect(r.ok && r.detalhe).toContain('TR Fortitude');
    expect(r.ok && r.dano).toBeGreaterThan(0);
    expect(abalado()).toBe(true);
    expect(pegarFicha('u').peCurrent).toBe(15);
  });
  it('acerto + sucesso no TR: dano entra, sem condição', async () => {
    mesa(); forcarDados(18, 1, 1, 1, 1, 1, 20);
    const r = await executarAcaoAtiva('u', punicao, 'a');
    expect(r.ok && r.dano).toBeGreaterThan(0);
    expect(r.ok && r.detalhe).toContain('SUCESSO');
    expect(abalado()).toBeFalsy();
  });
  it('errou o ataque: nenhum TR, nenhuma condição, PE gasto', async () => {
    mesa(); forcarDados(2);
    const r = await executarAcaoAtiva('u', punicao, 'a');
    expect(r.ok && r.detalhe).not.toContain('TR Fortitude');
    expect(abalado()).toBeFalsy();
    expect(pegarFicha('u').peCurrent).toBe(15);
  });
});

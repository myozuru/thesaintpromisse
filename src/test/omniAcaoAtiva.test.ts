// @vitest-environment jsdom
/** Ações ativas genéricas do OMNI em combate real em memória. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { useMapStore } from '@/stores/useMapStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { executarAcaoAtiva, planejarDano, danoAposTR, moverForcado, parseDados } from '@/lib/omni/acaoAtiva';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados, CASA, esperar } from './helpers/mesaReal';

const vinganca: AcaoAtivaConfig = {
  id: 'v', nome: 'Vingança Agulhada', acao: 'comum', custoPE: '4', alcanceM: 6,
  teste: 'tr', tr: 'fortitude', cd: '15', metadeNoSucesso: true, dano: '6d8', tipoDano: 'Impacto',
  efeitos: [{ tipo: 'puxar', metros: 4.5 }, { tipo: 'condicao', condicao: 'exposto', rodadas: 1 }],
};
const montar = (inimigoX: number) => montarMesa([
  ficha('heroi', { peCurrent: 20, actionsCurrent: 1 }),
  ficha('alvo', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0 }),
], { heroi: [0, 0], alvo: [inimigoX, 0] });
const posAlvo = () => (useMapStore.getState().entities as Record<string, { x: number }>)['e-alvo'].x / CASA;

beforeEach(() => comoTela({ profileId: null, role: 'MASTER' }));
afterEach(async () => {
  await import('@/lib/omni/eventBus');
  await import('@/lib/omni/observadores');
  await esperar();
  limparMesa();
});

describe('regras puras', () => {
  it('dados, cargas e crítico', () => {
    expect(parseDados('2d8+3')).toEqual({ grupos: [{ count: 2, sides: 8 }], fixo: 3 });
    expect(planejarDano('2d8', '1d8', 3, false).grupos).toEqual([{ count: 2, sides: 8 }, { count: 3, sides: 8 }]);
    expect(planejarDano('2d8+2', undefined, 0, true)).toEqual({ grupos: [{ count: 4, sides: 8 }], fixo: 2 });
    expect(danoAposTR(21, true, true)).toBe(10);
    expect(danoAposTR(21, true, false)).toBe(0);
    expect(danoAposTR(21, false, true)).toBe(21);
  });
  it('puxar para ao lado do atacante; empurrar afasta', () => {
    const g = { dpi: 70, metersPerCell: 1.5 } as never;
    expect(moverForcado({ x: 0, y: 0 }, { x: 70 * 4, y: 0 }, 4.5, 'puxar', g).x).toBe(70);
    expect(moverForcado({ x: 0, y: 0 }, { x: 70 * 2, y: 0 }, 4.5, 'puxar', g).x).toBe(70);
    expect(moverForcado({ x: 0, y: 0 }, { x: 70, y: 0 }, 3, 'empurrar', g).x).toBe(210);
  });
});

describe('Vingança Agulhada (TR)', () => {
  it('falha: dano cheio, puxado e Exposto; paga 4 PE e a ação', async () => {
    montar(4);
    forcarDados(1, 8, 8, 8, 8, 8, 8);
    const r = await executarAcaoAtiva('heroi', vinganca, 'alvo');
    expect(r.ok).toBe(true);
    expect(pegarFicha('heroi').peCurrent).toBe(16);
    expect(pegarFicha('heroi').actionsCurrent).toBe(0);
    expect(pegarFicha('alvo').hpCurrent).toBeLessThan(200);
    expect(posAlvo()).toBe(1);
    expect((pegarFicha('alvo').activeConditions ?? []).some((c) => c.conditionId === 'exposto')).toBe(true);
  });
  it('sucesso: metade e sem puxão/condição', async () => {
    montar(4);
    forcarDados(20, 8, 8, 8, 8, 8, 8);
    const r = await executarAcaoAtiva('heroi', vinganca, 'alvo');
    expect(r.ok).toBe(true);
    expect(posAlvo()).toBe(4);
    expect((pegarFicha('alvo').activeConditions ?? []).length).toBe(0);
  });
  it('fora de alcance e PE insuficiente bloqueiam sem gastar', async () => {
    montar(6); // 6 casas = 7,5 m de toque > 6 m
    const r = await executarAcaoAtiva('heroi', vinganca, 'alvo');
    expect(r.ok).toBe(false);
    expect(pegarFicha('heroi').peCurrent).toBe(20);
    montar(2);
    const r2 = await executarAcaoAtiva('heroi', { ...vinganca, custoPE: '99' }, 'alvo');
    expect(r2.ok).toBe(false);
  });
});

describe('cura com atributos e dados 3D', () => {
  it('Sabedoria 18 fornece modificador +4; 1d6=2 recupera 6 PV pela bandeja', async () => {
    montarMesa([
      ficha('heroi', {
        hpCurrent: 10, hpMax: 30, actionsCurrent: 1,
        attributes: [{ id: 'sabedoria', name: 'Sabedoria', value: 18, externalBonus: 0, mastery: false }],
      }),
    ], { heroi: [0, 0] });
    expect(montarVariaveisDoPersonagem(pegarFicha('heroi')).MOD_SAB).toBe(4);
    const roll = vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([2]);
    const cfg: AcaoAtivaConfig = {
      id: 'cura-sab', nome: 'Cura de Sabedoria', acao: 'comum', custoPE: '0',
      alcanceM: 0, tipo_alvo: 'proprio', teste: 'nenhum',
      tipo_efeito: 'cura', cura: '1d6 + @USUARIO.sab', recurso_cura: 'pv',
    };
    const r = await executarAcaoAtiva('heroi', cfg, 'heroi');
    expect(r.ok).toBe(true);
    expect(r.ok && r.cura).toBe(6);
    expect(pegarFicha('heroi').hpCurrent).toBe(16);
    expect(roll).toHaveBeenCalledWith('1d6', 'Cura: Cura de Sabedoria', undefined);
  });
});

describe('consumo de cargas', () => {
  it('consome todas as cargas e exige o mínimo', async () => {
    const cfg: AcaoAtivaConfig = { id: 'c', nome: 'Corte', acao: 'comum', custoPE: '10', alcanceM: 0, teste: 'nenhum', dano: '2', dadosPorCarga: '1', consumirContador: { nome: 'rancor', minimo: 1 } };
    montar(1);
    expect((await executarAcaoAtiva('heroi', cfg, 'alvo')).ok).toBe(false);
    montarMesa([
      ficha('heroi', { peCurrent: 20, actionsCurrent: 1, omniCounters: { rancor: 3 } }),
      ficha('alvo', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0 }),
    ], { heroi: [0, 0], alvo: [1, 0] });
    const r = await executarAcaoAtiva('heroi', cfg, 'alvo');
    expect(r.ok && r.dano).toBe(5);
    expect(pegarFicha('heroi').omniCounters?.rancor ?? 0).toBe(0);
    expect(pegarFicha('heroi').peCurrent).toBe(10);
  });
});

describe('escopo espacial genérico', () => {
  const cfg: AcaoAtivaConfig = { id: 'espacial', nome: 'Ação espacial', acao: 'comum', custoPE: '2', alcanceM: 6, teste: 'nenhum', dano: '4', tipoDano: 'Impacto' };
  const mesa = () => {
    montarMesa([
      ficha('heroi', { peCurrent: 20, trainingBonus: 2, actionsCurrent: 1, omniCounters: { foco: 3 } }),
      ficha('aliado', { hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
      ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
      ficha('b', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
      ficha('neutro', { category: 'NPC', hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
    ], { heroi: [0, 0], aliado: [0, 1], a: [2, 0], b: [3, 0], neutro: [0, 2] });
    useMapStore.setState({ initiative: { entries: [], turnIndex: -1, round: 0 } });
  };
  it('múltiplos: deduplica e paga ação, PE e contador uma vez', async () => {
    mesa();
    const r = await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'multiplo', filtro_alvo: 'inimigos', max_alvos: '@USUARIO.treino', consumirContador: { nome: 'foco', minimo: 1 }, dadosPorCarga: '1' }, ['a', 'a', 'b']);
    expect(r.ok && r.dano).toBe(14);
    expect(pegarFicha('heroi').peCurrent).toBe(18);
    expect(pegarFicha('heroi').actionsCurrent).toBe(0);
    expect(pegarFicha('heroi').omniCounters?.foco).toBe(0);
    expect(pegarFicha('a').hpCurrent).toBe(93);
    expect(pegarFicha('b').hpCurrent).toBe(93);
  });
  it('não gasta nem atinge o primeiro alvo se outro violar limite, filtro ou alcance', async () => {
    for (const [max, ids] of [['1', ['a', 'b']], ['3', ['a', 'aliado']], ['3', ['a', 'b']]] as const) {
      mesa();
      if (max === '3' && ids[1] === 'b') useMapStore.getState().updateEntity('e-b', { x: 70 * 20 });
      const r = await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'multiplo', filtro_alvo: 'inimigos', max_alvos: max }, [...ids]);
      expect(r.ok).toBe(false);
      expect(pegarFicha('heroi').peCurrent).toBe(20);
      expect(pegarFicha('heroi').actionsCurrent).toBe(1);
      expect(pegarFicha('a').hpCurrent).toBe(100);
    }
  });
  it('próprio funciona sem escolher alvo; legado continua recusando si', async () => {
    mesa();
    expect((await executarAcaoAtiva('heroi', cfg, 'heroi')).ok).toBe(false);
    const r = await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'proprio', dano: undefined, efeitos: [{ tipo: 'condicao', condicao: 'exposto', rodadas: 1 }] }, '');
    expect(r.ok).toBe(true);
    expect(pegarFicha('heroi').activeConditions?.some(c => c.conditionId === 'exposto')).toBe(true);
  });
  it('raio em si resolve aliados e inclui si quando solicitado, sem popup', async () => {
    mesa();
    const placement = vi.spyOn(useMapStore.getState(), 'requestAoEPlacement');
    const r = await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'area', filtro_alvo: 'aliados', dano: undefined, area: { forma: 'raio_em_si', tamanho_m: 4.5 }, efeitos: [{ tipo: 'condicao', condicao: 'exposto', rodadas: 1 }] }, '');
    expect(r.ok).toBe(true);
    expect(placement).not.toHaveBeenCalled();
    for (const id of ['heroi', 'aliado']) expect(pegarFicha(id).activeConditions?.some(c => c.conditionId === 'exposto')).toBe(true);
    for (const id of ['a', 'b', 'neutro']) expect(pegarFicha(id).activeConditions ?? []).toHaveLength(0);
  });
  it.each(['cone', 'linha'] as const)('%s usa a geometria do mapa e a direção escolhida', async forma => {
    mesa();
    const r = await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma, tamanho_m: 6 } }, { ponto: { x: 9000, y: 9000 }, rotacao: 0 });
    expect(r.ok && r.dano).toBe(8);
    expect(pegarFicha('aliado').hpCurrent).toBe(100);
    expect(pegarFicha('a').hpCurrent).toBe(96);
    expect(pegarFicha('b').hpCurrent).toBe(96);
  });
  it('raio no ponto mede alcance até o centro, não até cada criatura', async () => {
    mesa();
    useMapStore.getState().updateEntity('e-b', { x: 70 * 5 });
    const r = await executarAcaoAtiva('heroi', { ...cfg, alcanceM: 3, tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'raio_no_ponto', tamanho_m: 4.5 } }, { ponto: { x: 140, y: 0 } });
    expect(r.ok && r.dano).toBe(8);
    expect(pegarFicha('b').hpCurrent).toBe(96);
  });
  it('área cancelada, vazia, inválida ou fora de alcance não cobra custos', async () => {
    for (const modo of ['cancelar', 'vazia', 'invalida', 'distante']) {
      mesa();
      const c: AcaoAtivaConfig = { ...cfg, tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'raio_no_ponto', tamanho_m: modo === 'invalida' ? -1 : 0.1 } };
      vi.spyOn(useMapStore.getState(), 'requestAoEPlacement').mockResolvedValue(null);
      const r = await executarAcaoAtiva('heroi', c, modo === 'cancelar' ? '' : { ponto: { x: modo === 'distante' ? 9000 : 0, y: 0 } });
      expect(r.ok).toBe(false);
      expect(pegarFicha('heroi').peCurrent).toBe(20);
      expect(pegarFicha('heroi').actionsCurrent).toBe(1);
    }
  });
  it('lados explícitos permitem NPC aliado e evitam assumir NPC neutro como inimigo', async () => {
    mesa();
    expect((await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'unico', filtro_alvo: 'inimigos' }, 'neutro')).ok).toBe(false);
    useMapStore.setState({ initiative: { entries: [{ id: 'n', name: 'NPC aliado', init: 1, entityId: 'e-neutro', side: 'ally' }], turnIndex: 0, round: 1 } });
    expect((await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'unico', filtro_alvo: 'aliados' }, 'neutro')).ok).toBe(true);
  });
  it('área avalia cada TR independentemente e só aplica efeitos na falha', async () => {
    mesa();
    forcarDados(1, 20);
    const r = await executarAcaoAtiva('heroi', { ...cfg, tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'linha', tamanho_m: 6 }, teste: 'tr', cd: '15', metadeNoSucesso: true, efeitos: [{ tipo: 'condicao', condicao: 'exposto', rodadas: 1 }] }, { ponto: { x: 0, y: 0 }, rotacao: 0 });
    expect(r.ok && r.dano).toBe(6);
    expect(pegarFicha('a').activeConditions?.some(c => c.conditionId === 'exposto')).toBe(true);
    expect(pegarFicha('b').activeConditions ?? []).toHaveLength(0);
    expect(pegarFicha('heroi').peCurrent).toBe(18);
  });
});

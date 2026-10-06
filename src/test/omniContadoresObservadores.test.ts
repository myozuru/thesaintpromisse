// @vitest-environment jsdom
/**
 * Chaves genéricas novas do OMNI no combate real em memória (stores de verdade,
 * peças no mapa, dano real): gatilhos de observação espacial, contadores com
 * teto global/por fonte, consumo → @CENA.consumido, dados dinâmicos e
 * condicao_rodadas_<id>.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { useInventoryStore } from '@/stores/useInventoryStore';
import { novaEntidade } from '@/lib/omni/tipos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { parseOmniScript, efeitosParaScript } from '@/lib/omni/omniScript';
import { compilarScriptNatural } from '@/lib/omni/compilarNatural';
import { dispararGatilhoEfeitosItens } from '@/lib/omni/triggerEfeitos';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { executarGatilho } from '@/lib/omni/executor';
import * as eventBus from '@/lib/omni/eventBus';
import { calcularContador } from '@/lib/omni/contadores';
import { avaliarFormula } from '@/lib/omni/parser';
import { eventoObservado } from '@/lib/omni/observadores';
import { resolverGatilho } from '@/lib/omni/gatilhoAliases';
import { DICIONARIO_CHAVES_OMNI, ROTULOS_GATILHOS } from '@/lib/omni/constantesDoSistema';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, esperar } from './helpers/mesaReal';

function passiva(id: string, script: string, defaultTarget: 'ALVO' | 'USUARIO' = 'USUARIO'): EntidadeOmni {
  const r = parseOmniScript(script, { defaultTarget });
  expect(r.erros, script).toHaveLength(0);
  return {
    id, versao: 1, nome: id, categoria: 'passiva', descricao: '', tags: [],
    duracao: { tipo: 'permanente' }, custos: [], gatilhos: [],
    combatData: { effectsPassive: r.efeitos },
  } as unknown as EntidadeOmni;
}
const vincular = (ent: EntidadeOmni) => {
  useOmniEntidadesStore.setState({ entidades: { ...useOmniEntidadesStore.getState().entidades, [ent.id]: ent } } as never);
  return { id: `v-${ent.id}`, entidadeId: ent.id, categoria: 'passiva', instanceId: `i-${ent.id}` };
};
const aliado = (id: string, extra: Record<string, unknown> = {}) => ficha(id, { hpCurrent: 40, hpMax: 40, escCurrent: 0, ...extra } as never);
const inimigo = (id: string, extra: Record<string, unknown> = {}) => ficha(id, { category: 'INIMIGO', hpCurrent: 40, hpMax: 40, escCurrent: 0, ...extra } as never);
const treinoDe = (id: string) => montarVariaveisDoPersonagem(pegarFicha(id), 'USUARIO').USUARIO_TREINO;
const danoEm = async (id: string, qtd: number, attackerId?: string) => {
  useCharacterStore.getState().applyDamage(id, qtd, undefined, { attackerId, ignoresRD: true });
  await esperar(20);
};

beforeEach(() => { useInventoryStore.setState({ items: {}, deleted: {} }); comoTela({ profileId: null, role: 'MASTER' }); useOmniEntidadesStore.setState({ entidades: {} } as never); });
afterEach(() => { limparMesa(); vi.restoreAllMocks(); });

describe('Regras puras', () => {
  it('teto global limita o total mesmo com parcelas separadas por fonte', () => {
    let c: Record<string, number> = {};
    for (const f of ['a', 'a', 'a', 'b', 'c', 'c']) c = calcularContador(c, 'rancor', 'INCREMENTAR_CONTADOR', { valor: 1, teto: 2, rastrearFonte: true, fonteId: f }).counters;
    expect(c.rancor).toBe(2);
    expect(c['rancor__fonte__a']).toBe(2);
    expect(c['rancor__fonte__b']).toBeUndefined();
  });
  it('avança ciclo de cota ao concluir descansos curto e longo', async () => {
    montarMesa([aliado('ana')], {});
    expect(pegarFicha('ana').omniCounterRestCycle ?? 0).toBe(0);
    await useCharacterStore.getState().applyShortRest('ana');
    await esperar(10);
    expect(pegarFicha('ana').omniCounterRestCycle).toBe(1);
    await useCharacterStore.getState().applyLongRest('ana');
    await esperar(10);
    expect(pegarFicha('ana').omniCounterRestCycle).toBe(2);
  });
  it('limite por aliado usa ciclo explícito e não se renova quando o saldo é gasto', () => {
    let counters: Record<string, number> = {};
    let usoPorFonte: Record<string, Record<string, { ciclo: string; usados: number }>> = {};
    const somar = (fonteId: string, cicloFonte: string) => {
      const r = calcularContador(counters, 'rancor', 'INCREMENTAR_CONTADOR', { valor: 1, teto: 3, rastrearFonte: true, fonteId, limiteFonte: 1, cicloFonte, usoPorFonte });
      counters = r.counters;
      usoPorFonte = r.usoPorFonte;
    };
    somar('aliado-a', 'rodada:1');
    somar('aliado-a', 'rodada:1');
    expect(counters.rancor).toBe(1);
    counters = calcularContador(counters, 'rancor', 'CONSUMIR_CONTADOR', { valor: 0 }).counters;
    somar('aliado-a', 'rodada:1');
    expect(counters.rancor).toBe(0);
    somar('aliado-a', 'rodada:2');
    somar('aliado-b', 'rodada:2');
    expect(counters.rancor).toBe(2);
  });
  it('teto global e consumo total/parcial', () => {
    let c: Record<string, number> = {};
    for (let i = 0; i < 5; i++) c = calcularContador(c, 'foco', 'INCREMENTAR_CONTADOR', { valor: 1, teto: 3 }).counters;
    expect(c.foco).toBe(3);
    const p = calcularContador(c, 'foco', 'CONSUMIR_CONTADOR', { valor: 2 });
    expect(p.consumido).toBe(2); expect(p.counters.foco).toBe(1);
    const t = calcularContador(p.counters, 'foco', 'CONSUMIR_CONTADOR', { valor: 0 });
    expect(t.consumido).toBe(1); expect(t.counters.foco).toBe(0);
  });
  it('preserva saldo antigo ao iniciar rastreio por fonte', () => {
    const inicial = calcularContador({}, 'rancor', 'INCREMENTAR_CONTADOR', { valor:2 });
    const rastreado = calcularContador(inicial.counters, 'rancor', 'INCREMENTAR_CONTADOR', { valor:1, teto:4, rastrearFonte:true, fonteId:'aliado-b' });
    expect(rastreado.counters.rancor).toBe(3);
    expect(rastreado.counters['rancor__fonte__geral']).toBe(2);
    expect(rastreado.counters['rancor__fonte__aliado-b']).toBe(1);
  });
  it('dados com quantidade dinâmica (@X)dY', () => {
    expect(avaliarFormula('(@USUARIO.rancor)d1', { USUARIO_RANCOR: 4 }).valor).toBe(4);
    expect(avaliarFormula('(@USUARIO.rancor)d1', { USUARIO_RANCOR: 0 }).valor).toBe(0);
  });
  it('evento observado escolhe aliado/inimigo pelo lado', () => {
    expect(eventoObservado('sofrerDano', { category: 'PLAYER' } as never, { category: 'NPC' } as never)).toBe('aoAliadoSofrerDano');
    expect(eventoObservado('sofrerDano', { category: 'PLAYER' } as never, { category: 'INIMIGO' } as never)).toBe('aoInimigoSofrerDano');
    expect(eventoObservado('morrer', { category: 'INIMIGO' } as never, { category: 'INIMIGO' } as never)).toBe('aoAliadoMorrer');
  });
  it('lista de chaves: todos os gatilhos novos têm rótulo e alias, e chaves aparecem no dicionário', () => {
    for (const g of ['aoAliadoSofrerDano', 'aoInimigoSofrerDano', 'aoAliadoCausarDano', 'aoInimigoCausarDano', 'aoAliadoMorrer', 'aoInimigoMorrer']) {
      expect(ROTULOS_GATILHOS[g as keyof typeof ROTULOS_GATILHOS]).toBeTruthy();
    }
    expect(resolverGatilho('@aliado_sofrer_dano')).toBe('aoAliadoSofrerDano');
    expect(resolverGatilho('inimigo_cair')).toBe('aoInimigoMorrer');
    const ids = DICIONARIO_CHAVES_OMNI.flatMap((c) => c.itens.map((i) => i.id));
    for (const k of ['CENA.consumido', 'CENA.outro_inimigo', 'condicao_rodadas_desde_<id>', '<nome>__fonte__<id>']) expect(ids).toContain(k);
  });
  it('script reabre igual (ate / por_fonte)', () => {
    const r = parseOmniScript('@aliado_sofrer_dano -> somar 1 em contador_rancor ate @USUARIO.treino por_fonte', { defaultTarget: 'USUARIO' });
    expect(r.efeitos[0].counterPerSource).toBe(true);
    expect(efeitosParaScript(r.efeitos, { defaultTarget: 'USUARIO' })).toContain('ate treino por_fonte');
  });
  it('script preserva limite de fonte e periodicidade explícita', () => {
    const script = '@aliado_sofrer_dano -> somar 1 em contador_rancor ate @USUARIO.treino por_fonte teto_aliado 1 por rodada';
    const parsed = parseOmniScript(script, { defaultTarget: 'USUARIO' });
    expect(parsed.erros).toHaveLength(0);
    expect(parsed.efeitos[0]).toMatchObject({ counterCap: '@USUARIO.treino', counterPerSource: true, counterSourceLimit: '1', counterSourcePeriod: 'rodada' });
    expect(efeitosParaScript(parsed.efeitos, { defaultTarget: 'USUARIO' })).toContain('ate treino por_fonte teto_aliado 1 por rodada');
  });
});

describe('Combate real — Retribuição (aliado a 4,5 m sofre dano → carga por aliado)', () => {
  it('acumula por aliado até o treino, ignora quem está longe, depois consome em dano real', async () => {
    const rancor = passiva('rancor', '@aliado_sofrer_dano -> se @CENA.distancia <= 4.5 entao somar 1 em contador_rancor ate @USUARIO.treino por_fonte teto_aliado 1 por rodada');
    const corte = passiva('corte', '@acertar -> subtrair tudo em usuario.contador_rancor e subtrair (@CENA.consumido)d1 em vida_atual', 'ALVO');
    montarMesa(
      [aliado('ana', { level: 9, omniAtivos: [vincular(rancor), vincular(corte)] }), aliado('bia'), aliado('caio'), aliado('davi'), inimigo('inim')],
      { ana: [0, 0], bia: [1, 0], caio: [3, 0], davi: [8, 0], inim: [2, 1] },
    );
    const t = treinoDe('ana');
    expect(t).toBeGreaterThan(1);
    useCombatStore.setState({ inCombat: true, combatId: 'contador-test', round: 1 });
    for (let i = 0; i < t + 2; i++) await danoEm('bia', 2, 'inim');   // perto: acumula até t
    await danoEm('caio', 2, 'inim');                                     // perto: +1
    await danoEm('davi', 2, 'inim');                                     // 9+ m: nada
    useCombatStore.setState({ round: 2 });
    await danoEm('bia', 2, 'inim');                                      // a cota renova na rodada nova
    await danoEm('inim', 2, 'bia');                                      // inimigo ferido: não é aliado
    const a = pegarFicha('ana');
    const esperado = Math.min(t, 3);
    expect(a.omniCounters?.['rancor__fonte__bia']).toBe(2);
    expect(a.omniCounters?.['rancor__fonte__caio']).toBe(1);
    expect(a.omniCounters?.['rancor__fonte__davi']).toBeUndefined();
    expect(a.omniCounters?.rancor).toBe(esperado);

    const hpAntes = pegarFicha('inim').hpCurrent;
    dispararGatilhoEfeitosItens('aoAcertarAtaque', { usuarioId: 'ana', alvoId: 'inim' });
    await esperar(20);
    expect(pegarFicha('ana').omniCounters?.rancor).toBe(0);
    expect(hpAntes - pegarFicha('inim').hpCurrent).toBe(esperado);
  });

  it('sem peça no mapa a distância é 999 e não acumula', async () => {
    const rancor = passiva('rancor2', '@aliado_sofrer_dano -> se @CENA.distancia <= 4.5 entao somar 1 em contador_rancor');
    montarMesa([aliado('ana', { omniAtivos: [vincular(rancor)] }), aliado('bia'), inimigo('inim')], { ana: [0, 0] });
    await danoEm('bia', 3, 'inim');
    expect(pegarFicha('ana').omniCounters?.rancor ?? 0).toBe(0);
  });
});

describe('Combate real — outros observadores e condição com duração', () => {
  it('inimigo cai perto → contador; inimigo causa dano → gatilho', async () => {
    const almas = passiva('almas', '@inimigo_cair -> se @CENA.distancia <= 9 entao somar 1 em contador_almas');
    const alerta = passiva('alerta', '@inimigo_causar_dano -> somar 1 em contador_alerta');
    montarMesa([aliado('ana', { omniAtivos: [vincular(almas), vincular(alerta)] }), aliado('bia'), inimigo('inim', { hpCurrent: 5 })], { ana: [0, 0], bia: [1, 0], inim: [2, 0] });
    await danoEm('bia', 3, 'inim');
    expect(pegarFicha('ana').omniCounters?.alerta).toBe(1);
    await danoEm('inim', 10, 'bia');
    expect(pegarFicha('ana').omniCounters?.almas).toBe(1);
  });

  it('condicao_rodadas_<id> lê as rodadas restantes no alvo (crítico condicional)', async () => {
    const corte = passiva('corte2', '@acertar -> se @ALVO.condicao_rodadas_condenado > 3 entao somar 1 em usuario.contador_margem', 'ALVO');
    const cond = (r: number) => [{ id: 'c1', conditionId: 'condenado', name: 'Condenado', icon: '', remainingTurns: -1, remainingRounds: r }];
    montarMesa([aliado('ana', { omniAtivos: [vincular(corte)] }), inimigo('inim', { activeConditions: cond(2) })], { ana: [0, 0], inim: [1, 0] });
    dispararGatilhoEfeitosItens('aoAcertarAtaque', { usuarioId: 'ana', alvoId: 'inim' });
    expect(pegarFicha('ana').omniCounters?.margem ?? 0).toBe(0);
    useCharacterStore.getState().updateCharacter('inim', { activeConditions: cond(4) } as never);
    dispararGatilhoEfeitosItens('aoAcertarAtaque', { usuarioId: 'ana', alvoId: 'inim' });
    expect(pegarFicha('ana').omniCounters?.margem).toBe(1);
  });
});


describe('Rancor na arma empunhada pelo painel', () => {
  it('acumula pelo dano próprio e do aliado próximo sem isEquipped; arma guardada não dispara', async () => {
    const script = `@sofrer_dano -> (somar 1 em usuario.contador_rancor ate treino por_fonte);
@aliado_sofrer_dano -> se @CENA.distancia <= 4.5 entao (somar 1 em usuario.contador_rancor ate treino por_fonte);
@acertar -> (subtrair (@USUARIO.contador rancor)d1 em vida_atual tipo "Psíquico")`;
    const parsed = parseOmniScript(script, { defaultTarget: 'ALVO' });
    expect(parsed.erros).toEqual([]);
    const ent = { ...novaEntidade('arma'), nome: 'Katana', tags: ['modelo:katana'], combatData: { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: parsed.efeitos } };
    montarMesa([aliado('ana'), aliado('bia'), aliado('longe'), inimigo('inim')], { ana: [0, 0], bia: [3, 0], longe: [8, 0], inim: [1, 0] });
    const inst = useInventoryStore.getState().add('ana', ent);
    expect(useInventoryStore.getState().items[inst.instanceId].isEquipped).toBeFalsy();
    useCharacterStore.getState().equipWeapons('ana', { mainHandName: 'Katana' });
    await danoEm('ana', 2, 'inim');
    expect(pegarFicha('ana').omniCounters?.rancor).toBe(1);
    expect(pegarFicha('ana').omniCounters?.['rancor__fonte__ana']).toBe(1);
    expect(pegarFicha('ana').omniCounters?.['rancor__fonte__inim']).toBeUndefined();
    await danoEm('bia', 2, 'inim');
    expect(pegarFicha('ana').omniCounters?.rancor).toBe(2);
    expect(pegarFicha('ana').omniCounters?.['rancor__fonte__bia']).toBe(1);
    await danoEm('longe', 2, 'inim');
    expect(pegarFicha('ana').omniCounters?.rancor).toBe(2);
    const hp = pegarFicha('inim').hpCurrent;
    dispararGatilhoEfeitosItens('aoAcertarAtaque', { usuarioId: 'ana', alvoId: 'inim' });
    expect(pegarFicha('inim').hpCurrent).toBe(hp - 2);
    useCharacterStore.getState().equipWeapons('ana', { mainHandName: null });
    await danoEm('ana', 2, 'inim');
    await danoEm('bia', 2, 'inim');
    expect(pegarFicha('ana').omniCounters?.rancor).toBe(2);
  });
});

it('executa gramática natural na arma: dano próprio e aliado próximo geram uma carga pós-mitigação', async () => {
  const proprio = compilarScriptNatural('ao sofrer dano de inimigo então acumular 1 contador_rancor até treino');
  const observado = compilarScriptNatural('quando aliado até 4.5m sofrer dano de inimigo então acumular 1 contador_rancor até treino por_fonte teto_aliado 1 por rodada');
  expect([...proprio.erros, ...observado.erros]).toEqual([]);
  const ent = { ...novaEntidade('arma'), id:'lamina_rancor_natural', nome:'Lâmina do Rancor', tags:['modelo:katana'], combatData:{ effects:[], effectsPassive:[...proprio.efeitos, ...observado.efeitos] } } as unknown as EntidadeOmni;
  montarMesa([aliado('ana', { trainingBonus:3, escCurrent:10, omniAtivos:[vincular(ent)] }), aliado('bia'), inimigo('inim')], { ana:[0,0], bia:[3,0], inim:[1,0] });
  expect(treinoDe('ana')).toBe(3);
  await danoEm('ana', 2, 'inim');
  expect(pegarFicha('ana').omniCounters?.rancor ?? 0).toBe(0);
  useCharacterStore.getState().updateCharacter('ana', { escCurrent:0 });
  await danoEm('ana', 2, 'inim');
  expect(pegarFicha('ana').omniCounters?.rancor).toBe(1);
  await danoEm('bia', 2, 'inim');
  expect(pegarFicha('ana').omniCounters?.rancor).toBe(2);
  await danoEm('bia', 2, 'ana');
  expect(pegarFicha('ana').omniCounters?.rancor).toBe(2);
});


it('receita com teto total, inimigos e dano corpo a corpo; cópias não duplicam carga', async () => {
  const script = `@sofrer_dano -> se @ALVO.eh_inimigo > 0 entao (somar 1 em @USUARIO.contador rancor ate @USUARIO.treino);
@aliado_sofrer_dano -> se @CENA.distancia <= 4.5 e @CENA.outro_eh_inimigo > 0 entao (somar 1 em @USUARIO.contador rancor ate @USUARIO.treino);
@acertar -> se @DANO.tipo_ataque == 1 entao (subtrair (@USUARIO.contador rancor)d1 em @ALVO.vida tipo "Psíquico")`;
  const parsed = parseOmniScript(script, { defaultTarget: 'ALVO' });
  expect(parsed.erros).toEqual([]);
  const ent = { ...novaEntidade('arma'), nome: 'Katana', tags: ['modelo:katana'], combatData: { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: parsed.efeitos } };
  montarMesa([aliado('ana'), aliado('bia'), aliado('longe'), inimigo('inim')], { ana: [0, 0], bia: [3, 0], longe: [8, 0], inim: [1, 0] });
  useInventoryStore.getState().add('ana', ent);
  useInventoryStore.getState().add('ana', ent);
  useCharacterStore.getState().equipWeapons('ana', { mainHandName: 'Katana' });
  await danoEm('ana', 1, 'bia');
  await danoEm('bia', 1, 'ana');
  await danoEm('longe', 1, 'inim');
  expect(pegarFicha('ana').omniCounters?.rancor ?? 0).toBe(0);
  expect(pegarFicha('inim').category).toBe('INIMIGO');
  expect(montarVariaveisDoPersonagem(pegarFicha('inim'), 'ALVO').ALVO_EH_INIMIGO).toBe(1);
  await danoEm('ana', 1, 'inim');
  expect(pegarFicha('ana').omniCounters?.rancor).toBe(1);
  for (let i = 0; i < treinoDe('ana') + 1; i++) await danoEm('bia', 1, 'inim');
  expect(pegarFicha('ana').omniCounters?.rancor).toBe(treinoDe('ana'));
  const hp = pegarFicha('inim').hpCurrent;
  dispararGatilhoEfeitosItens('aoAcertarAtaque', { usuarioId: 'ana', alvoId: 'inim', dano: { tipo_ataque: 2 } });
  expect(pegarFicha('inim').hpCurrent).toBe(hp);
  dispararGatilhoEfeitosItens('aoAcertarAtaque', { usuarioId: 'ana', alvoId: 'inim', dano: { tipo_ataque: 1 } });
  expect(pegarFicha('inim').hpCurrent).toBe(hp - treinoDe('ana'));
});


it('construtor visual usa a vítima como fonte e notifica somente mudanças', async () => {
  montarMesa([aliado('ana'), inimigo('inim')], { ana: [0, 0], inim: [1, 0] });
  const ent = { ...novaEntidade('passiva'), gatilhos: [{ id: 'g', evento: 'aoSofrerDano' as const, blocos: [{ id: 'b', condicoes: [], modo: 'todas' as const, acoes: [{ id: 'a', acao: 'INCREMENTAR_CONTADOR' as const, alvoAplicacao: 'USUARIO' as const, caminhoAlvo: 'rancor', valor: { tipo: 'fixo' as const, valor: 1 }, teto: { tipo: 'fixo' as const, valor: 1 }, escopoTeto: 'porFonte' as const }] }] }] };
  const spy = vi.spyOn(eventBus, 'emitirEvento');
  for (let i = 0; i < 2; i++) {
    executarGatilho(ent, 'aoSofrerDano', { usuario: pegarFicha('ana'), alvo: pegarFicha('inim') });
    await esperar(20);
  }
  expect(pegarFicha('ana').omniCounters).toMatchObject({ rancor: 1, rancor__fonte__ana: 1 });
  expect(pegarFicha('ana').omniCounters?.rancor__fonte__inim).toBeUndefined();
  expect(spy.mock.calls.filter(([e]) => e === 'aoAtualizarContador')).toHaveLength(1);
});

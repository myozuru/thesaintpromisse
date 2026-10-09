// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, pegarFicha, limparMesa, esperar } from './helpers/mesaReal';
import { novaEntidade, type CombatEffect, type EntidadeOmni, type AcaoLogica } from '@/lib/omni/tipos';
import type { GatilhoId } from '@/lib/omni/constantesDoSistema';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniSpatialStore } from '@/stores/useOmniSpatialStore';
import { iniciarWatcherEngine } from '@/lib/omni/watcherEngine';
import { executarGatilho } from '@/lib/omni/executor';
import { interpretarComposicao } from '@/lib/omni/componentes/interpretar';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { aplicarMovimentoAtivo } from '@/lib/omni/movimentosAtivos';
import { dispararGatilhoEfeitosItens } from '@/lib/omni/triggerEfeitos';
import { parseOmniScript } from '@/lib/omni/omniScript';
import * as bus from '@/lib/omni/eventBus';
import { recalcularAuras } from '@/lib/omni/auras';
const ch = (id: string) => ficha(id, { hpCurrent: 100, hpMax: 100, peCurrent: 20, peMax: 20, rd: 0, escCurrent: 0, attributes: [], trainingBonus: 3, actionsCurrent: 3, bonusActionsCurrent: 3, reactionsCurrent: 3, activeBuffs: [], skills: [] });
const contador = (nome = 'teste', valor = 1): AcaoLogica => ({ id: 'c', acao: 'INCREMENTAR_CONTADOR', alvoAplicacao: 'USUARIO', caminhoAlvo: nome, valor: { tipo: 'fixo', valor } });
function visual(evento: GatilhoId, nome = 'teste') {
  const e = novaEntidade('passiva'); e.gatilhos = [{ id: 'g', evento, blocos: [{ id: 'b', modo: 'todas', condicoes: [], acoes: [contador(nome)] }] }]; return e;
}
function vincular(id: string, e: EntidadeOmni) {
  useOmniEntidadesStore.setState(s => ({ entidades: { ...s.entidades, [e.id]: e } }));
  useCharacterStore.getState().updateCharacter(id, { omniAtivos: [...(pegarFicha(id).omniAtivos ?? []), { id: crypto.randomUUID(), entidadeId: e.id, categoria: e.categoria as 'passiva' | 'aura', instanceId: crypto.randomUUID(), vinculadoEm: 0 }] });
}
const efeito = (p: Partial<CombatEffect> = {}): CombatEffect => ({ id: crypto.randomUUID(), type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'pe', formula: '1', ...p });
function observar(p: Partial<CombatEffect> = {}, categoria: EntidadeOmni['categoria'] = 'item') {
  const e = novaEntidade(categoria, 'Observador'); e.usos = { total: 3, recarga: 'manual' };
  e.combatData = { critRange: 20, critMultiplier: 2, effects: [], effectsPassive: [efeito({ watcher: { resource: 'vida', op: '<=', threshold: 50 }, ...p })] };
  const item = useInventoryStore.getState().add('u', e);
  if (categoria === 'arma') useCharacterStore.getState().updateCharacter('u', { mainHandWeaponName: e.nome });
  else useInventoryStore.getState().equipItem(item.instanceId, 'Anel');
  return item;
}
beforeEach(async () => {
  for (const m of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, m).mockImplementation(() => {});
  useInventoryStore.setState({ items: {} }); useOmniEntidadesStore.setState({ entidades: {} }); useOmniRuntimeStore.setState({ efeitos: {} }); useOmniSpatialStore.setState({ posicoes: {} });
  montarMesa([ch('u'), ch('a'), ch('b')], { u: [0, 0], a: [2, 0], b: [1, 1] });
  iniciarWatcherEngine(); await esperar(5);
});
afterEach(async () => { await esperar(10); limparMesa(); });

describe('isolamento do dono de eventos', () => {
  it('passiva visual do alvo não recebe o evento emitido para o usuário', () => {
    vincular('a', visual('aoSofrerDano'));
    expect(bus.emitirEvento('aoSofrerDano', { usuarioId: 'u', alvoId: 'a' })).toBe(0);
    expect(pegarFicha('u').omniCounters?.teste ?? 0).toBe(0);
    bus.emitirEvento('aoSofrerDano', { usuarioId: 'a', alvoId: 'u' });
    expect(pegarFicha('a').omniCounters?.teste).toBe(1);
  });
  it('um modelo de catálogo não vinculado não é uma passiva global', () => {
    const e = visual('aoSofrerDano'); e.gatilhos.push({ id: 'p', evento: 'aoEquipar', blocos: [] });
    useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    expect(bus.emitirEvento('aoSofrerDano', { usuarioId: 'u', incluirPassivas: true })).toBe(0);
  });
  it('efeito persistente reage pelo portador, sem reaplicar no conjurador', () => {
    const e = visual('noFimDoTurno'); useOmniEntidadesStore.setState({ entidades: { [e.id]: e } });
    useOmniRuntimeStore.getState().aplicarEfeito(e, { sourceCharId: 'a', targetCharId: 'u' });
    bus.emitirEvento('noFimDoTurno', { usuarioId: 'a' }); expect(pegarFicha('a').omniCounters?.teste ?? 0).toBe(0);
    bus.emitirEvento('noFimDoTurno', { usuarioId: 'u' }); expect(pegarFicha('u').omniCounters?.teste).toBe(1);
  });
  it('relógio global entrega a cada dono uma vez, incluindo scripts do terminal', () => {
    const e = visual('aoAvancarRelogio'); vincular('u', e); vincular('a', e);
    bus.emitirEvento('aoAvancarRelogio', { incluirPassivas: true });
    expect(pegarFicha('u').omniCounters?.teste).toBe(1); expect(pegarFicha('a').omniCounters?.teste).toBe(1); expect(pegarFicha('b').omniCounters?.teste).toBeUndefined();
  });
  it('gatilho visual de arma só dispara empunhada, mesmo sem registro no catálogo', () => {
    const e = { ...visual('aoSofrerDano'), categoria: 'arma' as const, nome: 'Arma Visual' }; useInventoryStore.getState().add('u', e);
    bus.emitirEvento('aoSofrerDano', { usuarioId: 'u' }); expect(pegarFicha('u').omniCounters?.teste).toBeUndefined();
    useCharacterStore.getState().updateCharacter('u', { offHandWeaponName: e.nome });
    bus.emitirEvento('aoSofrerDano', { usuarioId: 'u' }); expect(pegarFicha('u').omniCounters?.teste).toBe(1);
  });
  it('equipar dispara só a nova instância e reequipar no mesmo slot é idempotente', async () => {
    const e1 = visual('aoEquipar', 'primeiro'), e2 = visual('aoEquipar', 'segundo');
    const i1 = useInventoryStore.getState().add('u', e1), i2 = useInventoryStore.getState().add('u', e2);
    useInventoryStore.getState().equipItem(i1.instanceId, 'Anel 1'); await waitFor(() => expect(pegarFicha('u').omniCounters?.primeiro).toBe(1));
    useInventoryStore.getState().equipItem(i2.instanceId, 'Anel 2'); await waitFor(() => expect(pegarFicha('u').omniCounters?.segundo).toBe(1));
    useInventoryStore.getState().equipItem(i2.instanceId, 'Anel 2'); await esperar(5);
    expect(pegarFicha('u').omniCounters?.primeiro).toBe(1); expect(pegarFicha('u').omniCounters?.segundo).toBe(1);
  });
  it('fórmula desconhecida no bloco visual não executa a ação', () => {
    const e = visual('aoMover'); e.gatilhos[0].blocos[0].acoes[0].valor = { tipo: 'formula', expressao: '@USUARIO.chave_inexistente + 1' };
    executarGatilho(e, 'aoMover', { usuario: pegarFicha('u') }); expect(pegarFicha('u').omniCounters?.teste).toBeUndefined();
  });
  it('referência estruturada ausente não vira zero em uma condição', () => {
    const e = visual('aoMover');
    e.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'IGUAL',
      esquerdo: { tipo: 'ref', ref: { alvo: 'USUARIO', caminho: 'chave_inexistente' } },
      direito: { tipo: 'fixo', valor: 0 },
    }];
    expect(executarGatilho(e, 'aoMover', { usuario: pegarFicha('u') })).toBe(0);
    expect(pegarFicha('u').omniCounters?.teste).toBeUndefined();
  });
  it('composição sem dados do contexto não vira zero em uma condição', () => {
    const composicao = interpretarComposicao('@DANO.dano final').referencia;
    expect(composicao).toBeDefined();
    const e = visual('aoMover');
    e.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'IGUAL',
      esquerdo: { tipo: 'ref', ref: { alvo: 'ALVO', caminho: '@DANO.dano final', composicao: composicao! } },
      direito: { tipo: 'fixo', valor: 0 },
    }];
    expect(executarGatilho(e, 'aoMover', { usuario: pegarFicha('u') })).toBe(0);
    expect(pegarFicha('u').omniCounters?.teste).toBeUndefined();
  });
  it('contador nomeado ausente continua sendo uma leitura válida com valor zero', () => {
    const e = visual('aoMover');
    e.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'IGUAL',
      esquerdo: { tipo: 'ref', ref: { alvo: 'USUARIO', caminho: 'contador_rancor' } },
      direito: { tipo: 'fixo', valor: 0 },
    }];
    expect(executarGatilho(e, 'aoMover', { usuario: pegarFicha('u') })).toBe(1);
    expect(pegarFicha('u').omniCounters?.teste).toBe(1);
  });
  it('referência direta de CENA lê o valor presente no contexto', () => {
    const e = visual('aoMover');
    e.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'IGUAL',
      esquerdo: { tipo: 'ref', ref: { alvo: 'CENA', caminho: 'distancia' } },
      direito: { tipo: 'fixo', valor: 0 },
    }];
    expect(executarGatilho(e, 'aoMover', { usuario: pegarFicha('u'), cena: { distancia: 0 } })).toBe(1);
    expect(pegarFicha('u').omniCounters?.teste).toBe(1);
  });
  it('referência direta de CENA sem contexto é inválida, não zero', () => {
    const e = visual('aoMover');
    e.gatilhos[0].blocos[0].condicoes = [{ id: 'c', operador: 'IGUAL',
      esquerdo: { tipo: 'ref', ref: { alvo: 'CENA', caminho: 'distancia' } },
      direito: { tipo: 'fixo', valor: 0 },
    }];
    expect(executarGatilho(e, 'aoMover', { usuario: pegarFicha('u') })).toBe(0);
    expect(pegarFicha('u').omniCounters?.teste).toBeUndefined();
  });
  it('ação visual recusa destino sem escrita em vez de registrar sucesso', () => {
    useLogStore.getState().clearLogs();
    const e = novaEntidade('passiva', 'Destino inválido');
    e.gatilhos = [{ id: 'g', evento: 'aoMover', blocos: [{ id: 'b', modo: 'todas', condicoes: [], acoes: [{
      id: 'a', acao: 'SOMAR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'chave_inexistente', valor: { tipo: 'fixo', valor: 1 },
    }] }] }];
    executarGatilho(e, 'aoMover', { usuario: pegarFicha('u') });
    const mensagens = useLogStore.getState().logs.map(log => log.message);
    expect(mensagens.some(mensagem => mensagem.includes('não grava') && mensagem.includes('chave_inexistente'))).toBe(true);
    expect(mensagens.some(mensagem => mensagem.includes('+1 em chave_inexistente'))).toBe(false);
  });
  it('ação visual altera usos_restantes na instância que originou o gatilho', () => {
    const entidade = novaEntidade('item', 'Bomba'); entidade.usos = { total: 3, recarga: 'manual' };
    const instancia = useInventoryStore.getState().add('u', entidade);
    const e = novaEntidade('passiva', 'Gasto do item');
    e.gatilhos = [{ id: 'g', evento: 'aoEquipar', blocos: [{ id: 'b', modo: 'todas', condicoes: [], acoes: [{
      id: 'a', acao: 'SUBTRAIR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'usos_restantes', valor: { tipo: 'fixo', valor: 1 },
    }] }] }];
    executarGatilho(e, 'aoEquipar', { usuario: pegarFicha('u'), sourceInstanceId: instancia.instanceId });
    expect(useInventoryStore.getState().items[instancia.instanceId].usosRestantes).toBe(2);
  });
});

describe('observadores de estado', () => {
  it.each(['vida_atual', 'hp', 'pv', 'vida'])('percentual de %s usa o máximo correto e dispara uma vez na travessia', async resource => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 });
    const item = observar({ watcher: { resource, op: '<=', threshold: .5, percent: true } }); await esperar(5);
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 });
    await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(6));
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 30 }); await esperar(5);
    expect(pegarFicha('u').peCurrent).toBe(6); expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(2);
  });
  it.each([{ formula: '@USUARIO.chave_inexistente + 1' }, { condition: '@USUARIO.chave_inexistente == 0' }, { watcher: { resource: 'chave_inexistente', op: '<=' as const, threshold: 100 } }, { counterCap: '@USUARIO.chave_inexistente' }])('referência inválida não aplica nem consome usos: %j', async patch => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 });
    const item = observar(patch); await esperar(5); useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 }); await esperar(10);
    expect(pegarFicha('u').peCurrent).toBe(5); expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(3);
  });
  it('primeiro dano no mesmo tick de equipar não é perdido', async () => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 }); observar();
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 });
    await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(6));
  });
  it('queda e recuperação no mesmo tick ainda registram a travessia', async () => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 }); observar({ condition: '@USUARIO.vida <= 50' }); await esperar(5);
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 });
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 80 });
    await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(6));
    expect(pegarFicha('u').hpCurrent).toBe(80);
  });
  it('watcher vinculado sem item de inventário também reage', async () => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 });
    const e = novaEntidade('passiva'); e.combatData = { critRange: 20, critMultiplier: 2, effects: [], effectsPassive: [efeito({ watcher: { resource: 'vida', op: '<=', threshold: 50 } })] };
    vincular('u', e); await esperar(5); useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 });
    await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(6));
  });
  it('dado inválido não seleciona a branch zero nem consome usos', async () => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 });
    const item = observar({ diceSwitch: { dice: '@USUARIO.chave_inexistente', branches: [{ values: [0], effects: [efeito({ formula: '10' })] }] } }); await esperar(5);
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 }); await esperar(10);
    expect(pegarFicha('u').peCurrent).toBe(5); expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(3);
  });
  it('watcher na arma empunhada funciona mesmo sem flag de equipamento', async () => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 }); const item = observar({}, 'arma'); await esperar(5);
    expect(item.isEquipped).toBeFalsy(); useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 });
    await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(6));
  });
  it('item com watcher que consome usos pelo script não sofre auto-consumo duplicado', async () => {
    useCharacterStore.getState().updateCharacter('u', { peCurrent: 5 });
    const parsed = parseOmniScript('subtrair 2 em @ITEM.usos_restantes', { defaultTarget: 'USUARIO' });
    expect(parsed.erros).toEqual([]);
    const item = observar({ ...parsed.efeitos[0], watcher: { resource: 'vida', op: '<=', threshold: 50 } });
    await esperar(5);
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 40 });
    await waitFor(() => expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(1));
    expect(pegarFicha('u').peCurrent).toBe(5);
  });
  it('gatilho consome exatamente o total declarado em usos_restantes', () => {
    const parsed = parseOmniScript('subtrair 2 em @ITEM.usos_restantes', { defaultTarget: 'ALVO' });
    expect(parsed.erros).toEqual([]);
    const itemEntidade = novaEntidade('item', 'Relíquia com usos');
    itemEntidade.usos = { total: 3, recarga: 'manual' };
    itemEntidade.combatData = {
      critRange: 20, critMultiplier: 2, effects: [],
      effectsActive: [{ ...parsed.efeitos[0], trigger: 'aoSofrerDano' }],
    };
    const item = useInventoryStore.getState().add('u', itemEntidade);
    useInventoryStore.getState().equipItem(item.instanceId, 'Anel');
    expect(dispararGatilhoEfeitosItens('aoSofrerDano', { usuarioId: 'u', alvoId: 'a' })).toBe(1);
    expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(1);
  });
});

describe('eventos com origem identificada', () => {
  it('cura efetiva entrega aoCurar ao curador e aoReceberCura ao receptor; cura zero não dispara', async () => {
    vincular('u', visual('aoCurar', 'curou')); vincular('a', visual('aoReceberCura', 'recebeu'));
    useCharacterStore.getState().updateCharacter('a', { hpCurrent: 95 });
    useCharacterStore.getState().applyHealing('a', 20, 'other', 'u');
    await waitFor(() => expect(pegarFicha('u').omniCounters?.curou).toBe(1)); expect(pegarFicha('a').omniCounters?.recebeu).toBe(1);
    useCharacterStore.getState().applyHealing('a', 20, 'other', 'u'); await esperar(5); expect(pegarFicha('u').omniCounters?.curou).toBe(1);
  });
  it('ação OMNI de cura preserva o ID da origem', async () => {
    vincular('u', visual('aoCurar', 'curou')); useCharacterStore.getState().updateCharacter('a', { hpCurrent: 90 });
    const r = await executarAcaoAtiva('u', { id: 'cura', nome: 'Cura', acao: 'livre', custoPE: '0', alcanceM: 0, teste: 'nenhum', tipo_efeito: 'cura', cura: '4', tipo_alvo: 'unico', filtro_alvo: 'aliados' }, 'a', novaEntidade('item'));
    expect(r.ok).toBe(true); await waitFor(() => expect(pegarFicha('u').omniCounters?.curou).toBe(1)); expect(pegarFicha('a').hpCurrent).toBe(94);
  });
  it('conjuração OMNI validada emite uma vez; custo impossível não emite', async () => {
    vincular('u', visual('aoConjurarFeitico', 'conjurou'));
    const cfg = { id: 'magia', nome: 'Magia', acao: 'livre' as const, custoPE: '2', alcanceM: 0, teste: 'nenhum' as const, dano: '0', tipo_alvo: 'unico' as const, filtro_alvo: 'todos' as const };
    expect((await executarAcaoAtiva('u', cfg, 'a', novaEntidade('feitico'), { ignorarReacoes: true })).ok).toBe(true);
    await waitFor(() => expect(pegarFicha('u').omniCounters?.conjurou).toBe(1));
    expect((await executarAcaoAtiva('u', { ...cfg, custoPE: '999' }, 'a', novaEntidade('feitico'), { ignorarReacoes: true })).ok).toBe(false);
    await esperar(5); expect(pegarFicha('u').omniCounters?.conjurou).toBe(1);
  });
  it('condição válida entrega os dois lados; imunidade e ficha inexistente não emitem', async () => {
    vincular('u', visual('aoAplicarCondicao', 'aplicou')); vincular('a', visual('aoReceberCondicao', 'recebeu'));
    const cond = { id: 'c1', conditionId: 'caido', name: 'Caído', icon: '', remainingTurns: -1, remainingRounds: 2, sourceCharId: 'u' };
    useCharacterStore.getState().addCondition('a', cond); await waitFor(() => expect(pegarFicha('u').omniCounters?.aplicou).toBe(1)); expect(pegarFicha('a').omniCounters?.recebeu).toBe(1);
    useCharacterStore.getState().updateCharacter('a', { omniImmunities: ['todas'] });
    useCharacterStore.getState().addCondition('a', { ...cond, id: 'c2' });
    useCharacterStore.getState().addCondition('inexistente', cond); await esperar(5); expect(pegarFicha('u').omniCounters?.aplicou).toBe(1);
  });
  it('movimento OMNI emite para a ficha movida após reposicionamento real', async () => {
    vincular('a', visual('aoMover', 'moveu'));
    expect(aplicarMovimentoAtivo('u', 'a', { indice: 0, tipo: 'empurrar', sujeito: 'alvo', metros: 3 })).toContain('empurrado');
    await waitFor(() => expect(pegarFicha('a').omniCounters?.moveu).toBe(1));
    aplicarMovimentoAtivo('u', 'a', { indice: 0, tipo: 'empurrar', sujeito: 'alvo', metros: 0 }); await esperar(5);
    expect(pegarFicha('a').omniCounters?.moveu).toBe(1);
  });
  it('talento só emite após uso validado', async () => {
    vincular('u', visual('aoUsarTalento', 'talento'));
    expect(useCharacterStore.getState().consumeTalentUse('u', 'tal-provocacao-desafiadora').ok).toBe(false);
    await esperar(5); expect(pegarFicha('u').omniCounters?.talento).toBeUndefined();
    useCharacterStore.getState().updateCharacter('u', { attributes: [{ id: 'pre', name: 'Presença', value: 18, externalBonus: 0, mastery: false }] });
    expect(useCharacterStore.getState().consumeTalentUse('u', 'tal-provocacao-desafiadora').ok).toBe(true);
    await waitFor(() => expect(pegarFicha('u').omniCounters?.talento).toBe(1));
  });
  it('especialização emite após ativação, sem emitir em reserva vazia', async () => {
    vincular('u', visual('aoAtivarHabilidadeSpec', 'spec'));
    expect((await useCharacterStore.getState().activateSpecAbility('u', 'tec-economia-de-energia')).ok).toBe(false);
    useCharacterStore.getState().updateCharacter('u', { economiaPEReserve: 3, peCurrent: 5 });
    expect((await useCharacterStore.getState().activateSpecAbility('u', 'tec-economia-de-energia')).ok).toBe(true);
    await waitFor(() => expect(pegarFicha('u').omniCounters?.spec).toBe(1));
  });
  it('ligar aptidão emite, desligar não emite ativação', async () => {
    vincular('u', visual('aoAtivarAptidao', 'aptidao'));
    expect(useCharacterStore.getState().toggleAuraAptitude('u', 'aura_embacada').active).toBe(true);
    await waitFor(() => expect(pegarFicha('u').omniCounters?.aptidao).toBe(1));
    expect(useCharacterStore.getState().toggleAuraAptitude('u', 'aura_embacada').active).toBe(false); await esperar(5); expect(pegarFicha('u').omniCounters?.aptidao).toBe(1);
  });
});

describe('entrada em aura', () => {
  it('script dispara só para a aura cruzada e não repete enquanto dentro', () => {
    const e = novaEntidade('aura'); e.areaRaio = { tipo: 'fixo', valor: 3 };
    e.combatData = { critRange: 20, critMultiplier: 2, effects: [], effectsPassive: [efeito({ trigger: 'entrar_aura', formula: '2', type: 'ADICIONAR', target: 'ALVO', resourcePath: 'pe' })] };
    const outra = { ...e, id: crypto.randomUUID(), areaRaio: { tipo: 'fixo' as const, valor: 1 } };
    vincular('u', e); vincular('u', outra); useCharacterStore.getState().updateCharacter('a', { peCurrent: 5 });
    useOmniSpatialStore.setState({ posicoes: { u: { x: 0, y: 0 }, a: { x: 10, y: 0 } } }); recalcularAuras();
    useOmniSpatialStore.getState().mover('a', 2, 0); expect(pegarFicha('a').peCurrent).toBe(7);
    recalcularAuras(); expect(pegarFicha('a').peCurrent).toBe(7);
  });
});

// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { emitirEvento } from '@/lib/omni/eventBus';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';
import { cooldownDoItem } from '@/lib/omni/consultasRuntime';

const ler = (key: string, id = 'a') => avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(pegarFicha(id))).valor;
beforeEach(() => {
  useInventoryStore.setState({ items: {} });
  useOmniRuntimeStore.setState({ efeitos: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  useChronosStore.setState({ year: 1, month: 1, day: 1, hours: 0, minutes: 0, seconds: 0 });
  montarMesa([
    ficha('a', { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, activeBuffs: [], actionsCurrent: 1, bonusActionsCurrent: 1 }),
    ficha('b', { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0 }),
  ], { a: [0, 0], b: [1, 0] });
});
afterEach(limparMesa);

describe('efeitos: pilhas, origem, duração e expiração', () => {
  it('consulta instâncias reais sem incluir efeitos de outra ficha ou expirados', () => {
    const ent = { ...novaEntidade('condicao', 'Marca'), id: 'marca', duracao: { tipo: 'turnos' as const, valor: { tipo: 'fixo' as const, valor: 2 } } };
    const rt = useOmniRuntimeStore.getState();
    rt.aplicarEfeito(ent, { sourceCharId: 'a', targetCharId: 'a' });
    rt.aplicarEfeito(ent, { sourceCharId: 'b', targetCharId: 'a', duracaoValor: 1 });
    rt.aplicarEfeito(ent, { sourceCharId: 'a', targetCharId: 'b' });
    expect(ler('qtd_efeitos_ativos')).toBe(2);
    expect(ler('efeito_pilhas_marca')).toBe(2);
    expect(ler('efeito_duracao_marca')).toBe(12);
    useChronosStore.setState({ seconds: 6 });
    expect(ler('efeito_pilhas_marca')).toBe(1);
    expect(ler('efeito_duracao_marca')).toBe(6);
    useChronosStore.setState({ seconds: 12 });
    expect(ler('qtd_efeitos_ativos')).toBe(0);
    expect(ler('efeito_pilhas_marca')).toBe(0);
    expect(ler('efeito_duracao_marca')).toBe(0);
  });
  it('gatilho lê EFEITO.* e preserva origem por grupo', () => {
    const ent = { ...novaEntidade('condicao', 'Marca'), id: 'marca', duracao: { tipo: 'turnos' as const, valor: { tipo: 'fixo' as const, valor: 2 } } };
    const formulas = { pilhas: '@EFEITO.pilhas', minhas: '@EFEITO.pilhas_do_usuario', origem: '@EFEITO.aplicado_por_usuario', duracao: '@EFEITO.duracao_restante', permanente: '@EFEITO.permanente' };
    ent.gatilhos = [{ id: 'g', evento: 'noInicioDoTurno', blocos: [{ id: 'b', modo: 'todas', condicoes: [], acoes: Object.entries(formulas).map(([key, expressao]) => ({ id: key, acao: 'DEFINIR_CONTADOR' as const, alvoAplicacao: 'USUARIO' as const, caminhoAlvo: key, valor: { tipo: 'formula' as const, expressao } })) }] }];
    useOmniEntidadesStore.setState({ entidades: { marca: ent } });
    useOmniRuntimeStore.getState().aplicarEfeito(ent, { sourceCharId: 'a', targetCharId: 'a' });
    useOmniRuntimeStore.getState().aplicarEfeito(ent, { sourceCharId: 'b', targetCharId: 'a' });
    emitirEvento('noInicioDoTurno', { usuarioId: 'a' });
    expect(pegarFicha('a').omniCounters).toMatchObject({ pilhas: 2, minhas: 1, origem: 1, duracao: 12, permanente: 0 });
  });
  it('permanente usa -1; dissipar remove imediatamente das consultas', () => {
    const ent = { ...novaEntidade('passiva', 'Marca'), id: 'marca', duracao: { tipo: 'permanente' as const } };
    useOmniRuntimeStore.getState().aplicarEfeito(ent, { targetCharId: 'a' });
    expect(ler('efeito_duracao_marca')).toBe(-1);
    useOmniRuntimeStore.getState().dissiparTodos('a');
    expect(ler('efeito_pilhas_marca')).toBe(0);
  });
});

describe('cooldown real por ação/ficha', () => {
  const cfg: AcaoAtivaConfig = { id: 'corte', nome: 'Corte', acao: 'livre', custoPE: '2', alcanceM: 0, teste: 'nenhum', dano: '5', cooldownTurnos: 2 };
  it('aplica, bloqueia repetição sem gastar, decrementa e libera após dois turnos', async () => {
    expect((await executarAcaoAtiva('a', cfg, 'b')).ok).toBe(true);
    expect(ler('cooldown_corte')).toBe(2);
    expect(cooldownDoItem([cfg], pegarFicha('a').cooldowns)).toBe(2);
    const pe = pegarFicha('a').peCurrent;
    const hp = pegarFicha('b').hpCurrent;
    expect((await executarAcaoAtiva('a', cfg, 'b')).ok).toBe(false);
    expect(pegarFicha('a').peCurrent).toBe(pe);
    expect(pegarFicha('b').hpCurrent).toBe(hp);
    useCharacterStore.getState().tickBuffs('a');
    expect(ler('cooldown_corte')).toBe(1);
    useCharacterStore.getState().tickBuffs('a');
    expect(ler('cooldown_corte')).toBe(0);
    expect((await executarAcaoAtiva('a', cfg, 'b')).ok).toBe(true);
  });
  it('consulta cooldown nativo de feitiço com ID normalizado e isolado por ficha', () => {
    useCharacterStore.getState().updateCharacter('a', { cooldowns: { 'tecnica-maxima': 3 } });
    expect(ler('cooldown_tecnica_maxima')).toBe(3);
    expect(ler('cooldown_tecnica_maxima', 'b')).toBe(0);
  });
  it('script equipado usa ITEM.cooldown_restante mesmo sem cargas limitadas', () => {
    const ent = novaEntidade('item', 'Corte');
    ent.acoesAtivas = [cfg];
    ent.combatData = { critRange: 20, critMultiplier: 2, effects: [], effectsActive: [{ id: 'cd', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'contador_espera', formula: '@ITEM.cooldown_restante', trigger: 'noInicioDoTurno' }] };
    const inst = useInventoryStore.getState().add('a', ent);
    useInventoryStore.getState().equipItem(inst.instanceId, 'colar');
    useCharacterStore.getState().updateCharacter('a', { cooldowns: { 'omni:corte': 2 } });
    emitirEvento('noInicioDoTurno', { usuarioId: 'a' });
    expect(pegarFicha('a').omniCounters?.espera).toBe(2);
  });
});

describe('usos de habilidade vêm do catálogo e consumo real', () => {
  it('consulta restante/máximo e acompanha reset de descanso', () => {
    useCharacterStore.getState().updateCharacter('a', { level: 4, chosenSpecAbilities: [{ abilityId: 'lut-puxar-um-ar', chosenAtLevel: 2 }], specAbilityUsage: { 'lut-puxar-um-ar': 1 } });
    expect(ler('usos_habilidade_max_lut_puxar_um_ar')).toBe(2);
    expect(ler('usos_habilidade_lut_puxar_um_ar')).toBe(1);
    useCharacterStore.getState().resetSpecAbilityUsage('a', 'rest_long');
    expect(ler('usos_habilidade_lut_puxar_um_ar')).toBe(2);
  });
});

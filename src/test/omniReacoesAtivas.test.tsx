// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { abrirJanelaReacaoAtiva, ofertasReacaoAtiva, useReacoesAtivasStore, responderReacaoAtiva, cancelarJanelasReacoesAtivas } from '@/lib/omni/reacoesAtivas';
import { ReacoesAtivasOverlay } from '@/components/omni/ReacoesAtivasOverlay';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { PendingMoveOverlay } from '@/components/mapa/ui/PendingMoveOverlay';
import { SpellApplyDialog } from '@/components/fichas/SpellApplyDialog';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { buildAttackContext, rollAttack } from '@/lib/combatEngine';
import { findWeaponByName } from '@/lib/weapons';
import { novaEntidade, type AcaoAtivaConfig, type EntidadeOmni, type ReacaoAtivaConfig } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import type { Spell } from '@/types';
const config = (r: Partial<ReacaoAtivaConfig> = {}, p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id: 'r', nome: 'Responder', acao: 'reacao', custoPE: '2', alcanceM: 0, teste: 'nenhum', tipo_alvo: 'unico', reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 6, protegido: 'usuario', alvo: 'origem', ...r }, ...p });
const add = (c = config(), owner = 'u') => useInventoryStore.getState().add(owner, { ...novaEntidade('item'), acoesAtivas: [c] });
const evento = { gatilho: 'quando_alvo_declarar_ataque' as const, origemId: 'a', protegidoId: 'u' };
const ataque = () => rollAttack(buildAttackContext({ attacker: pegarFicha('a'), weapon: findWeaponByName('Espada Curta')!, targetDefense: 10, targetId: 'u' }));
beforeEach(() => {
  comoTela({ profileId: null, role: 'MASTER' });
  useInventoryStore.setState({ items: {} }); useReactionStore.setState({ reactionsUsedByChar: {}, prompts: [] });
  montarMesa([ficha('u', { hpCurrent: 50, hpMax: 50, escCurrent: 0, rd: 0, actionsCurrent: 1, reactionsCurrent: 1 }), ficha('a', { category: 'INIMIGO', hpCurrent: 50, hpMax: 50, escCurrent: 0, rd: 0, actionsCurrent: 1, reactionsCurrent: 1, attributes: [], activeBuffs: [], spells: [], mainHandWeaponName: 'Espada Curta', trainingBonus: 0 }), ficha('b', { hpCurrent: 50, hpMax: 50, escCurrent: 0 })], { u: [0, 0], a: [2, 0], b: [1, 1] });
  useMapStore.setState({ pendingMove: null, walls: [], initiative: { ...useMapStore.getState().initiative, entries: [] } });
  useCombatStore.setState({ inCombat: true, movementUsedByChar: {}, initiativeOrder: [], currentTurnIndex: 0 });
});
afterEach(async () => { cancelarJanelasReacoesAtivas(); cleanup(); await import('@/lib/omni/eventBus'); await import('@/lib/omni/observadores'); await esperar(); useCombatStore.setState({ inCombat: false }); limparMesa(); });

describe('janelas de reação', () => {
  it('pausa o ataque antes do d20 e passar retoma sem cobrar reação', async () => {
    add(); render(<ReacoesAtivasOverlay />); forcarDados(12, 3);
    let finalizou = false; const promessa = ataque().then(r => { finalizou = true; return r; }); await esperar();
    expect(finalizou).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20);
    fireEvent.click(screen.getByText('Passar e continuar')); const r = await promessa; expect(r.attackRolls).toEqual([12]); expect(pegarFicha('u').reactionsCurrent).toBe(1);
  });
  it('defesa se aplica antes do dado, cobra uma vez e não vaza para outro ataque', async () => {
    add(config({ defesa_bonus: 5 })); render(<ReacoesAtivasOverlay />); forcarDados(12, 3);
    const p = ataque(); fireEvent.click(await screen.findByText('u: Responder')); const r = await p; expect(r.hit).toBe(false); expect(pegarFicha('u').peCurrent).toBe(18); expect(pegarFicha('u').reactionsCurrent).toBe(0); expect(useReactionStore.getState().hasReactionAvailable('u')).toBe(false);
    forcarDados(12, 3); expect((await ataque()).hit).toBe(true);
  });
  it('cancelamento impede qualquer d20 e dano do ataque', async () => {
    add(config({ cancelar_evento: true })); render(<ReacoesAtivasOverlay />); const p = ataque(); fireEvent.click(await screen.findByText('u: Responder')); const r = await p;
    expect(r.cancelled).toBe(true); expect(r.attackRolls).toEqual([]); expect(r.damageTotal).toBe(0);
  });
  it('reposicionamento da reação revalida o alcance antes de rolar', async () => {
    add(config({}, { efeitos: [{ tipo: 'empurrar', metros: 6 }] })); render(<ReacoesAtivasOverlay />);
    const p = ataque(); fireEvent.click(await screen.findByText('u: Responder')); const r = await p; expect(r.cancelled).toBe(true); expect(r.attackRolls).toEqual([]);
  });
  it('revalida recursos após abrir a janela e permite continuar após erro', async () => {
    add(); render(<ReacoesAtivasOverlay />); const p = abrirJanelaReacaoAtiva(evento); useCharacterStore.getState().updateCharacter('u', { peCurrent: 0 }); fireEvent.click(await screen.findByText('u: Responder'));
    await screen.findByRole('alert'); expect(pegarFicha('u').reactionsCurrent).toBe(1); fireEvent.click(screen.getByText('Passar e continuar')); expect((await p).cancelado).toBe(false);
  });
  it('item removido não executa uma reação obsoleta', async () => {
    const item = add(); const p = abrirJanelaReacaoAtiva(evento); const j = useReacoesAtivasStore.getState().janelas[0]; useInventoryStore.getState().remove(item.instanceId); await responderReacaoAtiva(j.id, j.ofertas[0].id); expect(pegarFicha('u').peCurrent).toBe(20); await responderReacaoAtiva(j.id); await p;
  });
  it('duplo clique paga uma única reação', async () => {
    add(); const p = abrirJanelaReacaoAtiva(evento); const j = useReacoesAtivasStore.getState().janelas[0]; await Promise.all([responderReacaoAtiva(j.id, j.ofertas[0].id), responderReacaoAtiva(j.id, j.ofertas[0].id)]); await p; expect(pegarFicha('u').peCurrent).toBe(18);
  });
  it('proteção de aliado usa o alcance até o protegido', () => {
    add(config({ protegido: 'aliados' })); expect(ofertasReacaoAtiva({ ...evento, protegidoId: 'b' })).toHaveLength(1);
    useMapStore.getState().updateEntity('e-b', { x: 1400 }); expect(ofertasReacaoAtiva({ ...evento, protegidoId: 'b' })).toHaveLength(0);
  });
  it('ausência de peça, personagem incapacitado ou reação já usada não oferecem', () => {
    add(); useReactionStore.getState().consumeReaction('u'); expect(ofertasReacaoAtiva(evento)).toHaveLength(0);
    useReactionStore.getState().resetRoundReactions(); useCharacterStore.getState().updateCharacter('u', { hpCurrent: 0 }); expect(ofertasReacaoAtiva(evento)).toHaveLength(0);
    useCharacterStore.getState().updateCharacter('u', { hpCurrent: 50 }); useMapStore.setState({ entities: {} }); expect(ofertasReacaoAtiva(evento)).toHaveLength(0);
  });
  it('contra-ataque após erro causa dano e não abre uma cadeia recursiva', async () => {
    useCharacterStore.getState().updateCharacter('u', { mainHandWeaponName: 'Espada Curta', attributes: [], trainingBonus: 0 });
    add(config({ gatilho: 'quando_ataque_errar' }, { dano: '4', teste: 'ataque' })); add(config({}, { id: 'outro', nome: 'Outra' }), 'a'); render(<ReacoesAtivasOverlay />); forcarDados(1, 19, 3, 3);
    const p = ataque(); fireEvent.click(await screen.findByText('u: Responder')); expect((await p).hit).toBe(false); expect(pegarFicha('a').hpCurrent).toBe(46); expect(useReacoesAtivasStore.getState().janelas).toEqual([]);
  });
  it('falha no TR da reação é necessária para cancelar o evento', async () => {
    add(config({ cancelar_evento: true }, { teste: 'tr', tr: 'fortitude', cd: '1' })); render(<ReacoesAtivasOverlay />); forcarDados(20, 12, 3);
    const p = ataque(); fireEvent.click(await screen.findByText('u: Responder')); expect((await p).cancelled).not.toBe(true); expect(pegarFicha('u').peCurrent).toBe(18);
  });
});

describe('movimento e conjuração', () => {
  it.each(['quando_inimigo_entrar_alcance', 'quando_inimigo_sair_alcance'] as const)('%s interrompe confirmação e reverte a prévia', async gatilho => {
    add(config({ gatilho, alcance_m: 3, cancelar_evento: true })); const entrando = gatilho === 'quando_inimigo_entrar_alcance';
    const startX = entrando ? 700 : 140, endX = entrando ? 140 : 700;
    useMapStore.getState().updateEntity('e-a', { x: endX }); useMapStore.getState().setPendingMove({ entityId: 'e-a', charId: 'a', startX, startY: 0, distM: 12, trail: [] });
    render(<><PendingMoveOverlay /><ReacoesAtivasOverlay /></>); fireEvent.click(screen.getByTitle('Confirmar movimento')); await screen.findByText('u: Responder'); expect(useCombatStore.getState().movementUsedByChar.a ?? 0).toBe(0);
    fireEvent.click(screen.getByText('u: Responder')); await waitFor(() => expect(useMapStore.getState().pendingMove).toBeNull()); expect(useMapStore.getState().entities['e-a'].x).toBe(startX); expect(useCombatStore.getState().movementUsedByChar.a ?? 0).toBe(0);
  });
  it('movimento que permanece no alcance e desengajar não oferecem saída', () => {
    add(config({ gatilho: 'quando_inimigo_sair_alcance', alcance_m: 3 })); const e = { gatilho: 'quando_inimigo_sair_alcance' as const, origemId: 'a', movimento: { de: { x: 70, y: 0 }, para: { x: 140, y: 0 } } }; expect(ofertasReacaoAtiva(e)).toHaveLength(0);
    useCharacterStore.getState().updateCharacter('a', { desengajado: true }); expect(ofertasReacaoAtiva({ ...e, movimento: { ...e.movimento, para: { x: 700, y: 0 } } })).toHaveLength(0);
  });
  it('conjuração OMNI pode ser interrompida antes de PE e efeitos', async () => {
    add(config({ gatilho: 'quando_inimigo_conjurar', cancelar_evento: true })); render(<ReacoesAtivasOverlay />);
    const p = executarAcaoAtiva('a', { id: 'magia', nome: 'Magia', acao: 'comum', custoPE: '5', alcanceM: 0, teste: 'nenhum', dano: '10' }, 'u', novaEntidade('feitico'));
    fireEvent.click(await screen.findByText('u: Responder')); expect((await p).ok).toBe(false); expect(pegarFicha('a').peCurrent).toBe(20); expect(pegarFicha('u').hpCurrent).toBe(50);
  });
  it('conjuração pela ficha pausa antes da tela de dados', async () => {
    add(config({ gatilho: 'quando_inimigo_conjurar', cancelar_evento: true })); const close = vi.fn(); const spell: Spell = { id: 'sp', name: 'Magia', costPE: 3, description: '', damageDice: '1d6', damageBonus: 0, fixedDamage: 0, damageType: 'DQ', spellType: 'damage', actionType: 'action', buffs: [], conditions: [], spellLevel: '1', durationRounds: 0, range: '9m', targetMode: 'single_atk', attackType: 'cursed' };
    render(<><SpellApplyDialog spell={spell} sourceCharId="a" initialTargetIds={['u']} onClose={close} /><ReacoesAtivasOverlay /></>);
    fireEvent.click(await screen.findByText('u: Responder')); await waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(pegarFicha('a').peCurrent).toBe(20); expect(screen.queryByRole('button', { name: /^Rolar$/ })).toBeNull();
  });
  it('encerrar janelas libera promessas como canceladas', async () => { add(); const p = abrirJanelaReacaoAtiva(evento); cancelarJanelasReacoesAtivas(); expect((await p).cancelado).toBe(true); });
  it('editor e JSON preservam gatilho, defesa e interrupção', () => {
    let salvo: EntidadeOmni; function Editor() { const [e, set] = useState<EntidadeOmni>({ ...novaEntidade('item'), acoesAtivas: [{ ...config(), reacao: undefined }] }); return <EditorAcoesAtivas ent={e} setEnt={n => { salvo = n; set(n); }} />; }
    render(<Editor />); fireEvent.click(screen.getByLabelText('Oferecer como reação automática')); fireEvent.change(screen.getByLabelText('Gatilho da reação'), { target: { value: 'quando_inimigo_conjurar' } }); fireEvent.click(screen.getByLabelText('Cancelar evento se a reação tiver efeito'));
    const p = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'Reações', geradoEm: 0, entidades: [salvo!] }); expect(p.entidades[0].acoesAtivas![0].reacao).toMatchObject({ gatilho: 'quando_inimigo_conjurar', cancelar_evento: true });
  });
});

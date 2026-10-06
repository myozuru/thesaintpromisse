import { DESTINATARIO_MESTRE, podeResponderReacao } from '@/lib/omni/destinatarioReacao';
// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { abrirJanelaReacaoAtiva, ofertasReacaoAtiva, receberRespostaRemota, receberSondagemRemota, useReacoesAtivasStore, responderReacaoAtiva, cancelarJanelasReacoesAtivas, PRAZO_SONDAGEM_REACAO_MS } from '@/lib/omni/reacoesAtivas';
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
afterEach(async () => { vi.unstubAllGlobals(); cancelarJanelasReacoesAtivas(); useReacoesAtivasStore.setState({ janelas: [], ofertasRemotas: [] }); cleanup(); await import('@/lib/omni/eventBus'); await import('@/lib/omni/observadores'); await esperar(); useCombatStore.setState({ inCombat: false }); limparMesa(); });

describe('janelas de reação', () => {
  it('preserva a barreira sem_recursao no contexto de um ataque adicional', () => {
    const context = buildAttackContext({ attacker: pegarFicha('u'), weapon: findWeaponByName('Espada Curta')!, targetDefense: 10, semRecursao: true });
    expect(context.semRecursao).toBe(true);
  });

  it('encaminha a oferta ao perfil dono e devolve a escolha à sessão de origem', async () => {
    vi.stubGlobal('__worldBus', {send: vi.fn()});
    useCharacterStore.getState().updateCharacter('u', { profileId: 'perfil-u' });
    const enviados: CustomEvent[] = [];
    const capturar = (e: Event) => enviados.push(e as CustomEvent);
    window.addEventListener('omni-reaction:send', capturar);
    const p = abrirJanelaReacaoAtiva(evento);
    expect(enviados[0].detail).toMatchObject({ tipo: 'sondar', perfilId: 'perfil-u' });
    const d = enviados[0].detail;
    add(); // inventário local apenas na sessão proprietária
    comoTela({ profileId: 'perfil-u', role: 'PLAYER' });
    receberSondagemRemota({ janelaId: d.janelaId, clienteOrigem: 'origem', perfilId: d.perfilId, evento: d.evento });
    render(<ReacoesAtivasOverlay />);
    fireEvent.click(screen.getByText('u: Responder'));
    await waitFor(() => expect(enviados.some(e => e.detail.tipo === 'resultado')).toBe(true));
    const resposta = enviados.find(e => e.detail.tipo === 'resultado')!.detail;
    await receberRespostaRemota({ tipo: 'resultado', janelaId: d.janelaId, perfilId: 'perfil-u', clienteOrigem: 'origem', resultado: resposta.resultado }, 'origem');
    window.removeEventListener('omni-reaction:send', capturar);
    expect(useReacoesAtivasStore.getState().ofertasRemotas).toHaveLength(0);
    expect(pegarFicha('u').peCurrent).toBe(18);
    expect((await p).cancelado).toBe(false);
  });

  it('arma guardada não oferece reação; empunhada oferece e soltar invalida a janela', async () => {
    const ent = { ...novaEntidade('arma'), nome: 'Lâmina Reativa', acoesAtivas: [config()] };
    useInventoryStore.getState().add('u', ent);
    expect(ofertasReacaoAtiva(evento)).toHaveLength(0);
    useCharacterStore.getState().updateCharacter('u', { mainHandWeaponName: ent.nome });
    expect(ofertasReacaoAtiva(evento)).toHaveLength(1);
    const p = abrirJanelaReacaoAtiva(evento), j = useReacoesAtivasStore.getState().janelas[0];
    useCharacterStore.getState().updateCharacter('u', { mainHandWeaponName: null });
    await responderReacaoAtiva(j.id, j.ofertas[0].id);
    expect(pegarFicha('u').peCurrent).toBe(20);
    expect(pegarFicha('u').reactionsCurrent).toBe(1);
    await responderReacaoAtiva(j.id); await p;
  });
  it('usa configuração atual do catálogo e recusa edição após a oferta', async () => {
    const item = add();
    const atual = { ...item.entity, acoesAtivas: [config({}, { nome: 'Reação Atual', custoPE: '3' })] };
    useOmniEntidadesStore.setState(s => ({ entidades: { ...s.entidades, [atual.id]: atual } }));
    expect(ofertasReacaoAtiva(evento)[0].cfg.nome).toBe('Reação Atual');
    const p = abrirJanelaReacaoAtiva(evento), j = useReacoesAtivasStore.getState().janelas[0];
    useOmniEntidadesStore.setState(s => ({ entidades: { ...s.entidades, [atual.id]: { ...atual, acoesAtivas: [] } } }));
    await responderReacaoAtiva(j.id, j.ofertas[0].id);
    expect(pegarFicha('u').peCurrent).toBe(20);
    await responderReacaoAtiva(j.id); await p;
  });
  it('pausa o ataque antes do d20 e passar retoma sem cobrar reação', async () => {
    add(); render(<ReacoesAtivasOverlay />); forcarDados(12, 3);
    let finalizou = false; const promessa = ataque().then(r => { finalizou = true; return r; }); await esperar();
    expect(finalizou).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20);
    fireEvent.click(screen.getByText('Passar e continuar')); const r = await promessa; expect(r.attackRolls).toEqual([12]); expect(pegarFicha('u').reactionsCurrent).toBe(1);
  });
  it('defesa se aplica antes do dado, cobra uma vez e não vaza para outro ataque', async () => {
    useCharacterStore.getState().updateCharacter('u', { reactionsCurrent: 2, reactionsMax: 2 });
    add(config({ defesa_bonus: 5 })); render(<ReacoesAtivasOverlay />); forcarDados(12, 3);
    const p = ataque(); fireEvent.click(await screen.findByText('u: Responder')); const r = await p; expect(r.hit).toBe(false); expect(pegarFicha('u').peCurrent).toBe(18); expect(pegarFicha('u').reactionsCurrent).toBe(1); expect(useReactionStore.getState().hasReactionAvailable('u')).toBe(true);
    useCharacterStore.getState().updateCharacter('u', { reactionsCurrent: 0 });
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
    useMapStore.getState().updateEntity('e-a', { x: useMapStore.getState().gridConfig.dpi });
    add(config({ gatilho: 'quando_ataque_errar' }, { dano: '4', teste: 'ataque' })); add(config({}, { id: 'outro', nome: 'Outra' }), 'a');
    expect(ofertasReacaoAtiva({ gatilho: 'quando_ataque_errar', origemId: 'a', protegidoId: 'u' })).toHaveLength(1);
    render(<ReacoesAtivasOverlay />); forcarDados(1, 19, 3, 3);
    const p = ataque();
    fireEvent.click(await screen.findByText('u: Responder'));
    expect((await p).hit).toBe(false); expect(pegarFicha('a').hpCurrent).toBe(46); expect(useReacoesAtivasStore.getState().janelas).toEqual([]);
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
  it('confirmação usa o trajeto curvo registrado, mesmo com extremos fora do alcance', async () => {
    add(config({ gatilho: 'quando_inimigo_entrar_alcance', alcance_m: 3, cancelar_evento: true }));
    useMapStore.getState().updateEntity('e-a', { x: 700, y: 350 });
    useMapStore.getState().setPendingMove({ entityId: 'e-a', charId: 'a', startX: 700, startY: -350, distM: 30, trail: [{x:700,y:-350},{x:140,y:0},{x:700,y:350}] });
    render(<><PendingMoveOverlay /><ReacoesAtivasOverlay /></>);
    fireEvent.click(screen.getByTitle('Confirmar movimento'));
    fireEvent.click(await screen.findByText('u: Responder'));
    await waitFor(() => expect(useMapStore.getState().pendingMove).toBeNull());
    expect(useMapStore.getState().entities['e-a'].y).toBe(-350);
    expect(useCombatStore.getState().movementUsedByChar.a ?? 0).toBe(0);
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


describe('controlador remoto e confirmação de entrega', () => {
  function mesaRemota() {
    vi.stubGlobal('__worldBus', {send: vi.fn()});
    montarMesa([ficha('u',{category:'PLAYER',profileId:'perfil-u',hpCurrent:50,hpMax:50}),ficha('a',{category:'INIMIGO',profileId:'perfil-antigo',peCurrent:20,actionsCurrent:1,reactionsCurrent:1,hpCurrent:50,hpMax:50})],{u:[0,0],a:[1,0]});
    comoTela({role:'PLAYER',profileId:'perfil-u'});
    return {gatilho:'quando_alvo_declarar_ataque' as const,origemId:'u',protegidoId:'a'};
  }
  it('envia reação de inimigo ao mestre e aplica sua escolha na origem', async () => {
    const ev=mesaRemota();
    add(config(), 'a');
    const enviados: CustomEvent[]=[];
    const onSend=(e:Event)=>enviados.push(e as CustomEvent);
    window.addEventListener('omni-reaction:send',onSend);
    try {
      const p=abrirJanelaReacaoAtiva(ev);
      const d=enviados.find(e=>e.detail.tipo==='sondar')!.detail;
      expect(d.perfilId).toBe(DESTINATARIO_MESTRE);
      expect(useReacoesAtivasStore.getState().janelas[0].ofertas).toHaveLength(0);
      expect(podeResponderReacao(DESTINATARIO_MESTRE)).toBe(false);
      comoTela({role:'MASTER',profileId:'perfil-mestre'});
      receberSondagemRemota({...d,clienteOrigem:'origem'});
      expect(enviados.some(e=>e.detail.tipo==='disponivel')).toBe(true);
      await receberRespostaRemota({tipo:'disponivel',janelaId:d.janelaId,perfilId:d.perfilId,clienteOrigem:'origem'},'origem');
      render(<ReacoesAtivasOverlay />);
      fireEvent.click(screen.getByText('a: Responder'));
      await waitFor(()=>expect(enviados.some(e=>e.detail.tipo==='resultado')).toBe(true));
      const resposta=enviados.find(e=>e.detail.tipo==='resultado')!.detail;
      comoTela({role:'PLAYER',profileId:'perfil-u'});
      await receberRespostaRemota(resposta,'origem');
      expect((await p).cancelado).toBe(false);
      expect(pegarFicha('a').peCurrent).toBe(18);
      expect(useReacoesAtivasStore.getState().janelas).toHaveLength(0);
    } finally { window.removeEventListener('omni-reaction:send',onSend); }
  });
  it('mostra feitiços de reação das fichas do Mestre mesmo sem gatilho OMNI configurado', async () => {
    const ev = mesaRemota();
    const spell: Spell = { id: 'reac-sp', name: 'Barreira Arcana', costPE: 2, description: '', damageDice: '', damageBonus: 0, fixedDamage: 0, damageType: 'DQ', spellType: 'buff', actionType: 'reaction', buffs: [], conditions: [], spellLevel: '1', durationRounds: 0, range: 'Toque' };
    useCharacterStore.getState().updateCharacter('a', { spells: [spell] });
    const enviados: CustomEvent[] = [];
    const onSend = (e: Event) => enviados.push(e as CustomEvent);
    window.addEventListener('omni-reaction:send', onSend);
    try {
      const p = abrirJanelaReacaoAtiva(ev);
      const sondagem = enviados.find(e => e.detail.tipo === 'sondar')!.detail;
      comoTela({ role: 'MASTER', profileId: 'perfil-mestre' });
      receberSondagemRemota({ ...sondagem, clienteOrigem: 'origem' });
      expect(enviados.some(e => e.detail.tipo === 'disponivel')).toBe(true);
      render(<ReacoesAtivasOverlay />);
      fireEvent.click(screen.getAllByRole('button', { name: /Barreira Arcana/ })[1]);
      await waitFor(() => expect(enviados.some(e => e.detail.tipo === 'processando')).toBe(true));
      await waitFor(() => expect(enviados.some(e => e.detail.tipo === 'passar')).toBe(true));
      const passou = enviados.find(e => e.detail.tipo === 'passar')!.detail;
      await receberRespostaRemota({ tipo: 'passar', janelaId: sondagem.janelaId, perfilId: sondagem.perfilId, clienteOrigem: 'origem' }, 'origem');
      expect(await p).toEqual({ cancelado: false, defesaBonus: 0, testeBonus: 0 });
      expect(passou.perfilId).toBe(DESTINATARIO_MESTRE);
      expect(pegarFicha('a').peCurrent).toBe(18);
    } finally { window.removeEventListener('omni-reaction:send', onSend); }
  });
  it('destinatário que não confirma não deixa promessa presa', async () => {
    const ev=mesaRemota();vi.useFakeTimers();
    try {
      const p=abrirJanelaReacaoAtiva(ev);
      await vi.advanceTimersByTimeAsync(PRAZO_SONDAGEM_REACAO_MS);
      expect(await p).toEqual({cancelado:false,defesaBonus:0,testeBonus:0});
      expect(useReacoesAtivasStore.getState().janelas).toHaveLength(0);
    } finally {vi.useRealTimers();}
  });
  it('pausa o cronômetro durante a janela e retoma após 12 segundos sem resposta', async () => {
    const ev=mesaRemota();vi.useFakeTimers();
    useCombatStore.setState({ turnTimerEnabled: true, turnDurationSec: 60, turnRemainingAtStart: 42, turnStartedAt: Date.now() - 5000, turnPaused: false, reactionPauseIds: [] });
    try {
      const p=abrirJanelaReacaoAtiva(ev);
      expect(useCombatStore.getState().reactionPauseIds).toHaveLength(1);
      const remaining=useCombatStore.getState().getTurnRemaining();
      await vi.advanceTimersByTimeAsync(PRAZO_SONDAGEM_REACAO_MS);
      expect(await p).toEqual({cancelado:false,defesaBonus:0,testeBonus:0});
      expect(useCombatStore.getState().reactionPauseIds).toHaveLength(0);
      expect(useCombatStore.getState().getTurnRemaining()).toBeCloseTo(remaining);
    } finally {vi.useRealTimers();}
  });
  it('confirmação mantém a janela ativa; continuar libera uma sessão que parou de responder', async () => {
    const ev=mesaRemota();vi.useFakeTimers();
    try {
      const p=abrirJanelaReacaoAtiva(ev);
      const j=useReacoesAtivasStore.getState().janelas[0];
      await receberRespostaRemota({tipo:'disponivel',janelaId:j.id,perfilId:DESTINATARIO_MESTRE,clienteOrigem:'origem'},'origem');
      await vi.advanceTimersByTimeAsync(PRAZO_SONDAGEM_REACAO_MS / 2);
      expect(useReacoesAtivasStore.getState().janelas).toHaveLength(1);
      render(<ReacoesAtivasOverlay />);
      fireEvent.click(screen.getByText('Passar e continuar'));
      expect((await p).cancelado).toBe(false);
      expect(pegarFicha('a').peCurrent).toBe(20);
    } finally {vi.useRealTimers();}
  });
  it('outro jogador não recebe nem executa reação destinada ao mestre', () => {
    const ev=mesaRemota();add(config(),'a');
    receberSondagemRemota({janelaId:'j',perfilId:DESTINATARIO_MESTRE,clienteOrigem:'origem',evento:ev});
    expect(useReacoesAtivasStore.getState().ofertasRemotas).toHaveLength(0);
  });
});

it('sem transporte multiplayer resolve sem aguardar controlador remoto', async()=>{
  comoTela({role:'PLAYER',profileId:'perfil-u'});
  useCharacterStore.getState().updateCharacter('u',{profileId:'perfil-u'});
  const p=abrirJanelaReacaoAtiva({gatilho:'quando_alvo_declarar_ataque',origemId:'u',protegidoId:'a'});
  expect(await p).toEqual({cancelado:false,defesaBonus:0,testeBonus:0});
  expect(useReacoesAtivasStore.getState().janelas).toHaveLength(0);
});

it('resposta remota durante a reação local não deixa janela vazia presa', async()=>{
  vi.stubGlobal('__worldBus',{send:vi.fn()});
  useCharacterStore.getState().updateCharacter('b',{profileId:'perfil-b'});
  add();
  const mod=await import('@/lib/omni/acaoAtiva');
  let liberar!: (r: Awaited<ReturnType<typeof mod.executarAcaoAtiva>>) => void;
  const spy=vi.spyOn(mod,'executarAcaoAtiva').mockImplementation(()=>new Promise(resolve=>{liberar=resolve;}));
  try {
    const p=abrirJanelaReacaoAtiva(evento), j=useReacoesAtivasStore.getState().janelas[0];
    const local=responderReacaoAtiva(j.id,j.ofertas[0].id);
    await waitFor(()=>expect(spy).toHaveBeenCalled());
    await receberRespostaRemota({tipo:'resultado',janelaId:j.id,perfilId:'perfil-b',clienteOrigem:'origem',resultado:{cancelado:false,defesaBonus:3,testeBonus:0}},'origem');
    liberar({ok:true,efeitoAplicado:false,dano:0,detalhe:''} as Awaited<ReturnType<typeof mod.executarAcaoAtiva>>);
    await local;
    expect(await p).toEqual({cancelado:false,defesaBonus:3,testeBonus:0});
    expect(useReacoesAtivasStore.getState().janelas).toHaveLength(0);
  } finally {spy.mockRestore();}
});

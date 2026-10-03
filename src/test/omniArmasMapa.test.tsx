// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, comoTela } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { acoesAtivasDe } from '@/lib/omni/acaoAtiva';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { AlvoMapaOverlay } from '@/components/mapa/ui/AlvoMapaOverlay';
import { useAlvoMapaStore, alvosNoAlcance, clicarAlvoMapa, terminarAlvoMapa, pedirAlvoMapa } from '@/stores/useAlvoMapaStore';
import { soltarItemNoChao, recolherItemDoChao } from '@/lib/omni/itensNoChao';
import { useCombatStore } from '@/stores/useCombatStore';
import { useItemStore } from '@/stores/useItemStore';
import { omniToItem } from '@/lib/omni/syncItemBank';
const config: AcaoAtivaConfig = { id: 'corte', nome: 'Corte', acao: 'livre', custoPE: '0', teste: 'nenhum', tipo_alvo: 'unico', alcanceM: 3, efeitos: [], custo_recursos: { usos_item: 1 } };
const arma = () => ({ ...novaEntidade('arma'), nome: 'Katana', tags: ['modelo:katana', 'mao:2'], usos: { total: 4, recarga: 'diaria' as const }, acoesAtivas: [config] });
beforeEach(() => {
  useInventoryStore.setState({ items: {}, deleted: {} }); useOmniEntidadesStore.setState({ entidades: {} });
  useCombatStore.setState({ inCombat: false });
  comoTela({ profileId: 'p', role: 'PLAYER' });
  montarMesa([ficha('u', { profileId: 'p', hpCurrent: 20, hpMax: 20 }), ficha('perto', { category: 'INIMIGO', hpCurrent: 20, hpMax: 20 }), ficha('longe', { category: 'INIMIGO' })], { u: [0, 0], perto: [2, 0], longe: [5, 0] });
});
afterEach(() => { cleanup(); terminarAlvoMapa(null); });
describe('armas, mira e chão', () => {
  it('ações só aparecem enquanto a arma estiver nas mãos', () => {
    useInventoryStore.getState().add('u', arma());
    expect(acoesAtivasDe('u')).toHaveLength(0);
    useCharacterStore.getState().equipWeapons('u', { mainHandName: 'Katana' });
    expect(acoesAtivasDe('u')).toHaveLength(1);
    useCharacterStore.getState().equipWeapons('u', { mainHandName: null });
    expect(acoesAtivasDe('u')).toHaveLength(0);
  });
  it('duas mãos configuradas no OMNI ocupam ambas e aparecem nos dois cards', () => {
    useInventoryStore.getState().add('u', arma());
    expect(useCharacterStore.getState().equipWeapons('u', { mainHandName: 'Katana' }).ok).toBe(true);
    const u = useCharacterStore.getState().characters[0];
    expect(u.mainHandWeaponName).toBe('Katana'); expect(u.offHandWeaponName).toBe('Katana');
    render(<AttackPanel character={u} />);
    expect(screen.getAllByText('🤲 Katana · duas mãos')).toHaveLength(2);
  });
  it('o botão abre o alcance, recusa o distante e só consome usos após escolher o próximo', async () => {
    const inst = useInventoryStore.getState().add('u', arma());
    useCharacterStore.getState().equipWeapons('u', { mainHandName: 'Katana' });
    render(<><AcoesAtivasSection charId="u" /><AlvoMapaOverlay /></>);
    expect(screen.queryByLabelText('Alvo de Corte')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    expect(useAlvoMapaStore.getState().pending?.maxRangeMeters).toBe(3);
    expect(alvosNoAlcance(useAlvoMapaStore.getState().pending!).map(c => c.id)).toEqual(['perto']);
    expect(useInventoryStore.getState().items[inst.instanceId].usosRestantes).toBe(4);
    act(() => clicarAlvoMapa('e-longe'));
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'perto' }));
    await waitFor(() => expect(useInventoryStore.getState().items[inst.instanceId].usosRestantes).toBe(3));
  });
  it('revalida movimento e limite de múltiplos, cancelando sem gastar', async () => {
    const p = pedirAlvoMapa({ usuarioId: 'u', label: 'Dois', maxRangeMeters: 3, maxAlvos: 2 });
    expect(alvosNoAlcance(useAlvoMapaStore.getState().pending!)).toHaveLength(1);
    useMapStore.getState().updateEntity('e-perto', { x: 700 });
    expect(alvosNoAlcance(useAlvoMapaStore.getState().pending!)).toHaveLength(0);
    terminarAlvoMapa(null); expect(await p).toBeNull();
  });
  it('solta a arma das duas mãos na cena e recolhe mantendo usos e fórmulas', () => {
    const inst = useInventoryStore.getState().add('u', arma());
    useInventoryStore.getState().consumirUso(inst.instanceId, 2);
    useCharacterStore.getState().equipWeapons('u', { mainHandName: 'Katana' });
    const id = soltarItemNoChao('u', inst.instanceId);
    expect(useInventoryStore.getState().items[inst.instanceId]).toBeUndefined();
    expect(useInventoryStore.getState().deleted[inst.instanceId]).toBeTruthy();
    expect(useCharacterStore.getState().characters[0].mainHandWeaponName).toBeNull();
    expect(useCharacterStore.getState().characters[0].offHandWeaponName).toBeNull();
    expect(useMapStore.getState().entities[id].groundItem).toBeTruthy();
    const groundAntes = useMapStore.getState().entities[id];
    recolherItemDoChao('u', id);
    const nova = useInventoryStore.getState().listByOwner('u')[0];
    expect(nova.usosRestantes).toBe(2); expect(nova.entity.acoesAtivas).toEqual([config]);
    expect(nova.isEquipped).toBeFalsy(); expect(useMapStore.getState().entities[id]).toBeUndefined();
    expect(() => recolherItemDoChao('u', id)).toThrow();
    useMapStore.getState().addEntity(groundAntes);
    expect(() => recolherItemDoChao('u', id)).toThrow('já foi recolhido');
  });
  it('sem token ou com outro dono, não remove o item; longe não permite recolher', () => {
    const inst = useInventoryStore.getState().add('u', arma());
    expect(() => soltarItemNoChao('perto', inst.instanceId)).toThrow();
    useMapStore.getState().removeEntities(['e-u']);
    expect(() => soltarItemNoChao('u', inst.instanceId)).toThrow();
    expect(useInventoryStore.getState().items[inst.instanceId]).toBeTruthy();
  });
  it('itens do inventário legado também podem ser soltos e recolhidos', () => {
    const item = { ...omniToItem(arma()), assignedTo: ['u'] };
    useItemStore.setState({ items: [item] });
    const id = soltarItemNoChao('u', item.id, true);
    expect(useItemStore.getState().items[0].assignedTo).toEqual([]);
    recolherItemDoChao('u', id);
    expect(useItemStore.getState().items[0].assignedTo).toEqual(['u']);
  });
});

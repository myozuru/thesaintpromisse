// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ficha, montarMesa, comoTela, pegarFicha } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useItemStore } from '@/stores/useItemStore';
import { novaEntidade } from '@/lib/omni/tipos';
import { applyWeaponModel } from '@/lib/omni/weaponModel';
import { findWeaponByName } from '@/lib/weapons';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { consumirTiro, recarregar, tirosRestantes } from '@/lib/recargaRapida';
import { soltarItemNoChao } from '@/lib/omni/itensNoChao';
import { omniToItem } from '@/lib/omni/syncItemBank';
import { planejarCustosAtivos, consumirMunicaoAtiva } from '@/lib/omni/custosAtivos';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';

const criarArma = (nome: string) => applyWeaponModel(novaEntidade('arma'), findWeaponByName(nome)!);

beforeEach(() => {
  useInventoryStore.setState({ items: {}, deleted: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  useItemStore.setState({ items: [] });
  comoTela({ profileId: 'p', role: 'PLAYER' });
  montarMesa([ficha('u', { profileId: 'p', actionsCurrent: 1, bonusActionsCurrent: 1, weaponAmmo: { Pistola: 5 } })], { u: [0, 0] });
});
afterEach(() => cleanup());

describe('identidade por cópia de arma', () => {
  it('lista e equipa duas armas de mesmo nome por IDs independentes', () => {
    const a = useInventoryStore.getState().add('u', criarArma('Adaga'));
    const b = useInventoryStore.getState().add('u', criarArma('Adaga'));
    render(<AttackPanel character={pegarFicha('u')} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: `omni:${a.instanceId}` } });
    fireEvent.change(selects[1], { target: { value: `omni:${b.instanceId}` } });
    const c = useCharacterStore.getState().characters[0];
    expect(c.mainHandWeaponInstanceId).toBe(a.instanceId);
    expect(c.offHandWeaponInstanceId).toBe(b.instanceId);
    expect(c.mainHandWeaponName).toBe('Adaga');
    expect(c.offHandWeaponName).toBe('Adaga');
  });

  it('cada cópia guarda e consome sua própria munição, migrando o total legado uma única vez', () => {
    const a = useInventoryStore.getState().add('u', criarArma('Pistola'));
    const b = useInventoryStore.getState().add('u', criarArma('Pistola'));
    expect(useCharacterStore.getState().equipWeapons('u', {
      mainHandName: 'Pistola', mainHandInstanceId: a.instanceId,
    }).ok).toBe(true);
    const c = pegarFicha('u');
    expect(tirosRestantes(c, 'Pistola', a.instanceId)).toBe(5);
    expect(tirosRestantes(c, 'Pistola', b.instanceId)).toBe(0);
    expect(consumirTiro('u', 'Pistola', a.instanceId)).toMatchObject({ ok: true, restante: 4 });
    expect(tirosRestantes(pegarFicha('u'), 'Pistola', b.instanceId)).toBe(0);
    expect(recarregar('u', 'Pistola', b.instanceId).ok).toBe(true);
    expect(tirosRestantes(pegarFicha('u'), 'Pistola', b.instanceId)).toBe(12);
    expect(tirosRestantes(pegarFicha('u'), 'Pistola', a.instanceId)).toBe(4);
  });

  it('ações ativas debitam munição da instância identificada no plano de custos', () => {
    const a = useInventoryStore.getState().add('u', criarArma('Pistola'));
    useInventoryStore.getState().definirMunicao(a.instanceId, 3);
    const cfg = {
      id: 'tiro-especial', nome: 'Tiro especial', acao: 'comum', custoPE: '0', teste: 'nenhum',
      tipo_alvo: 'unico', custo_recursos: { municao: 2 },
    } as AcaoAtivaConfig;
    const c = pegarFicha('u');
    const planejado = planejarCustosAtivos(cfg, c, 0, { armaNome: 'Pistola', armaInstanciaId: a.instanceId });
    expect(planejado.ok).toBe(true);
    if (!planejado.ok) return;
    expect(consumirMunicaoAtiva(planejado.plano)).toBe(true);
    expect(useInventoryStore.getState().items[a.instanceId].municaoRestante).toBe(1);
  });

  it('não confirma o custo de munição legado se a ficha desaparecer antes do débito', () => {
    const cfg = {
      id: 'tiro-especial', nome: 'Tiro especial', acao: 'comum', custoPE: '0', teste: 'nenhum',
      tipo_alvo: 'unico', custo_recursos: { municao: 1 },
    } as AcaoAtivaConfig;
    const planejado = planejarCustosAtivos(cfg, pegarFicha('u'), 0, { armaNome: 'Pistola' });
    expect(planejado.ok).toBe(true);
    if (!planejado.ok) return;
    useCharacterStore.setState({ characters: [] });
    expect(consumirMunicaoAtiva(planejado.plano)).toBe(false);
  });

  it('arma de duas mãos grava a mesma identidade nos dois espaços', () => {
    const a = useInventoryStore.getState().add('u', criarArma('Espada Grande'));
    expect(useCharacterStore.getState().equipWeapons('u', {
      mainHandName: 'Espada Grande', mainHandInstanceId: a.instanceId,
    }).ok).toBe(true);
    const c = useCharacterStore.getState().characters[0];
    expect(c.mainHandWeaponInstanceId).toBe(a.instanceId);
    expect(c.offHandWeaponInstanceId).toBe(a.instanceId);
  });

  it('store recusa a mesma cópia de uma arma de uma mão em ambos os espaços e cópias distintas de arma de duas mãos', () => {
    const dagger = useInventoryStore.getState().add('u', criarArma('Adaga'));
    expect(useCharacterStore.getState().equipWeapons('u', {
      mainHandName: 'Adaga', mainHandInstanceId: dagger.instanceId,
      offHandName: 'Adaga', offHandInstanceId: dagger.instanceId,
    }).ok).toBe(false);
    const greatA = useInventoryStore.getState().add('u', criarArma('Espada Grande'));
    const greatB = useInventoryStore.getState().add('u', criarArma('Espada Grande'));
    expect(useCharacterStore.getState().equipWeapons('u', {
      mainHandName: 'Espada Grande', mainHandInstanceId: greatA.instanceId,
      offHandName: 'Espada Grande', offHandInstanceId: greatB.instanceId,
    }).ok).toBe(false);
  });

  it('mantém IDs, munição e descarte independentes para cópias do inventário legado', () => {
    const itemA = { ...omniToItem(criarArma('Pistola')), id: 'pistola-a', assignedTo: ['u'] };
    const itemB = { ...omniToItem(criarArma('Pistola')), id: 'pistola-b', assignedTo: ['u'] };
    useItemStore.setState({ items: [itemA, itemB] });
    expect(useCharacterStore.getState().equipWeapons('u', {
      mainHandName: 'Pistola', mainHandInstanceId: 'legacy:pistola-a',
    }).ok).toBe(true);
    const c = pegarFicha('u');
    expect(tirosRestantes(c, 'Pistola', 'legacy:pistola-a')).toBe(5);
    expect(tirosRestantes(c, 'Pistola', 'legacy:pistola-b')).toBe(0);
    expect(consumirTiro('u', 'Pistola', 'legacy:pistola-a').restante).toBe(4);
    expect(tirosRestantes(pegarFicha('u'), 'Pistola', 'legacy:pistola-b')).toBe(0);
    soltarItemNoChao('u', 'pistola-a', true);
    const updated = useCharacterStore.getState().characters[0];
    expect(updated.mainHandWeaponInstanceId).toBeNull();
    expect(useItemStore.getState().items.some(i => i.id === 'pistola-b' && i.assignedTo.includes('u'))).toBe(true);
  });

  it('soltar uma cópia desocupa só a mão que a contém', () => {
    const a = useInventoryStore.getState().add('u', criarArma('Adaga'));
    const b = useInventoryStore.getState().add('u', criarArma('Adaga'));
    useCharacterStore.getState().equipWeapons('u', {
      mainHandName: 'Adaga', mainHandInstanceId: a.instanceId,
      offHandName: 'Adaga', offHandInstanceId: b.instanceId,
    });
    soltarItemNoChao('u', a.instanceId);
    const c = useCharacterStore.getState().characters[0];
    expect(c.mainHandWeaponInstanceId).toBeNull();
    expect(c.mainHandWeaponName).toBeNull();
    expect(c.offHandWeaponInstanceId).toBe(b.instanceId);
    expect(c.offHandWeaponName).toBe('Adaga');
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela } from './helpers/mesaReal';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { novaEntidade } from '@/lib/omni/tipos';
import { applyWeaponModel, getWeaponMeta } from '@/lib/omni/weaponModel';
import { findWeaponByName } from '@/lib/weapons';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { montarMensagemEquipar } from '@/lib/omni/omniBonusLabels';
import { effectiveMovement } from '@/lib/movementBudget';
const ler = (s: string) => avaliarFormula(s, montarVariaveisDoPersonagem(pegarFicha('u')));
beforeEach(() => {
  comoTela({ profileId: 'p', role: 'PLAYER' });
  useInventoryStore.setState({ items: {}, deleted: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  montarMesa([ficha('u', { profileId: 'p', hpCurrent: 20, hpMax: 40, movement: 9, slotsCurrent: 0, slotsMax: 5 })], { u: [0, 0] });
});
afterEach(() => { cleanup(); limparMesa(); });

it('equipar e guardar uma arma renomeada pelo painel atualiza as keys novas e antigas', () => {
  const ent = applyWeaponModel(novaEntidade('arma'), findWeaponByName('Adaga')!);
  ent.nome = 'Dente Lunar'; ent.combatData!.critRange = 17;
  useInventoryStore.getState().add('u', ent);
  const view = render(<AttackPanel character={pegarFicha('u')} />);
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: ent.nome } });
  expect(pegarFicha('u').mainHandWeaponName).toBe(ent.nome);
  expect(ler('quantidade itens equipados')).toMatchObject({ valor: 1, diagnosticos: [] });
  for (const key of ['arma_principal corpo_a_corpo', 'arma_principal leve', 'arma_principal grupo Faca', 'arma_principal_eh_cac', 'arma_principal_leve']) {
    expect(ler(key), key).toMatchObject({ valor: 1, diagnosticos: [] });
  }
  expect(ler('margem_critico arma_principal').valor).toBe(17);
  expect(ler('arma_principal_crit_range').valor).toBe(17);
  view.rerender(<AttackPanel character={pegarFicha('u')} />);
  fireEvent.click(screen.getByTitle('Guardar arma'));
  expect(ler('arma_principal corpo_a_corpo').valor).toBe(0);
  expect(ler('desarmado').valor).toBe(1);
  expect(ler('quantidade itens equipados').valor).toBe(0);
});

it('metadados preservam alcance fracionário e rejeitam um número incompleto', () => {
  const ent = { ...novaEntidade('arma'), tags: ['alcance:4.5/13.5'] };
  expect(getWeaponMeta(ent)).toMatchObject({ alcanceCurto: 4.5, alcanceLongo: 13.5 });
  expect(getWeaponMeta({ ...ent, tags: ['alcance:4xyz/13.5'] })).toMatchObject({ alcanceCurto: null, alcanceLongo: 13.5 });
});

it('arma renomeada usa os metadados atuais do catálogo ao consultar alcance e crítico', () => {
  const original = applyWeaponModel(novaEntidade('arma'), findWeaponByName('Arco Curto')!);
  original.nome = 'Arco da Aurora';
  useInventoryStore.getState().add('u', original);
  const fresco = { ...original, tags: [...original.tags.filter(t => !t.startsWith('alcance:')), 'alcance:4.5/13.5'], combatData: { ...original.combatData!, critRange: 16 } };
  useOmniEntidadesStore.setState({ entidades: { [fresco.id]: fresco } });
  const c = pegarFicha('u'); c.mainHandWeaponName = original.nome;
  expect(armaDoPersonagem('u', original.nome)).toMatchObject({ rangeShort: 4.5, rangeLong: 13.5, critRange: 16 });
  expect(ler('alcance arma_principal curto')).toMatchObject({valor: 4.5, diagnosticos: []});
  expect(ler('alcance arma_principal longo').valor).toBe(13.5);
});

it('alcance da arma estendida nas keys corresponde ao alcance usado pelo mapa', () => {
  pegarFicha('u').mainHandWeaponName = 'Lança';
  const w = findWeaponByName('Lança')!;
  expect(w.properties.some(p => p.kind === 'estendida')).toBe(true);
  expect(ler('alcance arma_principal').valor).toBe(3);
  expect(ler('arma_principal_alcance').valor).toBe(3);
});

it('deslocamento passivo altera movimento e não concede esquiva', () => {
  const ent = novaEntidade('item', 'Botas'); ent.slotType = 'pes';
  const parsed = parseOmniScript('somar 3 em usuario.deslocamento', { defaultTarget: 'USUARIO' });
  expect(parsed.erros).toEqual([]);
  ent.combatData = { effects: [], effectsPassive: parsed.efeitos, critRange: 20, critMultiplier: 2 };
  const inst = useInventoryStore.getState().add('u', ent);
  expect(useInventoryStore.getState().equipItem(inst.instanceId, 'pes')).toBe(true);
  const bag = selectOmniModifiers(pegarFicha('u'), useInventoryStore.getState().listEquipped('u'));
  expect(bag.deslocamento).toBe(3); expect(bag.totals.esc).toBe(0);
  expect(effectiveMovement(pegarFicha('u'), bag.deslocamento)).toBe(12);
  expect(montarMensagemEquipar(ent)).toContain('Deslocamento');
  expect(montarMensagemEquipar(ent)).not.toContain('Esquiva');
});

it('bônus condicionado respeita a condição e um gatilho não vira bônus permanente', () => {
  const ent = novaEntidade('item', 'Amuleto'); ent.slotType = 'cabeca';
  const parsed = parseOmniScript('se @USUARIO.vida < 30 entao somar 2 em usuario.defesa; @acertar -> somar 5 em usuario.defesa', { defaultTarget: 'USUARIO' });
  expect(parsed.erros).toEqual([]);
  ent.combatData = { effects: [], effectsPassive: parsed.efeitos, critRange: 20, critMultiplier: 2 };
  const ref = { instanceId: 'amuleto', equippedSlot: 'cabeca', entity: ent };
  expect(selectOmniModifiers(pegarFicha('u'), [ref]).totals.ca).toBe(2);
  const cheio = { ...pegarFicha('u'), hpCurrent: 40 };
  expect(selectOmniModifiers(cheio, [ref]).totals.ca).toBe(0);
  ent.combatData.effectsPassive![0].condition = '@USUARIO.key_inexistente == 0';
  expect(selectOmniModifiers(pegarFicha('u'), [ref]).totals.ca).toBe(0);
});

it('keys de uma arma sem modelo respeitam categoria espacial, grupo e propriedades declaradas', () => {
  const ent = { ...novaEntidade('arma'), nome: 'Arco Astral', tags: ['ranged', 'grupo:arco', 'prop:leve', 'alcance:4.5/13.5'] };
  useInventoryStore.getState().add('u', ent);
  pegarFicha('u').mainHandWeaponName = ent.nome;
  expect(ler('arma_principal distancia').valor).toBe(1);
  expect(ler('arma_principal grupo Arco').valor).toBe(1);
  expect(ler('arma_principal leve').valor).toBe(1);
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa } from './helpers/mesaReal';
import { agruparAcoesAtivas } from '@/lib/omni/agruparAcoesAtivas';
import { acoesAtivasDe } from '@/lib/omni/acaoAtiva';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';

const cfg: AcaoAtivaConfig = { id: 'corte', nome: 'Corte da vingança', acao: 'livre', custoPE: '0', alcanceM: 0, teste: 'nenhum', tipo_alvo: 'proprio', efeitos: [], custo_recursos: { usos_item: 1 } };
const katana = () => ({ ...novaEntidade('arma'), nome: 'Katana', acoesAtivas: [cfg], usos: { total: 3, recarga: 'diaria' as const } });
beforeEach(() => {
  useInventoryStore.setState({ items: {}, deleted: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  useCombatStore.setState({ inCombat: false });
  montarMesa([ficha('u', { hpCurrent: 20, hpMax: 20, mainHandWeaponName: 'Katana' })], {});
});
afterEach(cleanup);

it('inclui ações de entidades Omni vinculadas diretamente à ficha', () => {
  const ent = { ...novaEntidade('feitico'), nome: 'Invocar Espírito', acoesAtivas: [cfg] };
  useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
  useCharacterStore.getState().updateCharacter('u', {
    omniAtivos: [{
      id: 'vinculo-espirito',
      categoria: 'feitico',
      entidadeId: ent.id,
      instanceId: 'origem-vinculada',
      vinculadoEm: Date.now(),
    }],
  });
  const acoes = acoesAtivasDe('u');
  expect(acoes).toHaveLength(1);
  expect(acoes[0]).toMatchObject({ instanceId: 'origem-vinculada', ent: { id: ent.id }, cfg: { id: cfg.id } });
});

it('cinco exemplares produzem um card e a seleção consome somente o exemplar escolhido', async () => {
  const ent = katana();
  const copias = Array.from({ length: 5 }, () => useInventoryStore.getState().add('u', ent));
  render(<AcoesAtivasSection charId="u" />);
  expect(screen.getAllByTestId('acao-ativa-Corte da vingança')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Exemplar para Corte da vingança'), { target: { value: copias[3].instanceId } });
  fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
  await waitFor(() => expect(useInventoryStore.getState().items[copias[3].instanceId].usosRestantes).toBe(2));
  for (const copia of copias.filter((_, i) => i !== 3)) expect(useInventoryStore.getState().items[copia.instanceId].usosRestantes).toBe(3);
  expect(Object.keys(useInventoryStore.getState().items)).toHaveLength(5);
});

it('não funde ações diferentes nem armas diferentes com o mesmo nome', () => {
  const ent = katana();
  const outra = { ...katana(), acoesAtivas: [cfg] };
  useInventoryStore.getState().add('u', { ...ent, acoesAtivas: [cfg, { ...cfg, id: 'outro', custoPE: '2' }] });
  useInventoryStore.getState().add('u', outra);
  expect(agruparAcoesAtivas(acoesAtivasDe('u'))).toHaveLength(3);
});

it('consolida configurações idênticas duplicadas dentro da mesma arma', () => {
  const ent = { ...katana(), acoesAtivas: [cfg, { ...cfg, id: 'duplicada' }] };
  useInventoryStore.getState().add('u', ent);
  expect(agruparAcoesAtivas(acoesAtivasDe('u'))).toHaveLength(1);
  expect(agruparAcoesAtivas(acoesAtivasDe('u'))[0].exemplares).toHaveLength(1);
});

it('acompanha a edição do catálogo e prefere um exemplar equipado', () => {
  const ent = katana();
  useInventoryStore.getState().add('u', ent);
  const equipada = useInventoryStore.getState().add('u', ent);
  useInventoryStore.getState().equipItem(equipada.instanceId, 'principal');
  render(<AcoesAtivasSection charId="u" />);
  expect((screen.getByLabelText('Exemplar para Corte da vingança') as HTMLSelectElement).value).toBe(equipada.instanceId);
  act(() => useOmniEntidadesStore.setState({ entidades: { [ent.id]: { ...ent, acoesAtivas: [{ ...cfg, nome: 'Corte atualizado' }] } } }));
  expect(screen.queryByText('Corte da vingança')).toBeNull();
  expect(screen.getByText('Corte atualizado')).toBeTruthy();
});

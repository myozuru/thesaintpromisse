// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, pegarFicha } from './helpers/mesaReal';
import { agruparAcoesAtivas } from '@/lib/omni/agruparAcoesAtivas';
import { acoesAtivasDe, executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
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

it('cinco exemplares produzem um card e a seleção consome somente o exemplar escolhido', async () => {
  const ent = katana();
  const copias = Array.from({ length: 5 }, () => useInventoryStore.getState().add('u', ent));
  render(<AcoesAtivasSection charId="u" />);
  fireEvent.click(screen.getByRole('button', { name: /Corte da vingança/ }));
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
  fireEvent.click(screen.getByRole('button', { name: /Corte da vingança/ }));
  expect((screen.getByLabelText('Exemplar para Corte da vingança') as HTMLSelectElement).value).toBe(equipada.instanceId);
  act(() => useOmniEntidadesStore.setState({ entidades: { [ent.id]: { ...ent, acoesAtivas: [{ ...cfg, nome: 'Corte atualizado' }] } } }));
  expect(screen.queryByText('Corte da vingança')).toBeNull();
  expect(screen.getByText('Corte atualizado')).toBeTruthy();
});

it('inclui ações de entidade vinculada à ficha mesmo sem item físico no inventário', () => {
  const ent = { ...novaEntidade('talento'), nome: 'Espíritos de Fogo', acoesAtivas: [
    { ...cfg, id: 'invocar', nome: 'Invocar Espíritos', acao: 'bonus' as const, custoPE: '3' },
    { ...cfg, id: 'enviar', nome: 'Enviar Espírito', acao: 'livre' as const, custoPE: '0' },
  ] };
  useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
  useCharacterStore.getState().updateCharacter('u', {
    omniAtivos: [{ categoria: 'talento', entidadeId: ent.id, instanceId: 'ficha-espiritos' }],
  });

  expect(Object.keys(useInventoryStore.getState().items)).toHaveLength(0);
  const nomes = acoesAtivasDe('u').map((a) => a.cfg.nome);
  expect(nomes).toEqual(expect.arrayContaining(['Invocar Espíritos', 'Enviar Espírito']));

  render(<AcoesAtivasSection charId="u" />);
  expect(screen.getByText('Invocar Espíritos')).toBeTruthy();
  expect(screen.getByText('Enviar Espírito')).toBeTruthy();
});

it('executa ação vinculada à ficha sem erro de instância indisponível', async () => {
  const acao: AcaoAtivaConfig = {
    id: 'invocar',
    nome: 'Invocar Espíritos',
    acao: 'livre',
    custoPE: '3',
    alcanceM: 0,
    teste: 'nenhum',
    tipo_alvo: 'proprio',
    tipo_efeito: 'buff',
    efeitos: [],
  };
  const ent = { ...novaEntidade('talento'), nome: 'Espíritos de Fogo', acoesAtivas: [acao] };
  useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
  useCharacterStore.getState().updateCharacter('u', {
    peCurrent: 10,
    omniAtivos: [{ categoria: 'talento', entidadeId: ent.id, instanceId: 'ficha-espiritos' }],
  });

  const r = await executarAcaoAtiva('u', acao, '', ent, { instanciaId: 'ficha-espiritos' });
  expect(r.ok).toBe(true);
  expect(pegarFicha('u').peCurrent).toBe(7);
});


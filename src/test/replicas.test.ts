import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import {
  materializarReplica, pagarSustentacao, inicioTurnoReplicas, checarReplicasSoltas,
  desfazerReplica, replicaPadrao, custosDoPorte,
} from '@/lib/replicas';
import type { EntidadeOmni } from '@/lib/omni/tipos';

const ent = (over: Partial<EntidadeOmni> = {}): EntidadeOmni => ({
  id: 'e1', versao: 1, nome: 'Katana', categoria: 'arma', descricao: '', tags: [],
  duracao: { tipo: 'permanente' } as EntidadeOmni['duracao'], custos: [], gatilhos: [],
  replica: replicaPadrao('medio'), criadoEm: 0, atualizadoEm: 0, ...over,
});

function setup(pe = 10, e = ent()) {
  useCharacterStore.setState({
    characters: [{ id: 'c1', name: 'Teste', peCurrent: pe, mainHandWeaponName: null, offHandWeaponName: null } as never],
  } as never);
  useInventoryStore.setState({ items: {} });
  return useInventoryStore.getState().add('c1', e);
}
const char = () => useCharacterStore.getState().characters[0];
const inst = (id: string) => useInventoryStore.getState().items[id];

describe('Réplicas materializáveis', () => {
  beforeEach(() => setup());

  it('tabela de porte', () => {
    expect(custosDoPorte('colossal')).toMatchObject({ invocacao: 6, sustentacao: 5 });
    expect(custosDoPorte('pequeno')).toMatchObject({ invocacao: 2, sustentacao: 1 });
  });

  it('materializa: gasta invocação e coloca na mão', () => {
    const i = setup(10);
    expect(materializarReplica(i.instanceId).ok).toBe(true);
    expect(char().peCurrent).toBe(7);
    expect(char().mainHandWeaponName).toBe('Katana');
    expect(inst(i.instanceId).materializada).toBe(true);
  });

  it('PE insuficiente bloqueia', () => {
    const i = setup(2);
    expect(materializarReplica(i.instanceId).ok).toBe(false);
    expect(char().peCurrent).toBe(2);
  });

  it('sustentação no início do turno: pagar ou desfazer', () => {
    const i = setup(10, ent({ replica: { ...replicaPadrao('medio'), peSustentacao: 4 } }));
    materializarReplica(i.instanceId);
    inicioTurnoReplicas('c1');
    expect(inst(i.instanceId).sustentacaoPendente).toBe(true);
    expect(pagarSustentacao(i.instanceId).ok).toBe(true);
    expect(char().peCurrent).toBe(3);
    inicioTurnoReplicas('c1');
    expect(pagarSustentacao(i.instanceId).ok).toBe(false); // só 3 PE
    desfazerReplica(i.instanceId, 'sustentação não paga');
    expect(inst(i.instanceId).materializada).toBe(false);
    expect(char().mainHandWeaponName).toBeUndefined();
  });

  it('desintegra ao sair das mãos', () => {
    const i = setup(10);
    materializarReplica(i.instanceId);
    useCharacterStore.getState().updateCharacter('c1', { mainHandWeaponName: null });
    checarReplicasSoltas();
    expect(inst(i.instanceId).materializada).toBe(false);
  });

  it('sem cobrança por rodada não marca pendente; usa modelo quando renomeada', () => {
    const i = setup(10, ent({ nome: 'Lâmina Copiada', tags: ['modelo:katana'], replica: { ...replicaPadrao('pequeno'), cobrarPorRodada: false } }));
    materializarReplica(i.instanceId);
    inicioTurnoReplicas('c1');
    expect(inst(i.instanceId).sustentacaoPendente).toBe(false);
  });
});

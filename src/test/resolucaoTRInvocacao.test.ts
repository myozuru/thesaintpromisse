// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/omni/eventBus', () => ({ emitirEvento: vi.fn() }));

import { resolverDanoAposTRInvocacao } from '@/lib/controlador/resolucaoTR';
import type { TestRequest } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useMapStore } from '@/stores/useMapStore';
import { invocarControlador } from '@/lib/controlador/mapa';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';
import { comoTela, ficha, montarMesa } from './helpers/mesaReal';

function pedidoTR(result: NonNullable<TestRequest['result']>, damageOnSuccess: 'nenhum' | 'metade' = 'nenhum', damageBonus = 0): TestRequest {
  return {
    id: 'tr-shikigami', charId: 'inimigo', charName: 'Inimigo', kind: 'save',
    testName: 'Fortitude', dc: 14, createdAt: Date.now(), result,
    invocationResolution: {
      kind: 'shikigami_damage_after_save', ownerCharacterId: 'dono', invocationId: 'a',
      invocationInstanceId: 'instancia-a', actionId: 'rugido', sourceName: 'A — Rugido',
      damageFormula: '1d6+2', damageBonus, damageType: 'DP', damageOnSuccess,
    },
  };
}

describe('resolução de dano após TR de Shikigami', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [
      ficha('dono', { profileId: 'perfil-dono', hpCurrent: 20, hpMax: 20 }),
      ficha('inimigo', { hpCurrent: 15, hpMax: 15 }),
    ] } as never);
    comoTela({ profileId: null, role: 'MASTER' });
    useDice3DStore.setState({ enabled: false } as never);
  });

  it('aplica dano integral ao alvo correto quando o TR falha por 1 natural', async () => {
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([4]);
    const request = pedidoTR({ d20: 1, bonus: 20, total: 21, rolledAt: Date.now() });

    await expect(resolverDanoAposTRInvocacao(request)).resolves.toEqual({ passou: false, dano: 6 });
    expect(useCharacterStore.getState().characters.find(c => c.id === 'inimigo')?.hpCurrent).toBe(9);
    expect(useCharacterStore.getState().characters.find(c => c.id === 'dono')?.hpCurrent).toBe(20);
  });

  it('aplica metade do dano rolado em 3D quando o alvo passa no TR', async () => {
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([4]);
    const request = pedidoTR({ d20: 15, bonus: 0, total: 15, rolledAt: Date.now() }, 'metade', 2);

    await expect(resolverDanoAposTRInvocacao(request)).resolves.toEqual({ passou: true, dano: 4 });
    expect(useCharacterStore.getState().characters.find(c => c.id === 'inimigo')?.hpCurrent).toBe(11);
  });

  it('não rola nem aplica dano quando o alvo passa e a ação não causa dano no sucesso', async () => {
    const damageDice = vi.spyOn(useDice3DStore.getState(), 'requestNotation');
    const request = pedidoTR({ d20: 15, bonus: 0, total: 15, rolledAt: Date.now() });

    await expect(resolverDanoAposTRInvocacao(request)).resolves.toEqual({ passou: true, dano: 0 });
    expect(damageDice).not.toHaveBeenCalled();
    expect(useCharacterStore.getState().characters.find(c => c.id === 'inimigo')?.hpCurrent).toBe(15);
  });

  it('aplica o dano pós-TR à instância de Shikigami em vez da ficha do dono que rolou', async () => {
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([4]);
    const modelo = {
      id: 'shiki-alvo', donoCharacterId: 'dono', tipo: 'shikigami', nome: 'Guardião',
      hpAtual: 12, hpMaximo: 12, defesa: 14, deslocamentoM: 9, porte: 'Médio',
      custoInvocacaoPE: 0, alcanceInvocacaoM: 3, acoes: [],
      intermediario: { tipo: 'tecnica', tecnicaId: 'tecnica-inata' },
    } as unknown as InvocacaoControlador;
    const dono = ficha('dono', {
      profileId: 'perfil-dono', hpCurrent: 20, hpMax: 20,
      tecnicaAmaldicoada: 'tecnica-inata', invocacoesConhecidas: [modelo],
    });
    const inimigo = ficha('inimigo', { hpCurrent: 15, hpMax: 15 });
    montarMesa([dono, inimigo], { dono: [2, 2], inimigo: [20, 20] });
    const summoned = invocarControlador('dono', modelo.id, 'leste');
    if (!summoned.ok) throw new Error(summoned.motivo);
    const token = useMapStore.getState().entities[summoned.tokenId];
    const request: TestRequest = {
      ...pedidoTR({ d20: 1, bonus: 20, total: 21, rolledAt: Date.now() }),
      charId: 'dono', charName: 'Guardião',
      invocationResolution: {
        ...pedidoTR({ d20: 1, bonus: 20, total: 21, rolledAt: Date.now() }).invocationResolution!,
        targetInvocation: {
          tokenId: token.id,
          ownerCharacterId: 'dono',
          invocationId: modelo.id,
          invocationInstanceId: token.invocationInstanceId!,
          name: 'Guardião',
        },
      },
    };

    await expect(resolverDanoAposTRInvocacao(request)).resolves.toEqual({ passou: false, dano: 6 });

    expect(useCharacterStore.getState().characters.find(c => c.id === 'dono')?.hpCurrent).toBe(20);
    expect(useCharacterStore.getState().characters.find(c => c.id === 'inimigo')?.hpCurrent).toBe(15);
    expect(useCharacterStore.getState().characters.find(c => c.id === 'dono')?.instanciasInvocacao?.[0]).toMatchObject({
      id: token.invocationInstanceId, modeloId: modelo.id, hpAtual: 6, estado: 'ativa',
    });
    expect(useMapStore.getState().entities[token.id]?.hp).toBe(6);
  });
});

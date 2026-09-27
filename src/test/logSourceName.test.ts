import { beforeEach, describe, expect, it } from 'vitest';
import { useChronosStore } from '@/stores/useChronosStore';
import { useLogStore } from '@/stores/useLogStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';

describe('identificação nos logs', () => {
  beforeEach(() => {
    useLogStore.setState({ logs: [] });
    useProfileStore.setState({
      activeProfileId: 'player-1',
      profiles: [{ id: 'player-1', name: 'Nobara', avatar: null, password: null, createdAt: 1 }],
    });
    useRoleStore.setState({ role: 'PLAYER' });
    useChronosStore.setState({ hours: 1, minutes: 2, seconds: 3, day: 1, month: 1, year: 1 });
  });

  it('registra o nome do player em qualquer origem, inclusive Hub', () => {
    useLogStore.getState().addLog('roll', '🎲 Hub: 1d20[14]=14 → Total: 14');

    expect(useLogStore.getState().logs[0]).toMatchObject({
      sourceName: 'Nobara',
      sourceRole: 'PLAYER',
      message: '🎲 Hub: 1d20[14]=14 → Total: 14',
    });
  });

  it('identifica o Mestre quando o perfil ainda não estiver disponível', () => {
    useProfileStore.setState({ activeProfileId: null, profiles: [] });
    useRoleStore.setState({ role: 'MASTER' });

    useLogStore.getState().addLog('system', 'Cena iniciada');

    expect(useLogStore.getState().logs[0]?.sourceName).toBe('Mestre');
  });
});
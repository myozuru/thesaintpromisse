/**
 * Fluxo de pedido de rolagem Mestre → Jogador:
 * - o jogador rola e vê o resultado;
 * - ao fechar, o pedido NÃO some para o mestre (ackResult);
 * - só o dismiss do mestre remove o pedido.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestRequestStore } from '@/stores/useTestRequestStore';

describe('ciclo de vida do pedido de teste', () => {
  beforeEach(() => {
    useTestRequestStore.setState({ requests: [] });
  });

  it('jogador fecha o resultado sem remover o pedido (mestre ainda vê)', () => {
    const s = () => useTestRequestStore.getState();
    s().enqueue({
      charId: 'c1',
      charName: 'Ayla',
      kind: 'skill',
      testName: 'Percepção',
    });
    const req = s().requests[0];
    expect(req.result).toBeUndefined();

    // Jogador rola → resultado preenchido.
    s().setResult(req.id, { d20: 14, bonus: 3, total: 17, rolledAt: Date.now() });
    expect(s().requests[0].result?.total).toBe(17);

    // Jogador fecha → ack, pedido continua existindo com o resultado.
    s().ackResult(req.id);
    const afterAck = s().requests.find((r) => r.id === req.id);
    expect(afterAck).toBeDefined();
    expect(afterAck?.result?.total).toBe(17);
    expect(afterAck?.playerAckedAt).toBeTypeOf('number');

    // Mestre dispensa → aí sim some.
    s().dismiss(req.id);
    expect(s().requests.find((r) => r.id === req.id)).toBeUndefined();
  });

  it('ack em pedido inexistente não quebra nada', () => {
    const s = () => useTestRequestStore.getState();
    s().ackResult('nao-existe');
    expect(s().requests).toHaveLength(0);
  });
});

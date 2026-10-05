import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@/types';
import { mergePublicLogs, playerLogMessage, publicLogEntry } from '@/lib/logPrivacy';

const enemyRoll: LogEntry = {
  id: 'enemy-test', timestamp: 1, type: 'combat', sourceRole: 'MASTER',
  message: '🎲 Kurogiri — TR (Reflexos): d20 13 +2 = 15 vs CD 69 → FALHA',
};

describe('privacidade do histórico de combate', () => {
  it('oculta CD e bônus do teste inimigo, inclusive nos registros antigos', () => {
    const publicText = playerLogMessage(enemyRoll);
    expect(publicText).toContain('Kurogiri');
    for (const secret of ['69', '+2', '13', '15']) expect(publicText).not.toContain(secret);
    expect(enemyRoll.message).toContain('CD 69');
  });

  it('o snapshot público não carrega a mensagem privada em nenhum campo', () => {
    const wire = JSON.stringify(publicLogEntry(enemyRoll));
    expect(wire).not.toContain('69');
    expect(wire).not.toContain('+2');
  });

  it('preserva os detalhes locais do mestre ao receber o eco público', () => {
    const wire = [publicLogEntry(enemyRoll)];
    expect(mergePublicLogs([enemyRoll], wire, true)[0].message).toBe(enemyRoll.message);
    expect(mergePublicLogs([enemyRoll], wire, false)[0].message).not.toContain('69');
  });

  it('respeita uma mensagem pública explícita para teste do jogador com CD oculta', () => {
    const log = { ...enemyRoll, sourceRole: 'PLAYER' as const, publicMessage: 'Ayla — TR: total 15 → FALHA' };
    expect(publicLogEntry(log).message).toBe(log.publicMessage);
    expect(JSON.stringify(publicLogEntry(log))).not.toContain('69');
  });

  it('não esconde os bônus próprios de uma rolagem pública do jogador', () => {
    expect(playerLogMessage({ ...enemyRoll, sourceRole: 'PLAYER' })).toBe(enemyRoll.message);
  });

  it('oculta CDs em mensagens de efeito sem apagar dano público', () => {
    expect(playerLogMessage({ ...enemyRoll, type: 'spell', message: 'Chamas: 18 dano | TR: Falha (CD:69)' }))
      .toBe('Chamas: 18 dano | TR: Falha (CD oculta)');
  });
});

import type { LogEntry } from '@/types';

/** Legacy entries have no explicit audience, so master dice details are private by default. */
export function playerLogMessage(log: Pick<LogEntry, 'message' | 'publicMessage' | 'sourceRole' | 'type'>): string {
  if (log.publicMessage != null) return log.publicMessage;
  if (log.sourceRole !== 'MASTER') return log.message;
  if (log.type === 'roll' || /\bd20\b|\bd20\(/i.test(log.message)) {
    const label = log.message.split(':')[0];
    return `${label.includes('=') || label.includes('d20') ? '🎲 Mestre' : label}: teste realizado (detalhes reservados ao mestre).`;
  }
  return log.message.replace(/\bCD\s*[:=]?\s*\d+(?:[.,]\d+)?/gi, 'CD oculta');
}

/** Never serialize the original private message into a public log snapshot. */
export function publicLogEntry(log: LogEntry): LogEntry {
  const message = playerLogMessage(log);
  return { ...log, message, publicMessage: message };
}

/** Echoes of public snapshots must not erase details retained by the originating master. */
export function mergePublicLogs(local: LogEntry[], incoming: LogEntry[], isMaster: boolean): LogEntry[] {
  if (!isMaster) return incoming.map(publicLogEntry);
  const byId = new Map(local.map(log => [log.id, log]));
  return incoming.map(log => byId.get(log.id) ?? log);
}

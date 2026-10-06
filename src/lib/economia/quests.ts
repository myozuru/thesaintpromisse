/** Regras puras do Mural de Quests: prazo no tempo do mundo e divisão de recompensa. */
export const ICONES_QUEST = {
  caveira: '💀', interrogacao: '❓', espada: '⚔️', escudo: '🛡️', pocao: '🧪', bau: '🧰', coroa: '👑',
  olho: '👁️', chama: '🔥', moeda: '🪙', mapa: '🗺️', estrela: '⭐', pegada: '👣', pergaminho: '📜', alvo: '🎯',
} as const;
export type IconeQuest = keyof typeof ICONES_QUEST;

export type StatusQuest = 'disponivel' | 'aceita' | 'concluida' | 'falhou' | 'expirada';
export const STATUS_LABEL: Record<StatusQuest, string> = {
  disponivel: 'Disponível', aceita: 'Aceita', concluida: 'Concluída', falhou: 'Falhou', expirada: 'Expirada',
};

/** Divide igualmente; o resto vai para o primeiro participante. */
export function dividirRecompensa(total: number, participantes: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!participantes.length || total <= 0) return out;
  const t = Math.floor(total), parte = Math.floor(t / participantes.length), resto = t - parte * participantes.length;
  participantes.forEach((p, i) => { out[p] = parte + (i === 0 ? resto : 0); });
  return out;
}

export function prazoEmSegundos(dias: number, horas: number): number {
  return Math.max(0, Math.floor(dias)) * 86400 + Math.max(0, Math.floor(horas)) * 3600;
}

export function questExpirou(prazoFim: number | null | undefined, agora: number): boolean {
  return prazoFim != null && agora >= prazoFim;
}

/** "2d 5h restantes" no tempo do mundo. */
export function formatarRestante(prazoFim: number | null | undefined, agora: number): string | null {
  if (prazoFim == null) return null;
  const s = prazoFim - agora;
  if (s <= 0) return 'Prazo esgotado';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h restantes`;
  if (h > 0) return `${h}h ${m}min restantes`;
  return `${m}min restantes`;
}

/** Dia absoluto do mundo (para limites diários). */
export function diaDoMundo(segundos: number): number {
  return Math.floor(segundos / 86400);
}

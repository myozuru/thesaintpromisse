/** Guilda dos jogadores: membros aceitam quests juntos e acumulam renome. Regras puras. */
export interface Guilda {
  id: string;
  nome: string;
  emblema: string;
  lema: string;
  liderId: string;
  membros: string[];
  /** Renome da guilda (nunca negativo). */
  renome: number;
  updatedAt: number;
  deletedAt?: number;
}

/** Renome ganho ao concluir uma quest pela guilda; metade é perdida ao falhar. */
export const RENOME_POR_QUEST = 10;

export const limitarRenome = (v: number) => Math.max(0, Math.round(v));

export function nivelGuilda(renome: number): { nome: string; proximo: number | null } {
  if (renome >= 300) return { nome: 'Lendária', proximo: null };
  if (renome >= 150) return { nome: 'Renomada', proximo: 300 };
  if (renome >= 60) return { nome: 'Respeitada', proximo: 150 };
  if (renome >= 20) return { nome: 'Iniciante', proximo: 60 };
  return { nome: 'Desconhecida', proximo: 20 };
}

/** Guilda ativa da qual a ficha faz parte. */
export function guildaDe(guildas: Record<string, Guilda>, charId?: string): Guilda | undefined {
  if (!charId) return undefined;
  return Object.values(guildas).find((g) => !g.deletedAt && g.membros.includes(charId));
}

export const renomeGanho = (repRecompensa?: number) => Math.max(RENOME_POR_QUEST, repRecompensa ?? 0);

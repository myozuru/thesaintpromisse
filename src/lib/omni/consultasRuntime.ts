import type { EfeitoAtivo } from '@/stores/useOmniRuntimeStore';

export function normalizarIdKey(id: string): string {
  return id.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9_]/g, '_');
}

export function cooldownAcaoKey(id: string): string { return `omni:${id}`; }

export function cooldownDoItem(acoes: Array<{ id: string }> | undefined, cooldowns: Record<string, number> | undefined): number {
  return Math.max(0, ...(acoes ?? []).map((a) => cooldowns?.[cooldownAcaoKey(a.id)] ?? 0));
}

export function consultarEfeito(efeitos: EfeitoAtivo[], agora: number, usuarioId?: string): Record<string, number> | undefined {
  const ativos = efeitos.filter((e) => e.expiraEm === null || e.expiraEm > agora);
  if (!ativos.length) return undefined;
  const permanente = ativos.some((e) => e.expiraEm === null);
  return {
    pilhas: ativos.length,
    pilhas_do_usuario: ativos.filter((e) => usuarioId !== undefined && e.sourceCharId === usuarioId).length,
    aplicado_por_usuario: ativos.some((e) => usuarioId !== undefined && e.sourceCharId === usuarioId) ? 1 : 0,
    permanente: permanente ? 1 : 0,
    duracao_restante: permanente ? -1 : Math.max(...ativos.map((e) => Math.max(0, e.expiraEm! - agora))),
  };
}

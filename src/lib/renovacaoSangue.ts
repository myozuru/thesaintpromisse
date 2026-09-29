import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';

/**
 * Renovação pelo Sangue (Especialista em Combate, Nv 6):
 * ao acertar um ataque crítico em um inimigo OU reduzir os PV do inimigo a 0,
 * recupera 1 Ponto de Energia Amaldiçoada (sem ultrapassar o máximo).
 */
export function renovacaoSangueAtiva(c: Pick<Character, 'level'> & Partial<Character>): boolean {
  return isEspecialistaCombate(c as Character) && (c.level ?? 1) >= 6;
}

/**
 * Aplica a recuperação de 1 PE. Retorna true se houve recuperação efetiva
 * (PE não estava no máximo).
 */
export function aplicarRenovacao(
  c: Character,
  update: (id: string, patch: Partial<Character>) => void,
): boolean {
  if (!renovacaoSangueAtiva(c)) return false;
  const atual = c.peCurrent ?? 0;
  const max = c.peMax ?? atual;
  if (atual >= max) return false;
  update(c.id, { peCurrent: Math.min(max, atual + 1) });
  return true;
}

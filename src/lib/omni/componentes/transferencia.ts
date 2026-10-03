import type { Character } from '@/types';
import { destinoComposto } from './escrita';

const campos: Record<string, [keyof Character, keyof Character | undefined]> = {
  pe: ['peCurrent', 'peMax'], pe_temp: ['tempPE', undefined], reserva_pe: ['economiaPEReserve', undefined],
  sorte: ['luckCurrent', 'luckMax'], dado_vida: ['hitDiceCurrent', 'hitDiceMax'],
};

/** Calcula débito e crédito sobre um único snapshot; conserva o saldo que não cabe. */
export function planejarTransferencia(c: Character, origem: string, destino: string, solicitado: number): { valor: number; patch: Partial<Character> } | undefined {
  const a = campos[destinoComposto(origem)?.caminho ?? origem];
  const b = campos[destinoComposto(destino)?.caminho ?? destino];
  if (!a || !b || a[0] === b[0] || !Number.isFinite(solicitado) || solicitado < 0) return;
  const saldo = Math.max(0, Number(c[a[0]]) || 0), atual = Math.max(0, Number(c[b[0]]) || 0);
  const capacidade = b[1] ? Math.max(0, (Number(c[b[1]]) || 0) - atual) : Infinity;
  const valor = Math.min(saldo, capacidade, Math.floor(solicitado));
  return { valor, patch: { [a[0]]: saldo - valor, [b[0]]: atual + valor } };
}

/**
 * Mesa REAL em memória: usa as stores e funções de verdade do app (fichas, mapa,
 * dados, papéis) para testar um fluxo inteiro — rolagem → aviso → clique → efeito —
 * em milissegundos, sem abrir navegador nem criar contas.
 *
 *  • montarMesa(): coloca fichas e peças no mapa.
 *  • forcarDados(): define o próximo resultado dos dados (ex.: 1 natural).
 *  • comoTela(): troca "quem está olhando" (dono da ficha / Mestre).
 *  • capturarEnvios(): grava o que esta tela mandaria às outras pela nuvem,
 *    e entregarNaOutraTela() simula a outra tela recebendo.
 *
 * Use em arquivos com `// @vitest-environment jsdom` para poder renderizar e clicar.
 */
import { vi } from 'vitest';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';

export const CASA = 70; // px por casa; 1 casa = 1,5 m

export function ficha(id: string, extra: Partial<Character> & Record<string, unknown> = {}): Character {
  return {
    id, name: id, level: 4, category: 'PLAYER', peCurrent: 20, peMax: 20,
    chosenSpecAbilities: [], activeConditions: [], ...extra,
  } as unknown as Character;
}

/** Coloca fichas e peças (posição em casas) na mesa real. */
export function montarMesa(chars: Character[], posicoes: Record<string, [number, number]>) {
  useCharacterStore.setState({ characters: chars } as never);
  const entities: Record<string, unknown> = {};
  for (const [cid, [cx, cy]] of Object.entries(posicoes)) {
    entities[`e-${cid}`] = { id: `e-${cid}`, characterId: cid, type: 'character', x: cx * CASA, y: cy * CASA, w: CASA, h: CASA };
  }
  useMapStore.setState({ entities, gridConfig: { ...useMapStore.getState().gridConfig, dpi: CASA, metersPerCell: 1.5 } } as never);
}

export const pegarFicha = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;

/** Os próximos d20 saem com esses valores (depois volta ao aleatório). */
export function forcarDados(...valores: number[]) {
  const fila = [...valores];
  const orig = useDice3DStore.getState().requestRoll;
  useDice3DStore.setState({
    requestRoll: (types: unknown[], ...rest: unknown[]) =>
      fila.length ? Promise.resolve(types.map(() => fila.shift() ?? 1)) : (orig as never as (...a: unknown[]) => Promise<number[]>)(types, ...rest),
  } as never);
}

/** Define quem está olhando esta tela. */
export function comoTela(v: { profileId: string | null; role: 'MASTER' | 'PLAYER' }) {
  useProfileStore.setState({ activeProfileId: v.profileId } as never);
  useRoleStore.setState({ role: v.role } as never);
}

/** Grava as mensagens que esta tela mandaria para as outras (evento `<nome>:send`). */
export function capturarEnvios(nome: string) {
  const enviados: Record<string, unknown>[] = [];
  const fn = (e: Event) => enviados.push({ clientId: 'tela-local', ...((e as CustomEvent).detail ?? {}) });
  window.addEventListener(`${nome}:send`, fn);
  return { enviados, parar: () => window.removeEventListener(`${nome}:send`, fn) };
}

/** Espera promessas pendentes (rolagens, imports) andarem. */
export const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export function limparMesa() {
  vi.restoreAllMocks();
  useDice3DStore.setState({ enabled: false } as never);
}

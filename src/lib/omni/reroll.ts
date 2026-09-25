/**
 * Sistema de REROLL pendente do Omni-Engine.
 *
 * Efeitos com `meta.rerollPendente = N` forçam re-rolagem de até N rolls
 * vindos de `rollD20`/`rollDice`. Cada uso decrementa N.
 *
 * Implementação minimalista: lista de IDs de efeito que têm reroll
 * disponível para um charId. Consultada por `useRerollDoCharacter` no log.
 */
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';

export function consumirRerollDe(charId: string | undefined): boolean {
  if (!charId) return false;
  const rt = useOmniRuntimeStore.getState();
  for (const ef of Object.values(rt.efeitos)) {
    if (ef.targetCharId !== charId) continue;
    const meta = (ef.meta ?? {}) as { rerollPendente?: number };
    if ((meta.rerollPendente ?? 0) > 0) {
      rt.efeitos[ef.id] = {
        ...ef,
        meta: { ...meta, rerollPendente: (meta.rerollPendente ?? 0) - 1 },
      };
      useOmniRuntimeStore.setState({ efeitos: { ...rt.efeitos } });
      return true;
    }
  }
  return false;
}

let charContextoRolagem: string | undefined;
export function setCharContextoRolagem(id: string | undefined) {
  charContextoRolagem = id;
}
export function getCharContextoRolagem(): string | undefined {
  return charContextoRolagem;
}

/** Helper: executa fn com o contexto de rolagem setado e limpa depois. */
export function comContextoDeRolagem<T>(charId: string | undefined, fn: () => T): T {
  const anterior = charContextoRolagem;
  charContextoRolagem = charId;
  try {
    return fn();
  } finally {
    charContextoRolagem = anterior;
  }
}


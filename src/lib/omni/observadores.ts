/**
 * Gatilhos de observação espacial do OMNI.
 *
 * Quando algo acontece com uma criatura (sofrer dano, causar dano, cair),
 * TODA outra ficha recebe um evento "observado" — aliado ou inimigo — com a
 * distância real no mapa em `@CENA.distancia`. O próprio script decide o
 * raio (`se @CENA.distancia <= 4.5`), então serve para qualquer habilidade.
 *
 * Contexto do evento: USUARIO = quem observa (dono do item/passiva);
 * ALVO = a criatura envolvida (ferido, atacante ou caído).
 */
import type { Character } from '@/types';
import type { GatilhoId } from './constantesDoSistema';

export type TipoObservado = 'sofrerDano' | 'causarDano' | 'morrer';

const EVENTOS: Record<TipoObservado, { aliado: GatilhoId; inimigo: GatilhoId }> = {
  sofrerDano: { aliado: 'aoAliadoSofrerDano', inimigo: 'aoInimigoSofrerDano' },
  causarDano: { aliado: 'aoAliadoCausarDano', inimigo: 'aoInimigoCausarDano' },
  morrer: { aliado: 'aoAliadoMorrer', inimigo: 'aoInimigoMorrer' },
};

/** Lado de uma ficha: inimigos de um lado, players/NPCs do outro. */
export function ladoDe(c: Pick<Character, 'category'> | undefined): 'inimigo' | 'aliado' {
  return c?.category === 'INIMIGO' ? 'inimigo' : 'aliado';
}

export function saoAliados(a?: Pick<Character, 'category'>, b?: Pick<Character, 'category'>): boolean {
  return ladoDe(a) === ladoDe(b);
}

/** Escolhe o evento canônico para um observador. Pura (testável). */
export function eventoObservado(
  tipo: TipoObservado,
  observador: Pick<Character, 'category'>,
  sujeito: Pick<Character, 'category'>,
): GatilhoId {
  return saoAliados(observador, sujeito) ? EVENTOS[tipo].aliado : EVENTOS[tipo].inimigo;
}

export interface OpcoesObservar {
  /** A criatura envolvida (ferido / atacante / caído). */
  sujeitoId: string;
  /** A outra parte (atacante do ferido, alvo do atacante). */
  outroId?: string;
  dano?: number;
}

export async function emitirObservadores(tipo: TipoObservado, op: OpcoesObservar): Promise<number> {
  const [{ useCharacterStore }, { useMapStore }, { distanceBetweenChars }, { emitirEvento }] = await Promise.all([
    import('@/stores/useCharacterStore'),
    import('@/stores/useMapStore'),
    import('@/lib/weaponRange'),
    import('./eventBus'),
  ]);
  const chars = useCharacterStore.getState().characters;
  const sujeito = chars.find((c) => c.id === op.sujeitoId);
  if (!sujeito) return 0;
  const outro = op.outroId ? chars.find((c) => c.id === op.outroId) : undefined;
  const map = useMapStore.getState();
  let total = 0;
  for (const obs of chars) {
    if (obs.id === sujeito.id) continue;
    if (op.outroId && obs.id === op.outroId && tipo !== 'morrer') continue;
    let dist: number | null = null;
    try {
      dist = distanceBetweenChars(obs.id, sujeito.id, map.entities as never, map.gridConfig as never, {
        casterProfileId: obs.profileId,
        targetProfileId: sujeito.profileId,
      });
    } catch { dist = null; }
    const cena: Record<string, number> = {
      distancia: dist ?? 999,
      no_mapa: dist === null ? 0 : 1,
      dano: op.dano ?? 0,
      sujeito_eh_aliado: saoAliados(obs, sujeito) ? 1 : 0,
      outro_eh_inimigo: outro ? (saoAliados(obs, outro) ? 0 : 1) : 0,
      outro_eh_aliado: outro ? (saoAliados(obs, outro) ? 1 : 0) : 0,
      outro_eh_voce: outro && outro.id === obs.id ? 1 : 0,
    };
    total += emitirEvento(eventoObservado(tipo, obs, sujeito), {
      usuarioId: obs.id,
      alvoId: sujeito.id,
      cena,
      origemNome: tipo === 'sofrerDano' ? 'Dano Observado' : tipo === 'causarDano' ? 'Ataque Observado' : 'Queda Observada',
      incluirPassivas: false,
    });
  }
  return total;
}

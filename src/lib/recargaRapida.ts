/**
 * Especialista em Combate — Habilidade de 4º nível: Recarga Rápida.
 *
 * O custo em ações para recarregar armas a distância empunhadas diminui em
 * um nível: Ação Comum vira Ação Bônus e Ação Bônus vira Ação Livre.
 *
 * Munição: armas com a propriedade Recarga [X] têm X tiros carregados.
 * Cada ataque com a arma gasta 1 tiro; sem tiros, é preciso recarregar.
 * Custo base de recarga = Ação Comum; armas Leves = Ação Bônus.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { findWeaponByName, type Weapon } from '@/lib/weapons';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export const RECARGA_RAPIDA_ID = 'ec-recarga-rapida';

export type CustoRecarga = 'action' | 'bonus' | 'free';

export function hasRecargaRapida(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === RECARGA_RAPIDA_ID);
}

/** Capacidade (Recarga [X]) da arma, ou null se ela não usa munição. */
export function capacidadeArma(w: Weapon | null | undefined): number | null {
  const p = w?.properties?.find((x) => x.kind === 'recarga');
  return p?.value ?? null;
}

export function capacidadePorNome(nome: string | null | undefined): number | null {
  return capacidadeArma(nome ? findWeaponByName(nome) : null);
}

/** Tiros restantes na arma (default = capacidade cheia). */
export function tirosRestantes(c: Character, nomeArma: string): number | null {
  const cap = capacidadePorNome(nomeArma);
  if (cap === null) return null;
  const atual = c.weaponAmmo?.[nomeArma];
  return atual === undefined ? cap : Math.max(0, Math.min(cap, atual));
}

/** Custo base de recarga da arma, antes da habilidade. */
export function custoBaseRecarga(w: Weapon | null | undefined): CustoRecarga {
  if (!w) return 'action';
  return w.properties.some((p) => p.kind === 'leve') ? 'bonus' : 'action';
}

/** Custo final de recarga, já com Recarga Rápida aplicada. */
export function custoRecarga(c: Character, nomeArma: string): CustoRecarga {
  const base = custoBaseRecarga(findWeaponByName(nomeArma));
  if (!hasRecargaRapida(c)) return base;
  if (base === 'action') return 'bonus';
  if (base === 'bonus') return 'free';
  return 'free';
}

export function rotuloCusto(custo: CustoRecarga): string {
  return custo === 'action' ? 'Ação Comum' : custo === 'bonus' ? 'Ação Bônus' : 'Ação Livre';
}

/** Consome 1 tiro ao atacar. Devolve false quando a arma está descarregada. */
export function consumirTiro(charId: string, nomeArma: string): { ok: boolean; restante?: number; reason?: string } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return { ok: false, reason: 'Ficha não encontrada.' };
  const cap = capacidadePorNome(nomeArma);
  if (cap === null) return { ok: true };
  const atual = tirosRestantes(c, nomeArma) ?? cap;
  if (atual <= 0) return { ok: false, reason: `${nomeArma} está descarregada — recarregue antes de atacar.` };
  const restante = atual - 1;
  store.updateCharacter(charId, { weaponAmmo: { ...(c.weaponAmmo ?? {}), [nomeArma]: restante } });
  return { ok: true, restante };
}

/** Recarrega a arma, pagando o custo em ações correspondente. */
export function recarregar(charId: string, nomeArma: string): { ok: boolean; reason?: string; custo?: CustoRecarga } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return { ok: false, reason: 'Ficha não encontrada.' };
  const cap = capacidadePorNome(nomeArma);
  if (cap === null) return { ok: false, reason: 'Essa arma não usa munição.' };
  const atual = tirosRestantes(c, nomeArma) ?? cap;
  if (atual >= cap) return { ok: false, reason: 'A arma já está carregada.' };
  const custo = custoRecarga(c, nomeArma);
  if (custo === 'action' && (c.actionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem Ação Comum disponível.' };
  if (custo === 'bonus' && (c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem Ação Bônus disponível.' };
  store.updateCharacter(charId, {
    weaponAmmo: { ...(c.weaponAmmo ?? {}), [nomeArma]: cap },
    ...(custo === 'action' ? { actionsCurrent: Math.max(0, (c.actionsCurrent ?? 0) - 1) } : {}),
    ...(custo === 'bonus' ? { bonusActionsCurrent: Math.max(0, (c.bonusActionsCurrent ?? 0) - 1) } : {}),
  });
  useLogStore.getState().addLog(
    'combat',
    `🔃 ${c.name} recarrega ${nomeArma} (${cap} tiros) — ${rotuloCusto(custo)}${hasRecargaRapida(c) ? ' (Recarga Rápida)' : ''}.`,
  );
  return { ok: true, custo };
}

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
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useItemStore } from '@/stores/useItemStore';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
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

export function capacidadeDaReferencia(c: Character, nome: string, instanceId?: string): number | null {
  return capacidadeArma(instanceId ? armaDoPersonagem(c.id, nome, instanceId) : findWeaponByName(nome));
}

/** Migra o antigo contador compartilhado para a cópia empunhada (ou uma cópia estável). */
function migrarMunicaoLegada(c: Character, nome: string): void {
  if (c.weaponAmmo?.[nome] === undefined) return;
  const inventory = useInventoryStore.getState();
  const omniCopies = inventory.listByOwner(c.id).filter((i) => i.entity.categoria === 'arma' &&
    (i.entity.replica ? i.replicaArma : i.entity.nome)?.trim().toLowerCase() === nome.trim().toLowerCase() &&
    capacidadeArma(armaDoPersonagem(c.id, i.entity.replica ? i.replicaArma! : i.entity.nome, i.instanceId)) !== null);
  const legacyCopies = useItemStore.getState().items.filter(i => i.assignedTo?.includes(c.id) &&
    i.name.trim().toLowerCase() === nome.trim().toLowerCase() && capacidadePorNome(i.name) !== null);
  const ids = [...omniCopies.map(i => i.instanceId), ...legacyCopies.map(i => `legacy:${i.id}`)];
  if (ids.length === 0 || omniCopies.some(i => i.municaoRestante !== undefined) || legacyCopies.some(i => c.weaponAmmo?.[`legacy:${i.id}`] !== undefined)) return;
  const equippedId = [c.mainHandWeaponInstanceId, c.offHandWeaponInstanceId].find(id => id && ids.includes(id));
  const targetId = equippedId ?? [...ids].sort()[0];
  const cap = capacidadePorNome(nome) ?? 0;
  const remaining = Math.max(0, Math.min(cap, c.weaponAmmo[nome]));
  for (const copy of omniCopies) inventory.definirMunicao(copy.instanceId, copy.instanceId === targetId ? remaining : 0);
  if (legacyCopies.length > 0) {
    const ammo = { ...(c.weaponAmmo ?? {}) };
    for (const copy of legacyCopies) ammo[`legacy:${copy.id}`] = `legacy:${copy.id}` === targetId ? remaining : 0;
    useCharacterStore.getState().updateCharacter(c.id, { weaponAmmo: ammo });
  }
}

/** Tiros restantes na arma (default = capacidade cheia). */
export function tirosRestantes(c: Character, nomeArma: string, instanceId?: string): number | null {
  if (instanceId) migrarMunicaoLegada(c, nomeArma);
  const cap = capacidadeDaReferencia(c, nomeArma, instanceId);
  if (cap === null) return null;
  if (instanceId) {
    const current = instanceId.startsWith('legacy:')
      ? useCharacterStore.getState().characters.find(x => x.id === c.id)?.weaponAmmo?.[instanceId]
      : useInventoryStore.getState().items[instanceId]?.ownerId === c.id
        ? useInventoryStore.getState().items[instanceId].municaoRestante : null;
    if (current === null) return null;
    return current === undefined ? cap : Math.max(0, Math.min(cap, current));
  }
  const atual = c.weaponAmmo?.[nomeArma];
  return atual === undefined ? cap : Math.max(0, Math.min(cap, atual));
}

/** Custo base de recarga da arma, antes da habilidade. */
export function custoBaseRecarga(w: Weapon | null | undefined): CustoRecarga {
  if (!w) return 'action';
  return w.properties.some((p) => p.kind === 'leve') ? 'bonus' : 'action';
}

/** Custo final de recarga, já com Recarga Rápida aplicada. */
export function custoRecarga(c: Character, nomeArma: string, instanceId?: string): CustoRecarga {
  const base = custoBaseRecarga(instanceId ? armaDoPersonagem(c.id, nomeArma, instanceId) : findWeaponByName(nomeArma));
  if (!hasRecargaRapida(c)) return base;
  if (base === 'action') return 'bonus';
  if (base === 'bonus') return 'free';
  return 'free';
}

export function rotuloCusto(custo: CustoRecarga): string {
  return custo === 'action' ? 'Ação Comum' : custo === 'bonus' ? 'Ação Bônus' : 'Ação Livre';
}

/** Consome 1 tiro ao atacar. Devolve false quando a arma está descarregada. */
export function consumirTiro(charId: string, nomeArma: string, instanceId?: string): { ok: boolean; restante?: number; reason?: string } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return { ok: false, reason: 'Ficha não encontrada.' };
  const cap = capacidadeDaReferencia(c, nomeArma, instanceId);
  if (cap === null) return { ok: true };
  const atual = tirosRestantes(c, nomeArma, instanceId) ?? cap;
  if (atual <= 0) return { ok: false, reason: `${nomeArma} está descarregada — recarregue antes de atacar.` };
  const restante = atual - 1;
  if (instanceId?.startsWith('legacy:')) {
    const fresh = store.characters.find((x) => x.id === charId) ?? c;
    store.updateCharacter(charId, { weaponAmmo: { ...(fresh.weaponAmmo ?? {}), [instanceId]: restante } });
  }
  else if (instanceId) useInventoryStore.getState().definirMunicao(instanceId, restante);
  else store.updateCharacter(charId, { weaponAmmo: { ...(c.weaponAmmo ?? {}), [nomeArma]: restante } });
  return { ok: true, restante };
}

/** Recarrega a arma, pagando o custo em ações correspondente. */
export function recarregar(charId: string, nomeArma: string, instanceId?: string): { ok: boolean; reason?: string; custo?: CustoRecarga } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c) return { ok: false, reason: 'Ficha não encontrada.' };
  const cap = capacidadeDaReferencia(c, nomeArma, instanceId);
  if (cap === null) return { ok: false, reason: 'Essa arma não usa munição.' };
  const atual = tirosRestantes(c, nomeArma, instanceId) ?? cap;
  if (atual >= cap) return { ok: false, reason: 'A arma já está carregada.' };
  const custo = custoRecarga(c, nomeArma, instanceId);
  if (custo === 'action' && (c.actionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem Ação Comum disponível.' };
  if (custo === 'bonus' && (c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem Ação Bônus disponível.' };
  const patch = {
    ...(custo === 'action' ? { actionsCurrent: Math.max(0, (c.actionsCurrent ?? 0) - 1) } : {}),
    ...(custo === 'bonus' ? { bonusActionsCurrent: Math.max(0, (c.bonusActionsCurrent ?? 0) - 1) } : {}),
  };
  if (instanceId?.startsWith('legacy:')) {
    const fresh = useCharacterStore.getState().characters.find((x) => x.id === charId) ?? c;
    useCharacterStore.getState().updateCharacter(charId, { weaponAmmo: { ...(fresh.weaponAmmo ?? {}), [instanceId]: cap } });
  }
  else if (instanceId) useInventoryStore.getState().definirMunicao(instanceId, cap);
  store.updateCharacter(charId, instanceId ? patch : { ...patch, weaponAmmo: { ...(c.weaponAmmo ?? {}), [nomeArma]: cap } });
  useLogStore.getState().addLog(
    'combat',
    `🔃 ${c.name} recarrega ${nomeArma} (${cap} tiros) — ${rotuloCusto(custo)}${hasRecargaRapida(c) ? ' (Recarga Rápida)' : ''}.`,
  );
  return { ok: true, custo };
}

/**
 * Réplicas Materializáveis (OMNI).
 *
 * O Mestre cria a arma/item no OMNI, liga "Réplica" e define porte, PE de
 * invocação e PE de sustentação por rodada. O jogador só escolhe qual réplica
 * materializar: paga a invocação, a arma surge na mão e, no começo de cada
 * turno dele em combate, paga a sustentação ou deixa a réplica se desfazer.
 * Se a réplica sair das mãos (soltar/desarmar/trocar), ela se desintegra.
 */
import type { EntidadeOmni, ReplicaConfig, ReplicaPorte } from '@/lib/omni/tipos';
import { findWeaponByName, ALL_WEAPONS, requiresTwoHands } from '@/lib/weapons';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore, type InventoryItem } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';

export const PORTES_REPLICA: { id: ReplicaPorte; label: string; invocacao: number; sustentacao: number }[] = [
  { id: 'minusculo', label: 'Minúsculo', invocacao: 1, sustentacao: 1 },
  { id: 'pequeno', label: 'Pequeno', invocacao: 2, sustentacao: 1 },
  { id: 'medio', label: 'Médio', invocacao: 3, sustentacao: 2 },
  { id: 'grande', label: 'Grande', invocacao: 3, sustentacao: 3 },
  { id: 'enorme', label: 'Enorme', invocacao: 4, sustentacao: 4 },
  { id: 'colossal', label: 'Colossal', invocacao: 6, sustentacao: 5 },
];

export function custosDoPorte(porte: ReplicaPorte) {
  return PORTES_REPLICA.find((p) => p.id === porte) ?? PORTES_REPLICA[2];
}

export function replicaPadrao(porte: ReplicaPorte = 'medio'): ReplicaConfig {
  const p = custosDoPorte(porte);
  return { porte, peInvocacao: p.invocacao, peSustentacao: p.sustentacao, desintegrarAoSoltar: true, cobrarPorRodada: true };
}

export function isReplica(ent: EntidadeOmni | null | undefined): boolean {
  return !!ent?.replica;
}

/** Nome da arma do catálogo usada na mão (nome igual ou tag `modelo:`). */
export function replicaWeaponName(ent: EntidadeOmni): string | null {
  const direct = findWeaponByName(ent.nome);
  if (direct) return direct.name;
  const modeloId = (ent.tags ?? []).find((t) => t.startsWith('modelo:'))?.slice(7);
  const w = modeloId ? ALL_WEAPONS.find((x) => x.id === modeloId) : undefined;
  return w?.name ?? null;
}

const log = (msg: string) => useLogStore.getState().addLog('combat', msg);

function patchInst(instanceId: string, patch: Partial<InventoryItem>) {
  useInventoryStore.setState((s) => {
    const cur = s.items[instanceId];
    if (!cur) return s;
    return { items: { ...s.items, [instanceId]: { ...cur, ...patch } } };
  });
}

export function replicasDe(charId: string): InventoryItem[] {
  return Object.values(useInventoryStore.getState().items).filter((i) => i.ownerId === charId && isReplica(i.entity));
}

export type ReplicaResultado = { ok: true } | { ok: false; reason: string };

/** Materializa: paga o PE de invocação e coloca a arma na mão principal. */
export function materializarReplica(instanceId: string): ReplicaResultado {
  const inst = useInventoryStore.getState().items[instanceId];
  const cfg = inst?.entity.replica;
  if (!inst || !cfg) return { ok: false, reason: 'Réplica não encontrada.' };
  if (inst.materializada) return { ok: false, reason: 'Já está materializada.' };
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === inst.ownerId);
  if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
  if ((c.peCurrent ?? 0) < cfg.peInvocacao) return { ok: false, reason: `PE insuficiente (precisa de ${cfg.peInvocacao}).` };

  const weaponName = replicaWeaponName(inst.entity);
  const updates: Parameters<typeof store.updateCharacter>[1] = {
    peCurrent: (c.peCurrent ?? 0) - cfg.peInvocacao,
  };
  if (weaponName) {
    const w = findWeaponByName(weaponName)!;
    updates.mainHandWeaponName = weaponName;
    if (requiresTwoHands(w)) updates.offHandWeaponName = weaponName;
    else if (c.offHandWeaponName === c.mainHandWeaponName) updates.offHandWeaponName = undefined;
  }
  store.updateCharacter(c.id, updates);
  patchInst(instanceId, { materializada: true, sustentacaoPendente: false, replicaArma: weaponName ?? undefined });
  log(`✨ ${c.name} materializou a réplica "${inst.entity.nome}" (−${cfg.peInvocacao} PE${cfg.cobrarPorRodada ? ` · sustentação ${cfg.peSustentacao} PE/rodada` : ''}).`);
  return { ok: true };
}

/** Desfaz a réplica (voluntariamente, por falta de sustentação ou ao soltar). */
export function desfazerReplica(instanceId: string, motivo = 'desfeita'): void {
  const inst = useInventoryStore.getState().items[instanceId];
  if (!inst?.materializada) return;
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === inst.ownerId);
  const arma = inst.replicaArma;
  if (c && arma) {
    const upd: Parameters<typeof store.updateCharacter>[1] = {};
    if (c.mainHandWeaponName === arma) upd.mainHandWeaponName = undefined;
    if (c.offHandWeaponName === arma) upd.offHandWeaponName = undefined;
    if (Object.keys(upd).length) store.updateCharacter(c.id, upd);
  }
  patchInst(instanceId, { materializada: false, sustentacaoPendente: false, replicaArma: undefined });
  log(`💨 A réplica "${inst.entity.nome}"${c ? ` de ${c.name}` : ''} se desintegrou em resquícios de energia amaldiçoada (${motivo}).`);
}

/** Começo do turno do personagem: marca a sustentação como pendente. */
export function inicioTurnoReplicas(charId: string): void {
  for (const inst of replicasDe(charId)) {
    if (inst.materializada && inst.entity.replica?.cobrarPorRodada) {
      patchInst(inst.instanceId, { sustentacaoPendente: true });
    }
  }
}

export function pagarSustentacao(instanceId: string): ReplicaResultado {
  const inst = useInventoryStore.getState().items[instanceId];
  const cfg = inst?.entity.replica;
  if (!inst || !cfg || !inst.materializada) return { ok: false, reason: 'Réplica não materializada.' };
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === inst.ownerId);
  if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
  if ((c.peCurrent ?? 0) < cfg.peSustentacao) return { ok: false, reason: 'PE insuficiente para sustentar.' };
  store.updateCharacter(c.id, { peCurrent: (c.peCurrent ?? 0) - cfg.peSustentacao });
  patchInst(instanceId, { sustentacaoPendente: false });
  log(`🔁 ${c.name} sustentou a réplica "${inst.entity.nome}" (−${cfg.peSustentacao} PE).`);
  return { ok: true };
}

/** Desintegra réplicas materializadas que saíram das mãos do dono. */
export function checarReplicasSoltas(): void {
  const chars = useCharacterStore.getState().characters;
  for (const inst of Object.values(useInventoryStore.getState().items)) {
    if (!inst.materializada || !inst.replicaArma || !inst.entity.replica?.desintegrarAoSoltar) continue;
    const c = chars.find((x) => x.id === inst.ownerId);
    if (!c) continue;
    if (c.mainHandWeaponName !== inst.replicaArma && c.offHandWeaponName !== inst.replicaArma) {
      desfazerReplica(inst.instanceId, 'saiu das mãos');
    }
  }
}

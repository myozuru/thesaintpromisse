import type { Character } from "@/types";
import {
  useInventoryStore,
  type InventoryItem,
} from "@/stores/useInventoryStore";
import { useOmniEntidadesStore } from "@/stores/useOmniEntidadesStore";
const norm = (s: string) => s.trim().toLowerCase();
export const entidadeDoExemplar = (i: InventoryItem) =>
  useOmniEntidadesStore.getState().entidades[i.entity.id] ?? i.entity;
/** Fichas legadas guardam o nome: uma única escolha estável é compartilhada por todos os caminhos. */
export function exemplarArma(
  charId: string,
  nome: string,
): InventoryItem | undefined {
  return useInventoryStore
    .getState()
    .listByOwner(charId)
    .filter((i) => {
      const e = entidadeDoExemplar(i);
      return (
        e.categoria === "arma" &&
        norm(e.replica ? (i.replicaArma ?? "") : e.nome) === norm(nome) &&
        (!e.replica || i.materializada)
      );
    })
    .sort(
      (a, b) =>
        Number(!!b.isEquipped) - Number(!!a.isEquipped) ||
        a.acquiredAt - b.acquiredAt ||
        a.instanceId.localeCompare(b.instanceId),
    )[0];
}
export function exemplarEstaEmpunhado(
  u: Pick<Character, "id" | "mainHandWeaponName" | "offHandWeaponName">,
  i: InventoryItem,
): boolean {
  return [u.mainHandWeaponName, u.offHandWeaponName].some(
    (n) => !!n && exemplarArma(u.id, n)?.instanceId === i.instanceId,
  );
}

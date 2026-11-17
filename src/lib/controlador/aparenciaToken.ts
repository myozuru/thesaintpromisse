import type { Entity, TokenCrop } from "@/stores/useMapStore";
import type { InvocacaoControlador } from "./tipos";

/** A prévia e a peça materializada usam a mesma arte e o mesmo recorte da ficha. */
export function aparenciaTokenInvocacao(
  modelo: InvocacaoControlador,
): Pick<
  Entity,
  "shape" | "color" | "label" | "nameplate" | "assetId" | "invocationFallbackAssetId" | "tokenCrop"
> {
  return {
    shape: modelo.subcategoria === "dez-sombras:fuga-do-coelho" ? "RECT" : modelo.formaToken ?? "ELLIPSE",
    color: modelo.corIdentificacao ?? "#8055bd",
    label: modelo.apelido?.trim() || modelo.nome,
    nameplate: modelo.nomeplate ?? true,
    ...(modelo.imagemAssetId
      ? { assetId: modelo.imagemAssetId }
      : modelo.imagemFallbackAssetId
        ? { assetId: modelo.imagemFallbackAssetId }
        : {}),
    ...(modelo.imagemFallbackAssetId
      ? { invocationFallbackAssetId: modelo.imagemFallbackAssetId }
      : {}),
    ...(modelo.tokenCrop ? { tokenCrop: modelo.tokenCrop as TokenCrop } : {}),
  };
}

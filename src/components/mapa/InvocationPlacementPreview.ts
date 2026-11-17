import type { Character } from "@/types";
import type { Entity, Vector2, useMapStore } from "@/stores/useMapStore";
import { resolverTokenControladorDaFicha } from "@/lib/mapa/tokenDaFicha";
import { aparenciaTokenInvocacao } from "@/lib/controlador/aparenciaToken";
import { celulasFugaCoelhosPorPorte } from "@/lib/controlador/dezSombrasFuga";
import { canvasFontSizeAtScale, UI_READING_FLOOR_PX } from "@/lib/uiTypography";
import { drawEntity } from "./EntityEngine";
import { WallsEngine } from "./WallsEngine";

type PlacementState = Pick<
  ReturnType<typeof useMapStore.getState>,
  "pendingInvocationPlacement" | "gridConfig" | "entities" | "layerVisible" | "walls"
>;

/** Desenha no mundo, a cada frame, inclusive enquanto o cursor está sobre a interface. */
export function drawInvocationPlacementPreview(
  ctx: CanvasRenderingContext2D,
  state: PlacementState,
  characters: readonly Character[],
  cursor: Vector2 | null,
  scale: number,
): void {
  const pending = state.pendingInvocationPlacement;
  const item = pending?.items[pending.placements.length];
  if (!pending || !item) return;
  const character = characters.find((character) => character.id === pending.ownerCharacterId);
  const owner = resolverTokenControladorDaFicha(character, state.entities, state.layerVisible);
  const { dpi, metersPerCell } = state.gridConfig;
  if (
    !owner ||
    !(dpi > 0) ||
    !(metersPerCell > 0) ||
    !Number.isFinite(item.alcanceM) ||
    item.alcanceM < 0
  )
    return;
  const radius = (item.alcanceM / metersPerCell) * dpi;
  const fontPx = canvasFontSizeAtScale(12 / scale, scale, UI_READING_FLOOR_PX);

  ctx.save();
  ctx.beginPath();
  ctx.arc(owner.x, owner.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = item.color;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([7 / scale, 5 / scale]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.font = `bold ${fontPx}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 4 / scale;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.fillStyle = "#ffffff";
  const rangeText = `Alcance de invocação: ${item.alcanceM} m`;
  ctx.strokeText(rangeText, owner.x, owner.y - radius - 8 / scale);
  ctx.fillText(rangeText, owner.x, owner.y - radius - 8 / scale);

  const previewToken = (
    invocationId: string,
    position: Vector2,
    alpha: number,
  ): Entity | undefined => {
    const model = character?.invocacoesConhecidas?.find((model) => model.id === invocationId);
    if (!model) return undefined;
    const cells = model.subcategoria === "dez-sombras:fuga-do-coelho"
      ? celulasFugaCoelhosPorPorte(model.porte)
      : 1;
    const entity: Entity = {
      id: `preview-${invocationId}`,
      ...aparenciaTokenInvocacao(model),
      x: position.x,
      y: position.y,
      w: dpi * cells,
      h: dpi * cells,
      rotation: 0,
      locked: false,
      layer: "tokens",
    };
    ctx.save();
    ctx.globalAlpha = alpha;
    drawEntity(ctx, entity, scale);
    ctx.restore();
    return entity;
  };

  for (const placement of pending.placements) previewToken(placement.invocationId, placement, 0.65);

  if (cursor) {
    const target = { x: Math.round(cursor.x / dpi) * dpi, y: Math.round(cursor.y / dpi) * dpi };
    const distance = (Math.hypot(target.x - owner.x, target.y - owner.y) / dpi) * metersPerCell;
    const occupied =
      Object.values(state.entities).some(
        (entity) =>
          entity.layer !== "map" &&
          !entity.hidden &&
          Math.abs(entity.x - target.x) < (entity.w + dpi) / 2 &&
          Math.abs(entity.y - target.y) < (entity.h + dpi) / 2,
      ) ||
      pending.placements.some(
        (placement) =>
          Math.abs(placement.x - target.x) < dpi && Math.abs(placement.y - target.y) < dpi,
      );
    const blocked =
      WallsEngine.minDistanceToSegments(
        target,
        WallsEngine.blockingSegments(state.walls, "sight"),
      ) <
      dpi * Math.SQRT1_2;
    const valid = distance <= item.alcanceM && !occupied && !blocked;
    const entity = previewToken(item.invocationId, target, valid ? 0.8 : 0.35);
    ctx.strokeStyle = valid ? item.color : "#ef4444";
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    if (entity?.shape === "RECT") ctx.rect(target.x - dpi / 2, target.y - dpi / 2, dpi, dpi);
    else ctx.ellipse(target.x, target.y, dpi / 2, dpi / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    const reason =
      distance > item.alcanceM
        ? "Fora do alcance"
        : occupied
          ? "Célula ocupada"
          : blocked
            ? "Parede ou obstáculo"
            : "Clique para invocar";
    const caption = `${item.label}: ${distance.toFixed(1)} / ${item.alcanceM} m · ${pending.placements.length + 1}/${pending.items.length} · ${reason}`;
    ctx.fillStyle = valid ? "#ffffff" : "#fecaca";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 4 / scale;
    ctx.strokeText(caption, target.x, target.y + dpi / 2 + fontPx + 6 / scale);
    ctx.fillText(caption, target.x, target.y + dpi / 2 + fontPx + 6 / scale);
  }
  ctx.restore();
}

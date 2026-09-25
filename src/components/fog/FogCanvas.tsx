import { useEffect, useMemo, useRef, useState } from "react";
import { useFogStore } from "@/stores/fogStore";
import { useMapStore } from "@/stores/useMapStore";
import { useRoleStore } from "@/stores/useRoleStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { buildSegments, computeVisibilityPolygon, resolveDoor, snapToWallEdge, type WallSnap } from "@/lib/fog/visibility";
import { distToSegment } from "@/lib/fog/math";
import type { Door, Light, Vec2 } from "@/lib/fog/types";

interface Props {
  /** Modo legado (standalone, com background próprio e tamanho fixo). */
  width?: number;
  height?: number;
  /** Quando true, o canvas se comporta como overlay sobre o mapa principal,
   * usando a câmera do useMapStore (pan/zoom) e ocupando todo o container pai. */
  overlay?: boolean;
  /** Quando false, o canvas apenas renderiza o fog (sem capturar mouse). */
  interactive?: boolean;
}

function lightCone(l: Light) {
  return l.shape === "cone"
    ? { direction: l.coneDirection, angle: l.coneAngle }
    : undefined;
}

function fillPoly(ctx: CanvasRenderingContext2D, poly: Vec2[]) {
  if (poly.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fill();
}

function pointInPoly(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function hitWall(w: { points: Vec2[]; closed?: boolean }, p: Vec2, edgeTol = 10) {
  const edges: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 0; i < w.points.length - 1; i++)
    edges.push({ a: w.points[i], b: w.points[i + 1] });
  if (w.closed && w.points.length > 2)
    edges.push({ a: w.points[w.points.length - 1], b: w.points[0] });
  if (edges.some((e) => distToSegment(p, e.a, e.b) < edgeTol)) return true;
  if (w.closed && w.points.length > 2 && pointInPoly(p, w.points)) return true;
  return false;
}

export function FogCanvas({ width = 960, height = 600, overlay = false, interactive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const draggingLightId = useRef<string | null>(null);
  const draggingVertex = useRef<
    | { kind: "wall"; wallId: string; index: number }
    | { kind: "door"; doorId: string; end: "a" | "b" }
    | null
  >(null);
  const shapeDrag = useRef<{ start: Vec2; current: Vec2 } | null>(null);
  const doorDrag = useRef<{ snap: WallSnap; t0: number; t1: number } | null>(null);
  const wallDrag = useRef<{ wallId: string; last: Vec2 } | null>(null);
  const lastDoorClick = useRef<{ t: number; p: Vec2 } | null>(null);
  const [shapePreview, setShapePreview] = useState<Vec2[] | null>(null);
  const [doorPreview, setDoorPreview] = useState<{ a: Vec2; b: Vec2 } | null>(null);

  // Tamanho efetivo: fixo em modo standalone; tamanho do wrapper em overlay.
  const [size, setSize] = useState<{ w: number; h: number }>({ w: width, h: height });

  // Câmera do mapa principal (apenas em overlay).
  const camera = useMapStore((s) => (overlay ? s.camera : null));
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === 'PLAYER';
  const entities = useMapStore((s) => s.entities);
  const dpi = useMapStore((s) => s.gridConfig.dpi);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);


  const {
    walls,
    doors,
    lights,
    tool,
    draft,
    selectedLightId,
    pushDraftPoint,
    commitWall,
    addWall,
    addDoorOnWall,
    addDoorRange,
    addLight,
    moveLight,
    toggleDoor,
    removeDoor,
    updateWallPoint,
    updateDoorPoint,
    snapshot,
    selectLight,
    selectedWallId,
    selectWall,
    removeWall,
    moveWall,
    viewMode,
    // darknessMode removido — agora cada região (parede fechada) tem seu próprio kind.
    undo,
  } = useFogStore();

  // ResizeObserver para overlay (segue o container pai).
  useEffect(() => {
    if (!overlay) {
      setSize({ w: width, h: height });
      return;
    }
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay, width, height]);

  // Portas com posições resolvidas a partir da parede onde estão ancoradas.
  const resolvedDoors = useMemo<(Door & { a: Vec2; b: Vec2 })[]>(
    () => doors.map((d) => ({ ...d, ...resolveDoor(d, walls) })),
    [doors, walls],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = overlay ? (window.devicePixelRatio || 1) : 1;
    const W = size.w;
    const H = size.h;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    if (canvas.width <= 0 || canvas.height <= 0) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Em overlay, aplicamos a transformação da câmera para que os pontos
    // do fog (em coordenadas de mundo) acompanhem o pan/zoom do mapa.
    if (overlay && camera) {
      ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.x * camera.scale, dpr * camera.y * camera.scale);
      // Nota: simplificando: scale + translate em ordem equivalentes a:
      // ctx.scale(dpr); ctx.scale(camera.scale); ctx.translate(camera.x, camera.y);
    } else {
      // Modo standalone: fundo + grid próprio
      ctx.fillStyle = "#1a1f2e";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      const grid = 40;
      for (let x = 0; x < W; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    const invScale = overlay && camera ? 1 / camera.scale : 1;

    // Fog é desenhado em uma camada offscreen, recortado e depois colado.
    const fogPolysAll = walls.filter((w) => w.closed && w.points.length > 2);
    const barrierFogPolys = fogPolysAll.filter((w) => (w.kind ?? "barrier") === "barrier");
    const darknessFogPolys = fogPolysAll.filter((w) => w.kind === "darkness");

    const segments = buildSegments(walls, doors);

    // Visão dos tokens (seer) vira luz primária seguindo o token.
    // Player: somente vê pelos próprios tokens (vinculados pelo ownerProfileId
    //   OU pelo characterId do personagem do perfil ativo).
    // Mestre: vê pelos seers de todos os tokens (visão de cada player) somados
    // às luzes manuais.
    const profileCharacterIds = (() => {
      if (!isPlayer || !activeProfileId) return new Set<string>();
      const chars = useCharacterStore.getState().characters;
      return new Set(
        chars.filter((c) => c.profileId === activeProfileId).map((c) => c.id),
      );
    })();
    const ownedByViewer = (e: typeof entities[string]) => {
      if (!activeProfileId) return false;
      if (e.ownerProfileId === activeProfileId) return true;
      if (e.characterId && profileCharacterIds.has(e.characterId)) return true;
      return false;
    };
    const seerSource = Object.values(entities).filter(
      (e) => !e.hidden && e.seer && ((e.seer.radius > 0) || ((e.seer.darkRadius ?? 0) > 0)) && (!isPlayer || ownedByViewer(e)),
    );

    // Tochas/luzes que tokens carregam (entity.light) — sempre são iluminação real.
    const torchLights: Light[] = Object.values(entities)
      .filter((e) => !e.hidden && e.light && e.light.radius > 0)
      .map((e) => ({
        id: `torch-${e.id}`,
        position: { x: e.x + e.w / 2, y: e.y + e.h / 2 },
        radius: Math.max(1, e.light!.radius) * dpi,
        shape: 'full',
        coneDirection: 0,
        coneAngle: Math.PI * 2,
        edge: 'blurred',
        type: 'primary',
      }));

    // Visão clara de tokens.
    const tokenVisionLights: Light[] = seerSource
      .filter((e) => (e.seer!.radius ?? 0) > 0)
      .map((e) => ({
        id: `vision-${e.id}`,
        position: { x: e.x + e.w / 2, y: e.y + e.h / 2 },
        radius: Math.max(1, e.seer!.radius) * dpi,
        shape: 'full',
        coneDirection: 0,
        coneAngle: Math.PI * 2,
        edge: 'blurred',
        type: 'primary',
      }));

    // Visão no escuro: só atenua a neblina dentro de regiões de escuridão.
    const darkVisionLights: Light[] = seerSource
      .filter((e) => (e.seer!.darkRadius ?? 0) > 0)
      .map((e) => ({
        id: `darkvis-${e.id}`,
        position: { x: e.x + e.w / 2, y: e.y + e.h / 2 },
        radius: Math.max(1, e.seer!.darkRadius!) * dpi,
        shape: 'full',
        coneDirection: 0,
        coneAngle: Math.PI * 2,
        edge: 'blurred',
        type: 'primary',
      }));

    // Iluminação real = luzes manuais (primárias) + tochas em tokens.
    const illuminationPrimary = [...lights.filter((l) => l.type === "primary"), ...torchLights];
    const manualSecondary = lights.filter((l) => l.type === "secondary");

    // Para BARREIRA: visão dos tokens conta como primária (revela como sempre).
    const barrierPrimary = [...illuminationPrimary, ...tokenVisionLights];
    const barrierSecondary = manualSecondary;

    // Para ESCURIDÃO: só iluminação real revela; visão clara do token vira secundária
    // (só conta dentro de área iluminada).
    const darknessPrimary = illuminationPrimary;
    const darknessSecondary = [...manualSecondary, ...tokenVisionLights];

    if (barrierFogPolys.length > 0 || darknessFogPolys.length > 0) {
      const fogOpacity = isPlayer ? 1 : (viewMode === "vision" ? 0.92 : 0.25);
      const fogCanvas = document.createElement("canvas");
      fogCanvas.width = canvas.width;
      fogCanvas.height = canvas.height;
      const fctx = fogCanvas.getContext("2d")!;
      if (overlay && camera) {
        fctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.x * camera.scale, dpr * camera.y * camera.scale);
      }

      const cutWithLight = (l: Light, poly: Vec2[]) => {
        if (poly.length < 3) return;
        fctx.save();
        fctx.globalCompositeOperation = "destination-out";
        if (l.edge === "solid") {
          fctx.fillStyle = "rgba(0,0,0,1)";
        } else {
          const grad = fctx.createRadialGradient(
            l.position.x, l.position.y, 0,
            l.position.x, l.position.y, l.radius,
          );
          grad.addColorStop(0, "rgba(0,0,0,1)");
          grad.addColorStop(0.7, "rgba(0,0,0,0.9)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          fctx.fillStyle = grad;
        }
        fillPoly(fctx, poly);
        fctx.restore();
      };

      const renderFogPass = (
        polys: typeof barrierFogPolys,
        primaries: Light[],
        secondaries: Light[],
      ) => {
        if (polys.length === 0) return;
        fctx.save();
        // Clip às regiões desta passada para que cortes/preenchimentos não vazem.
        fctx.beginPath();
        for (const w of polys) {
          fctx.moveTo(w.points[0].x, w.points[0].y);
          for (let i = 1; i < w.points.length; i++) fctx.lineTo(w.points[i].x, w.points[i].y);
          fctx.closePath();
        }
        fctx.clip();

        fctx.fillStyle = `rgba(0,0,0,${fogOpacity})`;
        for (const w of polys) {
          fctx.beginPath();
          fctx.moveTo(w.points[0].x, w.points[0].y);
          for (let i = 1; i < w.points.length; i++) fctx.lineTo(w.points[i].x, w.points[i].y);
          fctx.closePath();
          fctx.fill();
        }

        const primaryPolys = primaries.map((l) => ({
          light: l,
          poly: computeVisibilityPolygon(l.position, segments, l.radius, lightCone(l)),
        }));
        const secondaryPolys = secondaries.map((l) => ({
          light: l,
          poly: computeVisibilityPolygon(l.position, segments, l.radius, lightCone(l)),
        }));

        for (const { light, poly } of primaryPolys) cutWithLight(light, poly);

        if (secondaryPolys.length > 0 && primaryPolys.length > 0 && canvas.width > 0 && canvas.height > 0) {
          const off = document.createElement("canvas");
          off.width = Math.max(1, canvas.width);
          off.height = Math.max(1, canvas.height);
          const octx = off.getContext("2d")!;
          if (overlay && camera) {
            octx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, dpr * camera.x * camera.scale, dpr * camera.y * camera.scale);
          }

          for (const { light, poly } of secondaryPolys) {
            if (poly.length < 3) continue;
            if (light.edge === "solid") {
              octx.fillStyle = "rgba(255,255,255,1)";
            } else {
              const grad = octx.createRadialGradient(
                light.position.x, light.position.y, 0,
                light.position.x, light.position.y, light.radius,
              );
              grad.addColorStop(0, "rgba(255,255,255,1)");
              grad.addColorStop(0.7, "rgba(255,255,255,0.9)");
              grad.addColorStop(1, "rgba(255,255,255,0)");
              octx.fillStyle = grad;
            }
            fillPoly(octx, poly);
          }

          octx.globalCompositeOperation = "destination-in";
          octx.fillStyle = "white";
          for (const { poly } of primaryPolys) fillPoly(octx, poly);

          fctx.save();
          fctx.setTransform(1, 0, 0, 1, 0, 0);
          fctx.globalCompositeOperation = "destination-out";
          fctx.drawImage(off, 0, 0);
          fctx.restore();
        }

        fctx.restore();
      };

      renderFogPass(barrierFogPolys, barrierPrimary, barrierSecondary);
      renderFogPass(darknessFogPolys, darknessPrimary, darknessSecondary);

      // Visão no escuro: dentro de regiões de escuridão, atenua a neblina (sem revelar).
      if (darkVisionLights.length > 0 && darknessFogPolys.length > 0) {
        const darkVisionPolys = darkVisionLights.map((l) => ({
          light: l,
          poly: computeVisibilityPolygon(l.position, segments, l.radius),
        }));
        const dim = 0.55;
        fctx.save();
        fctx.beginPath();
        for (const w of darknessFogPolys) {
          fctx.moveTo(w.points[0].x, w.points[0].y);
          for (let i = 1; i < w.points.length; i++) fctx.lineTo(w.points[i].x, w.points[i].y);
          fctx.closePath();
        }
        fctx.clip();
        for (const { light, poly } of darkVisionPolys) {
          if (poly.length < 3) continue;
          fctx.save();
          fctx.globalCompositeOperation = "destination-out";
          const grad = fctx.createRadialGradient(
            light.position.x, light.position.y, 0,
            light.position.x, light.position.y, light.radius,
          );
          grad.addColorStop(0, `rgba(0,0,0,${dim})`);
          grad.addColorStop(0.75, `rgba(0,0,0,${dim * 0.65})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          fctx.fillStyle = grad;
          fillPoly(fctx, poly);
          fctx.restore();
        }
        fctx.restore();
      }

      // Cola o fog em coordenadas de tela.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fogCanvas, 0, 0);
      ctx.restore();
    }


    // Player não enxerga paredes/portas/luzes/handles — só fog + mapa.
    if (isPlayer) return;

    // Paredes
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const w of walls) {
      const isSel = w.id === selectedWallId;
      const isDark = w.kind === "darkness";
      ctx.strokeStyle = isSel ? "#60a5fa" : isDark ? "#a78bfa" : "#e2e8f0";
      ctx.lineWidth = (isSel ? 3 : 2) * invScale;
      if (isDark) ctx.setLineDash([10 * invScale, 6 * invScale]);
      ctx.beginPath();
      ctx.moveTo(w.points[0].x, w.points[0].y);
      for (let i = 1; i < w.points.length; i++) ctx.lineTo(w.points[i].x, w.points[i].y);
      if (w.closed) ctx.closePath();
      ctx.stroke();
      if (isDark) ctx.setLineDash([]);
    }

    // Portas
    for (const d of resolvedDoors) {
      ctx.strokeStyle = d.open ? "#22c55e" : "#ef4444";
      ctx.lineWidth = 5 * invScale;
      ctx.lineCap = "butt";
      ctx.setLineDash(d.open ? [6 * invScale, 4 * invScale] : []);
      ctx.beginPath();
      ctx.moveTo(d.a.x, d.a.y);
      ctx.lineTo(d.b.x, d.b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const mx = (d.a.x + d.b.x) / 2;
      const my = (d.a.y + d.b.y) / 2;
      const ang = Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.scale(invScale, invScale);
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#0b1220";
      ctx.lineWidth = 1.2;
      const hw = 14;
      const hh = 10;
      ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
      ctx.strokeRect(-hw / 2, -hh / 2, hw, hh);
      ctx.restore();
    }
    ctx.lineCap = "round";

    // Luzes
    for (const l of lights) {
      const isSelected = l.id === selectedLightId;
      if (l.shape === "cone") {
        ctx.save();
        ctx.strokeStyle = "rgba(251,191,36,0.5)";
        ctx.setLineDash([4 * invScale, 4 * invScale]);
        ctx.lineWidth = 1 * invScale;
        const r = 36 * invScale;
        const a1 = l.coneDirection - l.coneAngle / 2;
        const a2 = l.coneDirection + l.coneAngle / 2;
        ctx.beginPath();
        ctx.moveTo(l.position.x, l.position.y);
        ctx.lineTo(l.position.x + Math.cos(a1) * r, l.position.y + Math.sin(a1) * r);
        ctx.moveTo(l.position.x, l.position.y);
        ctx.lineTo(l.position.x + Math.cos(a2) * r, l.position.y + Math.sin(a2) * r);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.fillStyle = l.type === "secondary" ? "#a78bfa" : "#fbbf24";
      ctx.beginPath();
      ctx.arc(l.position.x, l.position.y, (isSelected ? 8 : 6) * invScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fff" : "rgba(0,0,0,0.6)";
      ctx.lineWidth = (isSelected ? 2 : 1.5) * invScale;
      ctx.stroke();
    }

    // Edit handles
    if (tool === "edit") {
      ctx.fillStyle = "#60a5fa";
      ctx.strokeStyle = "#0b1220";
      ctx.lineWidth = 1.5 * invScale;
      for (const w of walls) {
        for (const p of w.points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5 * invScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#f59e0b";
      for (const d of resolvedDoors) {
        for (const p of [d.a, d.b]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5 * invScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Draft
    if (draft.length > 0) {
      ctx.strokeStyle = tool === "door" ? "#f59e0b" : "#60a5fa";
      ctx.lineWidth = 2 * invScale;
      ctx.setLineDash([4 * invScale, 4 * invScale]);
      ctx.beginPath();
      ctx.moveTo(draft[0].x, draft[0].y);
      for (let i = 1; i < draft.length; i++) ctx.lineTo(draft[i].x, draft[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of draft) {
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * invScale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (shapePreview && shapePreview.length > 2) {
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2 * invScale;
      ctx.setLineDash([6 * invScale, 4 * invScale]);
      ctx.beginPath();
      ctx.moveTo(shapePreview[0].x, shapePreview[0].y);
      for (let i = 1; i < shapePreview.length; i++)
        ctx.lineTo(shapePreview[i].x, shapePreview[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (doorPreview) {
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 5 * invScale;
      ctx.setLineDash([6 * invScale, 4 * invScale]);
      ctx.beginPath();
      ctx.moveTo(doorPreview.a.x, doorPreview.a.y);
      ctx.lineTo(doorPreview.b.x, doorPreview.b.y);
      ctx.stroke();
      ctx.restore();
    }
  }, [walls, doors, lights, draft, tool, selectedLightId, selectedWallId, shapePreview, doorPreview, size.w, size.h, viewMode, overlay, camera?.x, camera?.y, camera?.scale, isPlayer, entities, dpi, activeProfileId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedWallId) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        e.preventDefault();
        removeWall(selectedWallId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedWallId, removeWall]);

  const getPos = (e: React.MouseEvent): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (overlay && camera) {
      return { x: sx / camera.scale - camera.x, y: sy / camera.scale - camera.y };
    }
    return {
      x: (sx / rect.width) * size.w,
      y: (sy / rect.height) * size.h,
    };
  };

  const rectPoints = (a: Vec2, b: Vec2): Vec2[] => {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  };

  const ellipsePoints = (a: Vec2, b: Vec2, n = 32): Vec2[] => {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    const out: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      out.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
    }
    return out;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return;
    const p = getPos(e);

    if (tool === "rect" || tool === "ellipse") {
      shapeDrag.current = { start: p, current: p };
      setShapePreview([p, p, p, p]);
      return;
    }

    if (tool === "edit") {
      const HIT = (overlay && camera ? 10 / camera.scale : 10);
      for (const w of walls) {
        for (let i = 0; i < w.points.length; i++) {
          const pt = w.points[i];
          if (Math.hypot(pt.x - p.x, pt.y - p.y) < HIT) {
            snapshot();
            draggingVertex.current = { kind: "wall", wallId: w.id, index: i };
            return;
          }
        }
      }
      for (const d of resolvedDoors) {
        if (Math.hypot(d.a.x - p.x, d.a.y - p.y) < HIT) {
          snapshot();
          draggingVertex.current = { kind: "door", doorId: d.id, end: "a" };
          return;
        }
        if (Math.hypot(d.b.x - p.x, d.b.y - p.y) < HIT) {
          snapshot();
          draggingVertex.current = { kind: "door", doorId: d.id, end: "b" };
          return;
        }
      }
      return;
    }

    if (tool === "move-light" || tool === "select") {
      const tol = overlay && camera ? 12 / camera.scale : 12;
      const hit = lights.find((l) => Math.hypot(l.position.x - p.x, l.position.y - p.y) < tol);
      if (hit) {
        selectLight(hit.id);
        if (tool === "select") selectWall(null);
        draggingLightId.current = hit.id;
        return;
      }
      if (tool === "select") {
        if (selectedWallId) {
          const sel = walls.find((w) => w.id === selectedWallId);
          if (sel && hitWall(sel, p, overlay && camera ? 10 / camera.scale : 10)) {
            snapshot();
            wallDrag.current = { wallId: selectedWallId, last: p };
            return;
          }
        }
        const doorTol = overlay && camera ? 10 / camera.scale : 10;
        const door = resolvedDoors.find((d) => distToSegment(p, d.a, d.b) < doorTol);
        if (door) {
          toggleDoor(door.id);
          return;
        }
        selectLight(null);
        selectWall(null);
      }
      return;
    }

    if (tool === "door") {
      // Duplo clique sobre parede: transforma somente o segmento clicado em porta inteira.
      const now = performance.now();
      const prev = lastDoorClick.current;
      const dblTol = overlay && camera ? 6 / camera.scale : 6;
      const isDbl =
        !!prev &&
        now - prev.t < 250 &&
        Math.hypot(p.x - prev.p.x, p.y - prev.p.y) < dblTol;
      lastDoorClick.current = { t: now, p };
      if (isDbl) {
        // O primeiro clique do duplo-clique já pode ter criado uma porta — desfaz.
        undo();
        const snapTolSel = overlay && camera ? 12 / camera.scale : 12;
        const snapSel = snapToWallEdge(p, walls, snapTolSel);
        if (snapSel) {
          addDoorRange(snapSel.wallId, snapSel.segIndex, 0, 1);
        }
        doorDrag.current = null;
        setDoorPreview(null);
        lastDoorClick.current = null;
        return;
      }
      const doorTol = overlay && camera ? 10 / camera.scale : 10;
      const existing = resolvedDoors.find((d) => distToSegment(p, d.a, d.b) < doorTol);
      if (existing) {
        toggleDoor(existing.id);
        return;
      }
      const snapTol = overlay && camera ? 18 / camera.scale : 18;
      const snap = snapToWallEdge(p, walls, snapTol);
      if (snap) {
        doorDrag.current = { snap, t0: snap.t, t1: snap.t };
        const pt = {
          x: snap.a.x + (snap.b.x - snap.a.x) * snap.t,
          y: snap.a.y + (snap.b.y - snap.a.y) * snap.t,
        };
        setDoorPreview({ a: pt, b: pt });
      }
      return;
    }

    if (tool === "wall") {
      pushDraftPoint(p);
      return;
    }

    if (tool === "light") {
      addLight(p);
      return;
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (wallDrag.current) {
      const p = getPos(e);
      const dx = p.x - wallDrag.current.last.x;
      const dy = p.y - wallDrag.current.last.y;
      if (dx !== 0 || dy !== 0) {
        moveWall(wallDrag.current.wallId, dx, dy);
        wallDrag.current.last = p;
      }
      return;
    }
    if (shapeDrag.current) {
      const p = getPos(e);
      shapeDrag.current.current = p;
      const pts =
        tool === "ellipse"
          ? ellipsePoints(shapeDrag.current.start, p)
          : rectPoints(shapeDrag.current.start, p);
      setShapePreview(pts);
      return;
    }
    if (doorDrag.current) {
      const p = getPos(e);
      const { snap } = doorDrag.current;
      const dx = snap.b.x - snap.a.x;
      const dy = snap.b.y - snap.a.y;
      const l2 = dx * dx + dy * dy;
      let t = ((p.x - snap.a.x) * dx + (p.y - snap.a.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      doorDrag.current.t1 = t;
      const lo = Math.min(doorDrag.current.t0, t);
      const hi = Math.max(doorDrag.current.t0, t);
      setDoorPreview({
        a: { x: snap.a.x + dx * lo, y: snap.a.y + dy * lo },
        b: { x: snap.a.x + dx * hi, y: snap.a.y + dy * hi },
      });
      return;
    }
    if (draggingVertex.current) {
      const p = getPos(e);
      const v = draggingVertex.current;
      if (v.kind === "wall") updateWallPoint(v.wallId, v.index, p);
      else updateDoorPoint(v.doorId, v.end, p);
      return;
    }
    if (draggingLightId.current) {
      moveLight(draggingLightId.current, getPos(e));
    }
  };

  const onMouseUp = () => {
    if (shapeDrag.current) {
      const { start, current } = shapeDrag.current;
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      if (w > 4 && h > 4) {
        const pts =
          tool === "ellipse" ? ellipsePoints(start, current) : rectPoints(start, current);
        addWall(pts, true);
      }
      shapeDrag.current = null;
      setShapePreview(null);
    }
    if (doorDrag.current) {
      const { snap, t0, t1 } = doorDrag.current;
      const dragged = Math.abs(t1 - t0) * snap.edgeLen;
      if (dragged < 6) {
        addDoorOnWall({
          x: snap.a.x + (snap.b.x - snap.a.x) * snap.t,
          y: snap.a.y + (snap.b.y - snap.a.y) * snap.t,
        });
      } else {
        addDoorRange(snap.wallId, snap.segIndex, t0, t1);
      }
      doorDrag.current = null;
      setDoorPreview(null);
    }
    draggingLightId.current = null;
    draggingVertex.current = null;
    wallDrag.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool === "wall" && draft.length >= 2) {
      commitWall(false);
      return;
    }
    if (tool === "door") {
      // A conversão da parede em porta inteira já é tratada no segundo mousedown.
      return;
    }
    if (tool === "select") {
      const p = getPos(e);
      const snapTol = overlay && camera ? 12 / camera.scale : 12;
      const snap = snapToWallEdge(p, walls, snapTol);
      let wallId = snap?.wallId ?? null;
      if (!wallId) {
        for (let i = walls.length - 1; i >= 0; i--) {
          if (hitWall(walls[i], p, 0)) {
            wallId = walls[i].id;
            break;
          }
        }
      }
      if (wallId) {
        selectWall(wallId);
        selectLight(null);
      }
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = getPos(e);
    const doorTol = overlay && camera ? 10 / camera.scale : 10;
    const door = resolvedDoors.find((d) => distToSegment(p, d.a, d.b) < doorTol);
    if (door) {
      removeDoor(door.id);
      return;
    }
    if (tool === "wall" && draft.length >= 3) commitWall(true);
  };

  if (overlay) {
    return (
      <div ref={wrapperRef} className={`absolute inset-0 ${interactive ? "" : "pointer-events-none"}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={interactive ? onMouseDown : undefined}
          onMouseMove={interactive ? onMouseMove : undefined}
          onMouseUp={interactive ? onMouseUp : undefined}
          onMouseLeave={interactive ? onMouseUp : undefined}
          onDoubleClick={interactive ? onDoubleClick : undefined}
          onContextMenu={interactive ? onContextMenu : undefined}
          className={`absolute inset-0 touch-none select-none ${interactive ? "cursor-crosshair" : "pointer-events-none"}`}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size.w}
      height={size.h}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className="w-full h-auto rounded-lg border border-border cursor-crosshair touch-none select-none"
    />
  );
}

import { Crosshair, Ruler, X } from "lucide-react";
import { useMemo, useState } from "react";
import { resetarEconomiaManualInvocacao } from "@/lib/controlador/mapa";
import { distanciaCircularMetros } from "@/lib/mapa/alcanceCircular";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useMapStore } from "@/stores/useMapStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useRoleStore } from "@/stores/useRoleStore";
import { useShikigamiHudStore } from "@/stores/useShikigamiHudStore";

const ACTION_POOLS = [
  ["acaoComum", "Ação Comum"],
  ["acaoSimples", "Ação Simples"],
  ["acaoComplexa", "Ação Complexa"],
  ["acaoMovimento", "Movimento"],
  ["acaoBonus", "Ação Bônus"],
  ["acaoLivre", "Ação Livre"],
  ["reacao", "Reação"],
] as const;

export function ShikigamiOwnerPanel({ tokenId }: { tokenId: string }) {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const token = useMapStore((state) => state.entities[tokenId]);
  const entities = useMapStore((state) => state.entities);
  const grid = useMapStore((state) => state.gridConfig);
  const characters = useCharacterStore((state) => state.characters);
  const role = useRoleStore((state) => state.role);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const sourceTokenId = useShikigamiHudStore((state) => state.sourceTokenId);
  const selectedTargetId = useShikigamiHudStore((state) => state.selectedTargetId);
  const rangeMode = useShikigamiHudStore((state) => state.rangeMode);
  const interaction = useShikigamiHudStore((state) => state.interaction);
  const measurementPoint = useShikigamiHudStore((state) => state.measurementPoint);
  const error = useShikigamiHudStore((state) => state.error);
  const setRangeMode = useShikigamiHudStore((state) => state.setRangeMode);
  const startTargetSelection = useShikigamiHudStore((state) => state.startTargetSelection);
  const startMeasurement = useShikigamiHudStore((state) => state.startMeasurement);
  const clearTarget = useShikigamiHudStore((state) => state.clearTarget);

  const owner = characters.find((character) => character.id === token?.ownerCharId);
  const model = owner?.invocacoesConhecidas?.find(
    (invocation) => invocation.id === token?.invocationId,
  );
  const instance = owner?.instanciasInvocacao?.find(
    (item) => item.id === token?.invocationInstanceId,
  );
  const target = selectedTargetId ? entities[selectedTargetId] : undefined;
  const action =
    rangeMode?.kind === "action"
      ? model?.acoes.find((item) => item.id === rangeMode.actionId)
      : undefined;
  const rangeMeters = rangeMode?.kind === "movement" ? model?.deslocamentoM : action?.alcanceM;
  const measuredPoint = target ? { x: target.x, y: target.y } : measurementPoint;
  const measuredMeters =
    token && measuredPoint ? distanciaCircularMetros(token, measuredPoint, grid) : null;

  const resources = useMemo(() => model?.recursosConfigurados ?? [], [model?.recursosConfigurados]);
  const hasManualReset = Boolean(
    model &&
    (Object.values(model.economiaAcoesConfigurada?.resetPorCategoria ?? {}).includes("manual") ||
      model.acoes.some(
        (invocationAction) => invocationAction.recargaConfigurada?.unidade === "manual",
      ) ||
      resources.some((resource) => resource.recargaConfigurada?.unidade === "manual")),
  );

  if (!token?.invocationId || !owner || !model || sourceTokenId !== token.id) return null;
  if (
    role === "PLAYER" &&
    (owner.profileId !== activeProfileId ||
      (token.ownerProfileId && token.ownerProfileId !== activeProfileId))
  )
    return null;

  const targetRangeLabel =
    rangeMeters === undefined
      ? "Sem alcance definido"
      : measuredMeters === null
        ? `${rangeMeters} m de alcance`
        : `${measuredMeters.toFixed(1)} m${rangeMeters !== undefined ? ` / ${rangeMeters} m` : ""}${rangeMeters !== undefined && measuredMeters > rangeMeters + 0.05 ? " · fora de alcance" : ""}`;

  return (
    <section className="min-w-0 space-y-4" data-testid="shikigami-owner-panel">
      <header className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h3 className="break-words font-display text-lg font-semibold leading-snug text-foreground">
            {model.apelido?.trim() || model.nome}
          </h3>
          <p className="mt-1 break-words text-base text-muted-foreground">
            Controlador: {owner.name}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-sm ${token.invocationState === "caida" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}
        >
          {token.invocationState === "caida" ? "Caído" : "Ativo"}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/30 p-3">
        <div className="min-w-0">
          <dt className="text-sm text-muted-foreground">Pontos de vida</dt>
          <dd className="mt-1 font-mono text-xl tabular-nums text-foreground">
            {token.hp ?? instance?.hpAtual ?? model.hpAtual}
            <span className="text-base text-muted-foreground">
              {" "}
              / {token.hpMax ?? instance?.hpMaximoAtual ?? model.hpMaximo}
            </span>
          </dd>
          {(instance?.pvTemporarios ?? token.invocationTempHp ?? 0) > 0 && (
            <dd className="mt-1 text-sm text-muted-foreground">
              PVT {instance?.pvTemporarios ?? token.invocationTempHp}
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-muted-foreground">Defesa</dt>
          <dd className="mt-1 font-mono text-xl tabular-nums text-accent">
            {token.invocationDefense ?? model.defesa}
          </dd>
        </div>
      </dl>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {ACTION_POOLS.map(([key, label]) => {
          const saldo = instance?.economiaAcoes?.[key];
          if (!saldo) return null;
          return (
            <span
              key={key}
              className="max-w-full break-words rounded border border-border/70 bg-background/70 px-2 py-1.5 text-base text-muted-foreground"
            >
              {label}{" "}
              <strong className="text-foreground">
                {saldo.atual}/{saldo.maximo}
              </strong>
            </span>
          );
        })}
      </div>

      {resources.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {resources.map((resource) => {
            const current = instance?.recursosAtuais?.[resource.id] ?? resource.valorInicial;
            return (
              <span
                key={resource.id}
                className="max-w-full break-words rounded border border-border/70 bg-background/70 px-2 py-1.5 text-base text-muted-foreground"
              >
                {resource.nome}{" "}
                <strong className="text-foreground">
                  {current}
                  {resource.valorMaximo === undefined ? "" : `/${resource.valorMaximo}`}
                </strong>
              </span>
            );
          })}
        </div>
      )}

      {hasManualReset && instance?.estado === "ativa" && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => {
              const resultado = resetarEconomiaManualInvocacao(owner.id, token.id);
              setFeedback({
                ok: resultado.ok,
                message: resultado.ok ? "Reset manual aplicado à instância." : resultado.motivo,
              });
            }}
            className="min-h-11 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-base text-foreground hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            Aplicar reset manual
          </button>
          {feedback && (
            <p
              role={feedback.ok ? "status" : "alert"}
              className={`mt-1 text-xs ${feedback.ok ? "text-emerald-300" : "text-rose-300"}`}
            >
              {feedback.message}
            </p>
          )}
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={startTargetSelection}
          aria-pressed={interaction === "target"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${interaction === "target" ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background text-foreground hover:bg-secondary"}`}
        >
          <Crosshair className="h-3.5 w-3.5" /> Alvo
        </button>
        <button
          type="button"
          onClick={startMeasurement}
          aria-pressed={interaction === "measure"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${interaction === "measure" ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background text-foreground hover:bg-secondary"}`}
        >
          <Ruler className="h-3.5 w-3.5" /> Medir
        </button>
        {(target || measurementPoint) && (
          <button
            type="button"
            onClick={clearTarget}
            title="Limpar alvo e medição"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-base text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setRangeMode({ kind: "movement" })}
          aria-pressed={rangeMode?.kind === "movement"}
          className={`min-h-11 w-full whitespace-normal break-words rounded-md border px-3 py-2 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${rangeMode?.kind === "movement" ? "border-primary/40 bg-primary/15 text-foreground" : "border-border bg-secondary/40 text-foreground hover:bg-secondary"}`}
        >
          Movimento · {model.deslocamentoM} m
        </button>
        {model.acoes.map((invocationAction) => (
          <button
            type="button"
            key={invocationAction.id}
            onClick={() => setRangeMode({ kind: "action", actionId: invocationAction.id })}
            aria-pressed={
              rangeMode?.kind === "action" && rangeMode.actionId === invocationAction.id
            }
            className={`min-h-11 w-full whitespace-normal break-words rounded-md border px-3 py-2 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${rangeMode?.kind === "action" && rangeMode.actionId === invocationAction.id ? "border-primary/40 bg-primary/15 text-foreground" : "border-border bg-secondary/40 text-foreground hover:bg-secondary"}`}
          >
            {invocationAction.nome}
            {invocationAction.alcanceM !== undefined && (
              <>
                {" "}
                <span className="whitespace-nowrap">· {invocationAction.alcanceM} m</span>
              </>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {interaction === "target"
          ? "Clique em um token para defini-lo como alvo."
          : interaction === "measure"
            ? "Clique no mapa para medir a distância."
            : target
              ? `Alvo: ${target.label || "Token"} · ${targetRangeLabel}`
              : measurementPoint
                ? `Medição: ${measuredMeters?.toFixed(1) ?? "—"} m`
                : `Arraste o token para mover até ${model.deslocamentoM} m por Ação de Movimento.`}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-300">
          {error}
        </p>
      )}
    </section>
  );
}

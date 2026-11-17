import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Crosshair, MapPin, Shield, Sparkles, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Character } from "@/types";
import type { InvocacaoControlador } from "@/lib/controlador/tipos";
import { limiteAtivasPersonagem } from "@/lib/controlador/tipos";
import { alcancePosicionamentoInvocacao } from "@/lib/controlador/alcanceInvocacao";
import { validarIntermediarioInvocacao } from "@/lib/controlador/intermediario";
import { podeUsarVersaoAprovada } from "@/lib/controlador/aprovacao";
import { tempoAdicionalEmSegundos } from "@/lib/controlador/tempo";
import { invocarControladores } from "@/lib/controlador/mapa";
import { prepararArteInvocacao } from "@/lib/controlador/assetFicha";
import { assetCache } from "@/components/mapa/assetCache";
import { findMyCharacter } from "@/lib/myCharacter";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { useMapStore, type Entity } from "@/stores/useMapStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useRoleStore } from "@/stores/useRoleStore";
import { cn } from "@/lib/utils";
import { resolverTokenControladorDaFicha } from "@/lib/mapa/tokenDaFicha";

type Phase = "idle" | "preparing" | "placing";

function makeEventId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `evento-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hordeLinkedModels(character: Character, activeTokens: Entity[]) {
  const ids = new Set<string>();
  for (const instance of character.instanciasInvocacao ?? []) {
    if (!instance.composicaoHorda || instance.estado === "dissipada") continue;
    ids.add(instance.composicaoHorda.liderModeloId);
    instance.composicaoHorda.membros.forEach((member) => ids.add(member.modeloId));
  }
  for (const token of activeTokens) {
    if (!token.invocationHordeId) continue;
    if (token.invocationId) ids.add(token.invocationId);
    token.invocationHordeMemberIds?.forEach((id) => ids.add(id));
  }
  return ids;
}

export function InvocationQuickHud() {
  const role = useRoleStore((state) => state.role);
  const isMaster = role === "MASTER";
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const characters = useCharacterStore((state) => state.characters);
  const inventory = useInventoryStore((state) => state.items);
  const entities = useMapStore((state) => state.entities);
  const layerVisible = useMapStore((state) => state.layerVisible);
  const mapSelection = useMapStore((state) => state.selectedIds);
  const pendingInvocation = useMapStore((state) => state.pendingInvocationPlacement);
  const pendingAoE = useMapStore((state) => state.pendingAoEPlacement);

  const [open, setOpen] = useState(false);
  const [masterCharacterId, setMasterCharacterId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const cancelPreparationRef = useRef(false);
  const submittingRef = useRef(false);
  const previousOwnerIdRef = useRef("");

  const myCharacter = useMemo(
    () => (isMaster ? null : findMyCharacter(characters, activeProfileId)),
    [isMaster, characters, activeProfileId],
  );
  const masterCharacters = useMemo(
    () =>
      isMaster
        ? characters.filter((character) => (character.invocacoesConhecidas?.length ?? 0) > 0)
        : [],
    [isMaster, characters],
  );
  const selectedMapEntity = useMemo(
    () => mapSelection.map((id) => entities[id]).find(Boolean),
    [mapSelection, entities],
  );
  const inferredOwnerId = selectedMapEntity
    ? selectedMapEntity.invocationId
      ? selectedMapEntity.ownerCharId
      : (selectedMapEntity.characterId ?? selectedMapEntity.ownerCharId)
    : undefined;
  const masterCharacter = isMaster
    ? (masterCharacters.find((character) => character.id === masterCharacterId) ??
      masterCharacters.find((character) => character.id === inferredOwnerId) ??
      masterCharacters[0] ??
      null)
    : null;
  const character = isMaster ? masterCharacter : myCharacter;
  const ownerId = character?.id ?? "";
  const catalog = character?.invocacoesConhecidas ?? [];
  const activeTokens = useMemo(
    () =>
      character
        ? Object.values(entities).filter(
            (entity) => entity.ownerCharId === character.id && !!entity.invocationId,
          )
        : [],
    [entities, character],
  );
  const hasControllerToken = useMemo(
    () => Boolean(resolverTokenControladorDaFicha(character, entities, layerVisible)),
    [entities, character, layerVisible],
  );
  const activeLimit = character
    ? limiteAtivasPersonagem(character.specialization, character.treinoControle ?? 0)
    : 0;
  const currentPe = Math.max(0, Number.isFinite(character?.peCurrent) ? character!.peCurrent : 0);
  const selectedModels = catalog.filter((model) => selectedIds.includes(model.id));
  const selectedCost = selectedModels.reduce((total, model) => total + model.custoInvocacaoPE, 0);
  const linkedToHorde = useMemo(
    () => (character ? hordeLinkedModels(character, activeTokens) : new Set<string>()),
    [character, activeTokens],
  );

  useEffect(() => {
    if (previousOwnerIdRef.current && previousOwnerIdRef.current !== ownerId) {
      setSelectedIds([]);
      setOverrideReasons({});
      setFeedback("");
      setError("");
      if (phase === "preparing") cancelPreparationRef.current = true;
    }
    previousOwnerIdRef.current = ownerId;
  }, [ownerId, phase]);

  const eligibility = useMemo(() => {
    const result = new Map<string, { blocked?: string; intermediary?: string }>();
    if (!character) return result;
    const known = character.invocacoesConhecidas ?? [];
    for (const model of known) {
      const active = activeTokens.some((token) => token.invocationId === model.id);
      const defeatedPending = character.instanciasInvocacao?.some(
        (instance) =>
          instance.modeloId === model.id &&
          instance.estado === "derrotada" &&
          !instance.resolucaoDerrota,
      );
      const waitingAfterHorde = character.instanciasInvocacao?.some((instance) =>
        instance.membrosHordaRemovidos?.some(
          (member) => member.modeloId === model.id && member.bloqueioRodadas > 0,
        ),
      );
      const approved = podeUsarVersaoAprovada({
        estado: model.aprovacaoMestre,
        versaoAtual: model.versaoModelo,
        versaoAprovada: model.versaoAprovada,
      });
      const intermediary = validarIntermediarioInvocacao(model, character, inventory, known);
      let blocked: string | undefined;

      if (model.donoCharacterId !== character.id)
        blocked = "Esta ficha não pertence ao personagem selecionado.";
      else if (!hasControllerToken) blocked = "Coloque o token do Controlador no mapa primeiro.";
      else if (model.domado === false) blocked = "Ainda precisa ser domado no ritual.";
      else if (linkedToHorde.has(model.id))
        blocked = "Esta invocação já está vinculada a uma Horda.";
      else if (waitingAfterHorde)
        blocked = "Aguarde uma rodada após a saída deste membro da Horda.";
      else if (model.perdaPermanente)
        blocked = "Esta invocação foi declarada como perda permanente.";
      else if (defeatedPending) blocked = "A derrota aguarda decisão do Mestre.";
      else if (active) blocked = "Esta invocação já está no mapa.";
      else if (!approved) blocked = "A versão atual ainda não foi aprovada pelo Mestre.";
      else if (!Number.isFinite(model.custoInvocacaoPE) || model.custoInvocacaoPE < 0)
        blocked = "O custo de PE desta ficha é inválido.";
      else if (
        !Number.isFinite(alcancePosicionamentoInvocacao(model)) ||
        alcancePosicionamentoInvocacao(model) < 0
      )
        blocked = "Defina o alcance de posicionamento na ficha.";
      else {
        const time = tempoAdicionalEmSegundos(model.tempoAdicional);
        if (!time.ok) blocked = time.motivo;
      }

      result.set(model.id, {
        blocked,
        intermediary: intermediary.ok ? undefined : intermediary.motivo,
      });
    }
    return result;
  }, [character, activeTokens, hasControllerToken, inventory, linkedToHorde]);

  const setSelectedCharacter = (id: string) => {
    setMasterCharacterId(id);
    setSelectedIds([]);
    setOverrideReasons({});
    setFeedback("");
    setError("");
  };

  const canSelect = (model: InvocacaoControlador) => {
    const selected = selectedIds.includes(model.id);
    if (selected) return undefined;
    const status = eligibility.get(model.id);
    if (status?.blocked) return status.blocked;
    if (status?.intermediary && !isMaster) return status.intermediary;
    if (pendingInvocation || pendingAoE || phase !== "idle")
      return "Conclua ou cancele o posicionamento atual primeiro.";
    if (selectedIds.length >= 2) return "Você pode posicionar até duas invocações por uso.";
    if (activeTokens.length + selectedIds.length >= activeLimit)
      return "O limite de invocações ativas já foi atingido.";
    if (selectedCost + model.custoInvocacaoPE > currentPe)
      return "PE insuficiente para incluir esta invocação.";
    return undefined;
  };

  const toggleModel = (model: InvocacaoControlador) => {
    setError("");
    setFeedback("");
    if (selectedIds.includes(model.id)) {
      setSelectedIds((current) => current.filter((id) => id !== model.id));
      return;
    }
    const blocked = canSelect(model);
    if (blocked) {
      setError(blocked);
      return;
    }
    setSelectedIds((current) => (current.length < 2 ? [...current, model.id] : current));
  };

  const cancelPlacement = () => {
    if (phase === "preparing") {
      cancelPreparationRef.current = true;
      setFeedback("Cancelando preparação das imagens…");
      return;
    }
    if (useMapStore.getState().pendingInvocationPlacement) {
      useMapStore.getState().resolveInvocationPlacement(null);
      setFeedback("Posicionamento cancelado.");
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (phase !== "idle" || useMapStore.getState().pendingInvocationPlacement))
      return;
    setOpen(nextOpen);
  };

  const startPlacement = async () => {
    if (submittingRef.current) return;
    setError("");
    setFeedback("");
    if (!character) {
      setError(
        isMaster
          ? "Selecione uma ficha com invocações conhecidas."
          : "Não encontrei sua ficha de personagem neste perfil.",
      );
      return;
    }
    if (selectedIds.length < 1 || selectedIds.length > 2) {
      setError("Selecione uma ou duas invocações.");
      return;
    }
    if (pendingInvocation || pendingAoE) {
      setError(
        "Já existe um posicionamento em andamento no mapa. Conclua ou cancele antes de iniciar outro.",
      );
      return;
    }

    const models = selectedIds.map((id) => catalog.find((model) => model.id === id));
    if (models.some((model): model is undefined => !model)) {
      setError("Uma invocação selecionada não está mais na ficha. Atualize a seleção.");
      setSelectedIds([]);
      return;
    }
    const chosen = models as InvocacaoControlador[];
    const usedSlots = activeTokens.length + chosen.length;
    const totalCost = chosen.reduce((total, model) => total + model.custoInvocacaoPE, 0);
    if (!hasControllerToken) {
      setError("Coloque o token do Controlador no mapa primeiro.");
      return;
    }
    if (usedSlots > activeLimit) {
      setError("O lote ultrapassa o limite de invocações ativas.");
      return;
    }
    if (currentPe < totalCost) {
      setError("PE insuficiente para o lote selecionado.");
      return;
    }
    for (const model of chosen) {
      const status = eligibility.get(model.id);
      if (status?.blocked) {
        setError(`${model.apelido?.trim() || model.nome}: ${status.blocked}`);
        return;
      }
      if (status?.intermediary && !overrideReasons[model.id]?.trim()) {
        setError(
          isMaster
            ? `Informe o motivo do Mestre para autorizar ${model.apelido?.trim() || model.nome}.`
            : `${model.apelido?.trim() || model.nome}: ${status.intermediary}`,
        );
        return;
      }
    }

    const currentMap = useMapStore.getState();
    if (currentMap.pendingInvocationPlacement || currentMap.pendingAoEPlacement) {
      setError("Outro posicionamento começou no mapa. Conclua ou cancele antes de iniciar este.");
      return;
    }

    cancelPreparationRef.current = false;
    submittingRef.current = true;
    setPhase("preparing");
    const canStillUseOwner = () => {
      const currentRole = useRoleStore.getState().role;
      if (currentRole === "MASTER") return true;
      return (
        currentRole === "PLAYER" &&
        findMyCharacter(
          useCharacterStore.getState().characters,
          useProfileStore.getState().activeProfileId,
        )?.id === character.id
      );
    };
    try {
      await Promise.all(chosen.map(model => prepararArteInvocacao(model)));
      if (cancelPreparationRef.current) {
        setFeedback("Preparação cancelada.");
        return;
      }
      if (!canStillUseOwner()) {
        setError("O perfil mudou. Selecione novamente as invocações da sua ficha.");
        return;
      }

      const mapNow = useMapStore.getState();
      if (mapNow.pendingInvocationPlacement || mapNow.pendingAoEPlacement) {
        setError(
          "Outro posicionamento começou durante a preparação. Conclua ou cancele antes de tentar novamente.",
        );
        return;
      }

      setPhase("placing");
      const placements = await mapNow.requestInvocationPlacement({
        ownerCharacterId: character.id,
        items: chosen.map((model) => ({
          invocationId: model.id,
          label: model.apelido?.trim() || model.nome,
          alcanceM: alcancePosicionamentoInvocacao(model),
          color: model.corIdentificacao ?? "#8055bd",
        })),
      });
      if (!placements) {
        setFeedback("Posicionamento cancelado.");
        return;
      }
      if (!canStillUseOwner()) {
        setError("O perfil mudou; a invocação foi cancelada sem cobrar PE.");
        return;
      }

      const eventId = makeEventId();
      const reasons = Object.fromEntries(
        chosen.map((model) => [model.id, overrideReasons[model.id] ?? ""]),
      );
      const result = invocarControladores(
        character.id,
        placements.map((placement) => ({
          invocacaoId: placement.invocationId,
          x: placement.x,
          y: placement.y,
        })),
        { eventoId: eventId, motivosOverrideIntermediario: reasons },
      );
      if (!result.ok) {
        setError(result.motivo);
        return;
      }

      setSelectedIds([]);
      setOverrideReasons({});
      setFeedback(
        `${chosen.length === 1 ? "Invocação materializada" : "Invocações materializadas"} no mapa. Ação Livre; PE cobrado pelo lote.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível preparar o posicionamento das invocações.",
      );
    } finally {
      submittingRef.current = false;
      setPhase("idle");
    }
  };

  const selectedTotal = selectedModels.reduce((total, model) => total + model.custoInvocacaoPE, 0);
  const pendingOwnerName = isMaster
    ? characters.find((item) => item.id === pendingInvocation?.ownerCharacterId)?.name
    : undefined;
  const pendingNext = pendingInvocation?.items[pendingInvocation.placements.length];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Abrir HUD de invocação"
          aria-expanded={open}
          title="Invocar diretamente no mapa"
          className={cn(
            "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            open || pendingInvocation
              ? "border-primary/50 bg-primary/15 text-primary-foreground shadow-sm"
              : "border-primary/30 bg-primary/10 text-foreground hover:border-primary/60 hover:bg-primary/20",
          )}
        >
          <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
          <span>Invocar</span>
          {pendingInvocation && (
            <span aria-label="Posicionamento ativo" className="h-2 w-2 rounded-full bg-accent" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        id="map-invocation-quick-panel"
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(28rem,calc(100vw-1rem))] max-h-[min(82vh,44rem)] overflow-y-auto overscroll-contain border-border/80 bg-popover p-4 shadow-xl shadow-black/40"
        onEscapeKeyDown={(event) => {
          if (phase !== "idle" || useMapStore.getState().pendingInvocationPlacement) {
            event.preventDefault();
            event.stopPropagation();
            cancelPlacement();
          }
        }}
        onInteractOutside={(event) => {
          if (phase !== "idle" || useMapStore.getState().pendingInvocationPlacement)
            event.preventDefault();
        }}
      >
        <div className="space-y-4">
          <header className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Crosshair aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg tracking-wide text-foreground">
                  Invocar no mapa
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha até duas fichas e clique nas células onde elas devem surgir.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar painel de invocação"
              disabled={!!pendingInvocation || phase !== "idle"}
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>

          {pendingInvocation ? (
            <section
              aria-live="polite"
              className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-3"
            >
              <div className="flex items-start gap-3">
                <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h3 className="font-display text-base text-foreground">
                    Posicionamento em andamento
                  </h3>
                  <p className="mt-1 text-sm text-foreground/80">
                    {pendingNext
                      ? `Clique em uma célula livre para ${pendingNext.label}. Alcance: ${pendingNext.alcanceM} m.`
                      : "Conclua o posicionamento no mapa."}
                  </p>
                  {isMaster && pendingOwnerName && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Controlador: {pendingOwnerName}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-sm tabular-nums text-primary">
                    {pendingInvocation.placements.length} / {pendingInvocation.items.length}{" "}
                    posicionada(s)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelPlacement}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-destructive/40 px-3 text-base text-foreground hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60"
              >
                Cancelar posicionamento
              </button>
            </section>
          ) : pendingAoE ? (
            <p
              role="status"
              className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm text-foreground/85"
            >
              Há um posicionamento de área ativo. Conclua-o ou cancele-o antes de iniciar uma
              invocação.
            </p>
          ) : (
            <>
              {isMaster ? (
                masterCharacters.length > 1 ? (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Ficha Controladora</span>
                    <select
                      aria-label="Ficha Controladora para invocar"
                      value={character?.id ?? ""}
                      onChange={(event) => setSelectedCharacter(event.target.value)}
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {masterCharacters.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.invocacoesConhecidas?.length ?? 0} conhecidas
                        </option>
                      ))}
                    </select>
                  </label>
                ) : character ? (
                  <p className="text-sm text-muted-foreground">
                    Controlador:{" "}
                    <strong className="font-medium text-foreground">{character.name}</strong>
                  </p>
                ) : null
              ) : character ? (
                <p className="text-sm text-muted-foreground">
                  Sua ficha:{" "}
                  <strong className="font-medium text-foreground">{character.name}</strong>
                </p>
              ) : null}

              {character ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-secondary/35 px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 text-base text-foreground">
                      <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
                      <span>
                        <strong className="font-mono tabular-nums">{currentPe}</strong> /{" "}
                        {character.peMax} PE
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield aria-hidden="true" className="h-4 w-4 text-accent" />
                      <span>
                        {activeTokens.length} / {activeLimit} ativas
                      </span>
                    </span>
                  </div>

                  {catalog.length === 0 ? (
                    <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                      Esta ficha ainda não tem invocações conhecidas. Cadastre ou vincule as fichas
                      de invocação para usá-las aqui.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h3 className="font-display text-base tracking-wide text-foreground">
                            Biblioteca
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Selecione uma ou duas; o alcance é validado ao posicionar.
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm tabular-nums text-accent">
                          {selectedIds.length}/2
                        </span>
                      </div>

                      <ul
                        aria-label="Invocações conhecidas"
                        className="max-h-72 divide-y divide-border/70 overflow-y-auto rounded-lg border border-border/70"
                      >
                        {catalog.map((model) => {
                          const selected = selectedIds.includes(model.id);
                          const status = eligibility.get(model.id);
                          const blocked = canSelect(model);
                          const cached = model.imagemAssetId
                            ? assetCache.get(model.imagemAssetId)
                            : null;
                          const fallback = model.imagemFallbackAssetId
                            ? assetCache.get(model.imagemFallbackAssetId)
                            : null;
                          const image = cached?.ready ? cached : fallback?.ready ? fallback : null;
                          const overrideNeeded =
                            isMaster && !status?.blocked && Boolean(status?.intermediary);
                          const dynamicBlock =
                            !selected &&
                            blocked &&
                            !status?.blocked &&
                            !(status?.intermediary && !isMaster);

                          return (
                            <li key={model.id} className="p-2">
                              <div
                                className={cn(
                                  "rounded-lg transition-colors",
                                  selected ? "bg-primary/10" : "hover:bg-secondary/50",
                                  blocked && !selected && "opacity-75",
                                )}
                              >
                                <button
                                  type="button"
                                  aria-pressed={selected}
                                  aria-label={`${selected ? "Remover" : "Selecionar"} ${model.apelido?.trim() || model.nome}; ${model.custoInvocacaoPE} pontos de energia`}
                                  disabled={
                                    phase !== "idle" ||
                                    !!pendingInvocation ||
                                    !!pendingAoE ||
                                    (!selected && !!blocked)
                                  }
                                  onClick={() => toggleModel(model)}
                                  className={cn(
                                    "flex min-h-[4.5rem] w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed",
                                    selected
                                      ? "border-primary/50 bg-primary/10"
                                      : "border-transparent hover:border-border/80",
                                  )}
                                >
                                  <span
                                    className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-background"
                                    style={{ borderColor: model.corIdentificacao ?? undefined }}
                                  >
                                    {image ? (
                                      <img
                                        src={image.url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Sparkles
                                        aria-hidden="true"
                                        className="h-5 w-5 text-primary/75"
                                      />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-base font-medium text-foreground">
                                      {model.apelido?.trim() || model.nome}
                                    </span>
                                    <span className="mt-0.5 block text-sm text-muted-foreground">
                                      {model.tipo === "shikigami"
                                        ? "Shikigami"
                                        : "Corpo Amaldiçoado"}{" "}
                                      · {model.hpAtual}/{model.hpMaximo} PV · alcance{" "}
                                      {alcancePosicionamentoInvocacao(model)} m
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="font-mono text-sm tabular-nums text-accent">
                                      {model.custoInvocacaoPE} PE
                                    </span>
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "inline-flex h-6 w-6 items-center justify-center rounded-full border",
                                        selected
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border text-transparent",
                                      )}
                                    >
                                      {selected && <Check className="h-4 w-4" />}
                                    </span>
                                  </span>
                                </button>

                                {status?.blocked ? (
                                  <p className="flex items-start gap-1.5 px-3 pb-2 text-sm text-muted-foreground">
                                    <AlertCircle
                                      aria-hidden="true"
                                      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                                    />
                                    <span>{status.blocked}</span>
                                  </p>
                                ) : status?.intermediary && !isMaster ? (
                                  <p className="flex items-start gap-1.5 px-3 pb-2 text-sm text-muted-foreground">
                                    <AlertCircle
                                      aria-hidden="true"
                                      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                                    />
                                    <span>{status.intermediary}</span>
                                  </p>
                                ) : dynamicBlock ? (
                                  <p className="px-3 pb-2 text-sm text-muted-foreground">
                                    {blocked}
                                  </p>
                                ) : null}

                                {overrideNeeded && selected && (
                                  <label className="mx-3 mb-3 block space-y-1.5 rounded-md border border-accent/25 bg-accent/5 p-2.5">
                                    <span className="text-sm text-foreground">
                                      Exceção do Mestre · motivo obrigatório
                                    </span>
                                    <input
                                      aria-label={`Motivo do Mestre para ${model.nome}`}
                                      value={overrideReasons[model.id] ?? ""}
                                      onChange={(event) =>
                                        setOverrideReasons((current) => ({
                                          ...current,
                                          [model.id]: event.target.value,
                                        }))
                                      }
                                      placeholder={status?.intermediary}
                                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                                    />
                                  </label>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span>
                          {selectedIds.length
                            ? `Custo do lote: ${selectedTotal} PE`
                            : "Nenhuma invocação selecionada"}
                        </span>
                        <span>
                          {hasControllerToken
                            ? "Token do Controlador no mapa"
                            : "Token do Controlador ausente"}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p
                  role="status"
                  className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground"
                >
                  {isMaster
                    ? "Nenhuma ficha com invocações conhecidas. Vincule as invocações a uma ficha para iniciar."
                    : "Não encontrei sua ficha neste perfil. Confira o vínculo do personagem antes de invocar."}
                </p>
              )}

              {feedback && (
                <p role="status" className="text-sm text-foreground/80">
                  {feedback}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-foreground"
                >
                  {error}
                </p>
              )}

              <footer className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
                {phase === "preparing" && (
                  <button
                    type="button"
                    onClick={cancelPlacement}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-3 text-base text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    Cancelar preparação
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    !character ||
                    !hasControllerToken ||
                    selectedIds.length === 0 ||
                    phase !== "idle" ||
                    !!pendingInvocation ||
                    !!pendingAoE ||
                    selectedTotal > currentPe ||
                    activeTokens.length + selectedIds.length > activeLimit ||
                    selectedModels.some((model) => {
                      const status = eligibility.get(model.id);
                      return (
                        !!status?.blocked ||
                        (!!status?.intermediary &&
                          (!isMaster || !overrideReasons[model.id]?.trim()))
                      );
                    })
                  }
                  onClick={() => void startPlacement()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <MapPin aria-hidden="true" className="h-4 w-4" />
                  {phase === "preparing" ? "Preparando imagens…" : "Posicionar no mapa"}
                </button>
              </footer>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

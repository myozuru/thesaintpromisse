import "./invocations.css";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ScrollText, Sparkles, UserRound } from "lucide-react";
import { InvocationSelect } from "@/components/invocacoes/InvocationSelect";
import { ModuleHeader } from "@/components/ui/module-header";
import { ControladorShikigamisAba } from "@/components/fichas/ControladorShikigamisAba";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useRoleStore } from "@/stores/useRoleStore";
import { findMyCharacter } from "@/lib/myCharacter";
import { charactersVisibleToRole } from "@/lib/characterVisibility";
import { cn } from "@/lib/utils";

/** Criação, ficha, biblioteca e comandos de Shikigamis vivem fora da ficha. */
export function InvocacoesModule() {
  const role = useRoleStore((state) => state.role);
  const characters = useCharacterStore((state) => state.characters);
  const profileId = useProfileStore((state) => state.activeProfileId);
  const myCharacter = findMyCharacter(characters, profileId);
  const selectableCharacters = useMemo(() => {
    if (role === "PLAYER") return myCharacter ? [myCharacter] : [];
    if (role === "MASTER") return charactersVisibleToRole(characters, role, profileId);
    return [];
  }, [characters, myCharacter, profileId, role]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");

  useEffect(() => {
    if (selectableCharacters.some((character) => character.id === selectedCharacterId)) return;
    setSelectedCharacterId(selectableCharacters[0]?.id ?? "");
  }, [selectableCharacters, selectedCharacterId]);

  const selectedCharacter = selectableCharacters.find(
    (character) => character.id === selectedCharacterId,
  );

  // PLAYER: use the current profile's controller sheet. This keeps the
  // existing create/edit, library, deployment, and combat actions available.
  if (role === "PLAYER") {
    const shikigamis = selectedCharacter?.invocacoesConhecidas ?? [];
    return (
      <div className="invocations-workspace inv-module-enter space-y-6">
        <ModuleHeader
          icon={ScrollText}
          title="Invocações"
          subtitle={`${shikigamis.length} ${shikigamis.length === 1 ? 'shikigami' : 'shikigamis'}`}
          description="Sua biblioteca de shikigamis."
        />
        {selectedCharacter ? (
          <div className="inv-detail-panel min-w-0">
            <ControladorShikigamisAba key={selectedCharacter.id} character={selectedCharacter} />
          </div>
        ) : (
          <div className="inv-empty rounded-xl p-12 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/50 mb-4" />
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '16px', lineHeight: 1.55 }}>
              Nenhuma ficha de jogador está associada ao seu perfil. Crie uma ficha no módulo Fichas para começar.
            </p>
          </div>
        )}
      </div>
    );
  }

  // MASTER: master-detail layout (280px selector + right panel)
  return (
    <div className="invocations-workspace inv-module-enter">
      <ModuleHeader
        icon={ScrollText}
        title="Invocações"
        subtitle={`${selectableCharacters.length} ${selectableCharacters.length === 1 ? 'controlador' : 'controladores'}`}
        description="Painel do Mestre — criação, biblioteca e comando de invocações."
      />
      <div className="inv-master-layout flex gap-4">
        {/* Left selector panel - 280px fixed */}
        <aside className="inv-selector-panel flex-shrink-0 w-[280px] rounded-xl p-4" aria-label="Personagens controladores">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold uppercase tracking-wider text-accent">
              Controladores
            </h2>
            <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 font-mono text-sm text-muted-foreground">
              {selectableCharacters.length}
            </span>
          </div>
          <label className="mb-4 block text-sm font-medium text-muted-foreground">
            Personagem controlador
            <InvocationSelect
              aria-label="Personagem controlador"
              value={selectedCharacterId}
              onChange={(event) => setSelectedCharacterId(event.target.value)}
              className="mt-1 w-full rounded border border-input bg-background p-2"
            >
              {selectableCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </InvocationSelect>
          </label>
          {selectableCharacters.length > 0 ? (
            <div role="group" aria-label="Selecionar personagem controlador" className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {selectableCharacters.map((character) => {
                const selected = character.id === selectedCharacterId;
                return (
                  <button
                    key={character.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Selecionar ${character.name}${selected ? ', selecionado' : ''}`}
                    title={character.name}
                    onClick={() => setSelectedCharacterId(character.id)}
                    className={cn(
                      "group flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                      selected
                        ? "border-primary/50 bg-primary/15 text-foreground shadow-[0_0_18px_-10px_hsl(var(--primary)/0.8)]"
                        : "border-border/60 bg-background/35 text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground",
                    )}
                  >
                    <UserRound className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-base font-medium">{character.name}</span>
                    {selected && <ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/60 bg-background/25 p-3 text-base text-muted-foreground">
              Nenhum personagem disponível para administrar invocações.
            </p>
          )}
        </aside>
        {/* Right content panel */}
        <div className="inv-detail-panel flex-1 min-w-0">
          {selectedCharacter ? (
            <ControladorShikigamisAba key={selectedCharacter.id} character={selectedCharacter} />
          ) : (
            <div className="inv-empty rounded-xl p-12 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/50 mb-4" />
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '16px', lineHeight: 1.55 }}>
                Crie uma ficha de personagem para administrar as invocações.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

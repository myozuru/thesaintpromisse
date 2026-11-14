import { InvocationSelect } from "@/components/invocacoes/InvocationSelect";
import "./invocations.css";
import { useEffect, useMemo, useState } from "react";
import { Ghost } from "lucide-react";
import { ModuleHeader } from "@/components/ui/module-header";
import { ControladorShikigamisAba } from "@/components/fichas/ControladorShikigamisAba";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useRoleStore } from "@/stores/useRoleStore";
import { findMyCharacter } from "@/lib/myCharacter";
import { charactersVisibleToRole } from "@/lib/characterVisibility";

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

  return (
    <div className="invocations-workspace inv-module-enter space-y-4">
      <div className="inv-hero">
      <ModuleHeader
        icon={Ghost}
        title="Invocações"
        description="Veja suas invocações, explore o catálogo e crie fichas."
      />

      {role === "MASTER" && selectableCharacters.length > 0 && (
        <label className="inv-controller block max-w-xl text-sm">
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
      )}

      </div>
      {selectedCharacter ? (
        <ControladorShikigamisAba key={selectedCharacter.id} character={selectedCharacter} />
      ) : (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {role === "PLAYER"
            ? "Nenhuma ficha de jogador está associada ao seu perfil."
            : "Crie uma ficha de personagem para administrar as invocações."}
        </p>
      )}
    </div>
  );
}

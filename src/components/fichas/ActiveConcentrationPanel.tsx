import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { concentrationLimit, getActiveConcentrationCount } from '@/lib/concentration';

export function ActiveConcentrationPanel({ character }: { character: Character }) {
  const characters = useCharacterStore((state) => state.characters);
  const endConcentration = useCharacterStore((state) => state.endConcentration);
  const addLog = useLogStore((state) => state.addLog);
  const active = character.activeConcentrations ?? [];

  if (active.length === 0) return null;

  return (
    <div className="mx-4 mb-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-primary">
          Concentração {getActiveConcentrationCount(character)}/{concentrationLimit(character)}
        </span>
        <span className="text-xs text-muted-foreground">Encerre para liberar o slot</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {active.map((entry) => {
          const targets = entry.targetIds
            .map((id) => characters.find((candidate) => candidate.id === id)?.name)
            .filter((name): name is string => !!name);
          return (
            <div key={entry.instanceId} className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-background/70 px-2 py-1">
              <span className="text-sm text-foreground">
                {entry.spellName}
                {targets.length > 0 && <span className="text-xs text-muted-foreground"> · {targets.join(', ')}</span>}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (endConcentration(character.id, entry.instanceId)) {
                    addLog('spell', `🌀 ${character.name} encerrou a concentração de ${entry.spellName}.`);
                  }
                }}
                className="rounded border border-destructive/30 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                title={`Encerrar concentração de ${entry.spellName} e remover seus efeitos vinculados`}
              >
                Encerrar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

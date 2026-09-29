/**
 * Especialista em Combate — Repertório do Especialista.
 * Mostra estilos ativos e permite escolher os pendentes (Nv 1, 6 e 12).
 */
import { useState } from 'react';
import { Swords, Check } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import {
  chooseCombatStyle,
  getActiveCombatStyles,
  getAdeptoCombatStyle,
  getAvailableCombatStyles,
  getCombatStyleDef,
  getDefensivoCA,
  getPendingCombatStyleCount,
  isEspecialistaCombate,
  type CombatStyleId,
} from '@/lib/combateEstilos';
import { cn } from '@/lib/utils';

function liveBonus(c: Character, id: CombatStyleId): string | null {
  if (id === 'defensivo') return `CA +${getDefensivoCA(c)} (ativo)`;
  return null;
}

export function CombateEstilosPanel({ character: c }: { character: Character }) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const [picked, setPicked] = useState<CombatStyleId | null>(null);
  if (!isEspecialistaCombate(c) && !getAdeptoCombatStyle(c)) return null;

  const active = getActiveCombatStyles(c);
  const adepto = getAdeptoCombatStyle(c);
  const pending = getPendingCombatStyleCount(c);
  const available = getAvailableCombatStyles(c);

  const confirm = () => {
    if (!picked) return;
    const r = chooseCombatStyle(c, picked);
    if (!r.ok) return;
    updateCharacter(c.id, r.patch);
    useLogStore.getState().addLog('combat', `⚔️ ${c.name} aprendeu ${getCombatStyleDef(picked)?.name}.`);
    setPicked(null);
  };

  return (
    <div className="mx-2 my-2 space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-primary">Repertório do Especialista</span>
        {pending > 0 && (
          <span className="ml-auto rounded bg-destructive/20 px-2 py-0.5 text-xs font-bold text-destructive">
            {pending} estilo(s) para escolher
          </span>
        )}
      </div>

      {active.length === 0 && pending === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum estilo ativo.</p>
      )}
      <div className="space-y-1.5">
        {active.map((id) => {
          const def = getCombatStyleDef(id)!;
          const bonus = liveBonus(c, id);
          return (
            <div key={id} className="rounded-md border border-border bg-background/60 p-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{def.name}</span>
                {id === adepto && <span className="text-xs text-muted-foreground">(Adepto de Combate)</span>}
                {bonus && <span className="ml-auto text-xs font-bold text-primary">{bonus}</span>}
                {!def.implemented && <span className="ml-auto text-xs text-muted-foreground italic">efeito em breve</span>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{def.summary}</p>
            </div>
          );
        })}
      </div>

      {pending > 0 && (
        <div className="space-y-1.5 border-t border-border/50 pt-2">
          <p className="text-sm font-bold text-foreground">Escolher novo estilo</p>
          <div className="grid gap-1.5">
            {available.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPicked(s.id)}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-left transition-colors',
                  picked === s.id ? 'border-primary bg-primary/20' : 'border-border bg-background hover:border-primary/50',
                )}
              >
                <div className="text-sm font-bold text-foreground">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.summary}</div>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!picked}
            onClick={confirm}
            className="w-full rounded-md border border-primary bg-primary/30 px-2 py-1.5 text-sm font-bold text-primary hover:bg-primary/50 disabled:opacity-40"
          >
            <Check className="mr-1 inline h-4 w-4" />Confirmar estilo
          </button>
        </div>
      )}
    </div>
  );
}

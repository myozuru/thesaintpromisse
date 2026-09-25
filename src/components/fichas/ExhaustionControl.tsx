import { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { cn } from '@/lib/utils';
import { Plus, Minus, Skull } from 'lucide-react';
import { clampExh, getExhaustionMods, EXHAUSTION_MAX } from '@/lib/exhaustionEffects';

interface Props {
  character: Character;
}

const LEVEL_TEXT: Record<number, string> = {
  0: 'Sem exaustão.',
  1: '-1 em rolagens, Defesa, CD; -1.5m mov.',
  2: '+ Desprevenido (-3 Def/Reflexos).',
  3: '+ Exposto. HP máx. reduzido (max(20, máx/4)).',
  4: '+ Condenado, Desorientado. Salvaguarda de morte começa com 2 falhas.',
  5: '+ Enjoado. HP máx. reduzido (max(50, máx/2)).',
  6: '☠ MORTE INSTANTÂNEA.',
};

/**
 * Controle de Exaustão (visível no painel expandido da ficha).
 * Aplicável a TODAS as categorias (player, NPC, inimigo) — qualquer um pode
 * ganhar níveis por habilidades, fome ou narrativa do Mestre.
 */
export function ExhaustionControl({ character }: Props) {
  const setExhaustion = useCharacterStore((s) => s.setExhaustion);
  const lv = clampExh(character.exhaustionLevel);
  const mods = getExhaustionMods(character);

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-2.5 text-sm">
      <div className="flex items-center gap-2">
        <Skull className={cn('h-4 w-4', lv >= 4 ? 'text-neon-red' : 'text-muted-foreground')} />
        <span className="font-bold uppercase tracking-wide text-muted-foreground text-xs">Exaustão</span>
        <div className="flex flex-1 items-center gap-1">
          {Array.from({ length: EXHAUSTION_MAX }).map((_, i) => {
            const filled = i < lv;
            const tone =
              i < 1 ? 'bg-neon-yellow' :
              i < 3 ? 'bg-neon-orange' :
              i < 5 ? 'bg-neon-red' : 'bg-foreground';
            return (
              <div
                key={i}
                className={cn(
                  'h-2 flex-1 rounded-full transition-all duration-300',
                  filled ? cn(tone, 'opacity-100 scale-y-100') : 'bg-secondary/40 opacity-60 scale-y-[0.55]',
                )}
              />
            );
          })}
        </div>
        <span className="w-10 text-right font-mono font-bold">{lv}/{EXHAUSTION_MAX}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExhaustion(character.id, lv - 1); }}
            disabled={lv === 0}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-30"
            title="−1 Exaustão"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExhaustion(character.id, lv + 1); }}
            disabled={lv >= EXHAUSTION_MAX}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-30"
            title="+1 Exaustão"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className={cn('mt-1.5 text-sm', lv >= 4 ? 'text-neon-red' : 'text-muted-foreground')}>
        {LEVEL_TEXT[lv]}
      </p>
      {lv > 0 && (
        <p className="mt-1 text-xs text-muted-foreground/80">
          Penalidades: {mods.notes.join(' · ')}
          {mods.hpMaxReduction > 0 && ` · HP máx −${mods.hpMaxReduction}`}
        </p>
      )}
      {character.unconsciousFromExhaustion && (
        <p className="mt-1 text-xs font-bold text-neon-orange">
          😵 Desmaiado por Exaustão — precisa de {character.deathRestsRequired ?? 0} Descanso(s) Longo(s) para acordar.
        </p>
      )}
      {character.dying && (character.deathFails ?? 0) > 0 && (
        <p className="mt-1 text-xs font-bold text-neon-red">
          ☠ Salvaguarda de Morte — Falhas: {character.deathFails}/3
        </p>
      )}
    </div>
  );
}

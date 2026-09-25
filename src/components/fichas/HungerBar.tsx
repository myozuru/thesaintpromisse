import { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { cn } from '@/lib/utils';
import { Utensils, Plus, Minus } from 'lucide-react';

const HUNGER_MAX = 24;

interface Props {
  character: Character;
}

/** Cor de cada barrinha individual baseada na posição (esquerda = vermelho, direita = verde). */
function pipColor(index: number): string {
  // index 0..23 — esquerda é a "última" reserva
  if (index < 6) return 'bg-neon-red';
  if (index < 12) return 'bg-neon-orange';
  if (index < 18) return 'bg-neon-yellow';
  return 'bg-neon-green';
}

export function HungerBar({ character }: Props) {
  const setHunger = useCharacterStore((s) => s.setHunger);
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';

  const value = Math.max(0, Math.min(HUNGER_MAX, character.hunger ?? HUNGER_MAX));

  return (
    <div className="flex items-center gap-2 text-sm">
      <Utensils className="h-3.5 w-3.5 text-muted-foreground" />
      <span
        className="w-8 text-right font-semibold text-muted-foreground text-sm"
        style={{ fontFamily: "'Cinzel', serif" }}
        title="Fome — perde 1 a cada hora; ao zerar ganha 1 nível de Exaustão e reseta para 24."
      >
        Fome
      </span>

      {/* 24 barrinhas finas, horizontais e arredondadas — somem gradualmente */}
      <div className="flex flex-1 items-center gap-[3px]">
        {Array.from({ length: HUNGER_MAX }).map((_, i) => {
          const filled = i < value;
          // A próxima barrinha a ser consumida (a mais à direita ainda cheia)
          // recebe um leve "pulse" suave para indicar que está acabando.
          const isNext = filled && i === value - 1;
          return (
            <div
              key={i}
              className={cn(
                'h-2 flex-1 rounded-full transition-all ease-out',
                filled
                  ? cn(
                      pipColor(i),
                      'opacity-100 scale-y-100',
                      isNext && 'animate-pulse',
                    )
                  : 'bg-secondary/40 opacity-60 scale-y-[0.55]',
              )}
              style={{ transitionDuration: '900ms' }}
            />
          );
        })}
      </div>


      <span className="w-14 text-right font-mono text-foreground font-bold text-sm">
        {value}/{HUNGER_MAX}
      </span>

      {isMaster && (
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setHunger(character.id, value - 1); }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            title="−1 fome (Mestre)"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setHunger(character.id, value + 1); }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            title="+1 fome (Mestre)"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

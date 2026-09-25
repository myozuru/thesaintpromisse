import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSorcererRank } from '@/lib/levelEngine';

interface Props {
  level: number;
  className?: string;
}

const RANK_STYLES: Record<string, string> = {
  'Quarto Grau':   'bg-secondary/40 text-muted-foreground border-border',
  'Terceiro Grau': 'bg-chart-2/15 text-chart-2 border-chart-2/40',
  'Segundo Grau':  'bg-primary/20 text-primary border-primary/50',
  'Primeiro Grau': 'bg-accent/25 text-accent-foreground border-accent/60',
  'Grau Especial': 'bg-gradient-to-r from-primary/30 to-accent/30 text-foreground border-primary',
};

/** Badge cosmética do Grau do Feiticeiro baseada no nível (1..20). */
export function SorcererRankBadge({ level, className }: Props) {
  const rank = getSorcererRank(level);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider',
        RANK_STYLES[rank] ?? RANK_STYLES['Quarto Grau'],
        className,
      )}
      title={`Nível ${level} — ${rank}`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {rank}
    </span>
  );
}
